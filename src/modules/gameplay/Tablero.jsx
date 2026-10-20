import { useState, useEffect, useRef } from "react";
import { calcularDimensiones } from "./tableroUtils";
import { IMAGEN_BOMBA, bombaMasFuerte } from "./bombasAssets";
import { animarOcultar } from "./efectos/animaciones";
import { useServerTimeOffset } from "../../hooks/useServerTimeOffset";

// RQF-GAM: la bomba recién colocada se muestra 3 segundos y luego se oculta.
const TIEMPO_VISIBLE_MS = 3000;

const claveBomba = (clave, b) => `${clave}|${b.uid}|${b.colocadaEn}`;

/**
 * Tablero de Estándar y Bombas Venenosas. Las animaciones de colocación,
 * activación y detonación las dispara `useEfectosPartida` (PartidaScreen).
 *
 * Los 3 segundos de visibilidad se cuentan desde que ESTE cliente ve llegar la
 * bomba, así no dependen de que el reloj del equipo coincida con el del
 * servidor. Solo si la bomba ya estaba al abrir/recargar la partida se usa su
 * antigüedad real (con el desfase del servidor).
 */
export default function Tablero({ casillas = {}, onCasillaClick, deshabilitado, casillaEnProceso }) {
  const { filas, columnas } = calcularDimensiones(casillas);
  const offset = useServerTimeOffset();
  const tableroRef = useRef(null);

  const [ahora, setAhora] = useState(() => Date.now());
  // Momento (reloj local) en que cada bomba empezó a mostrarse.
  const [vistas, setVistas] = useState({});
  const primeraCarga = useRef(true);
  const visiblesPrevias = useRef(new Map());

  useEffect(() => {
    const intervalo = setInterval(() => setAhora(Date.now()), 200);
    return () => clearInterval(intervalo);
  }, []);

  // Registra las bombas nuevas apenas llegan.
  useEffect(() => {
    const t = Date.now();
    const nuevas = {};
    for (const [clave, casilla] of Object.entries(casillas)) {
      for (const b of casilla.bombas || []) {
        const k = claveBomba(clave, b);
        if (vistas[k] !== undefined) continue;
        nuevas[k] = primeraCarga.current
          ? t - Math.max(0, t + offset - b.colocadaEn)
          : t;
      }
    }
    primeraCarga.current = false;
    if (Object.keys(nuevas).length > 0) {
      // Lo ya registrado gana (el modo estricto de desarrollo ejecuta el efecto dos veces).
      setVistas((v) => {
        const out = { ...v };
        for (const [k, val] of Object.entries(nuevas)) if (out[k] === undefined) out[k] = val;
        return out;
      });
    }
  }, [casillas, offset, vistas]);

  const bombaVisible = (clave, b) => {
    const desde = vistas[claveBomba(clave, b)];
    // Aún no registrada: acaba de llegar, se muestra.
    if (desde === undefined) return true;
    return ahora - desde < TIEMPO_VISIBLE_MS;
  };

  const celdas = [];
  const visiblesAhora = new Map();
  for (let f = 0; f < filas; f++) {
    for (let c = 0; c < columnas; c++) {
      const clave = `${f}_${c}`;
      const casilla = casillas[clave];

      if (!casilla) {
        celdas.push(<div key={clave} className="gp-cell gp-cell--hueco" />);
        continue;
      }

      const bombas = casilla.bombas || [];
      const segura = casilla.segura === true;
      const detonada = casilla.detonada === true;
      const visibles = detonada ? bombas : bombas.filter((b) => bombaVisible(clave, b));
      const tipoVisible = bombaMasFuerte(visibles);
      if (tipoVisible && !detonada) visiblesAhora.set(clave, tipoVisible);
      const enProceso = casillaEnProceso === clave && !segura && !detonada;
      const bloqueada = deshabilitado || segura || detonada;

      const clases = ["gp-cell"];
      if (segura) clases.push("gp-cell--segura");
      if (detonada) clases.push("gp-cell--detonada");
      if (enProceso) clases.push("gp-cell--procesando");
      if (!bloqueada) clases.push("gp-cell--jugable");

      celdas.push(
        <button
          key={clave}
          type="button"
          className={clases.join(" ")}
          data-casilla={clave}
          disabled={bloqueada}
          onClick={() => onCasillaClick(clave)}
        >
          {tipoVisible && (
            <img
              className="gp-cell-bomba"
              src={IMAGEN_BOMBA[tipoVisible] || IMAGEN_BOMBA.bomba}
              alt=""
              draggable="false"
            />
          )}
          {visibles.length > 1 && <span className="gp-cell-count">{visibles.length}</span>}
          {segura && <span className="gp-cell-check" aria-hidden="true" />}
          {enProceso && <span className="gp-spinner" />}
        </button>
      );
    }
  }

  // Cuando una bomba pasa de visible a oculta se anima su ocultamiento.
  useEffect(() => {
    const previas = visiblesPrevias.current;
    const contenedor = tableroRef.current;
    if (contenedor) {
      const capa = contenedor.querySelector(".gp-fx");
      previas.forEach((tipo, clave) => {
        if (visiblesAhora.has(clave)) return;
        const actual = casillas[clave];
        // Si la casilla ya no tiene bombas es que cambió la ronda: no hay nada que ocultar.
        if (!actual || actual.detonada || actual.segura || !(actual.bombas?.length > 0)) return;
        const celda = contenedor.querySelector(`[data-casilla="${clave}"]`);
        animarOcultar(celda, capa, IMAGEN_BOMBA[tipo] || IMAGEN_BOMBA.bomba);
      });
    }
    visiblesPrevias.current = visiblesAhora;
  });

  return (
    <div className="gp-board" ref={tableroRef}>
      <div className="gp-board-grid" style={{ "--cols": columnas, "--rows": filas }}>
        {celdas}
      </div>
      <div className="gp-fx" aria-hidden="true" />
    </div>
  );
}