import { useEffect, useMemo, useRef } from "react";
import { calcularDimensionesElemental, casillaBloqueada } from "./elementalesUtils";
import { IMAGEN_BOMBA } from "./bombasAssets";
import { animarMarca } from "./efectos/animaciones";

/**
 * `relleno` (opcional): { casillas: [...] } en el orden en que se rellenan al
 * terminar la partida. `rellenoVisible` es cuántas de esas casillas ya se
 * muestran con su color; el resto aparece libre hasta que les toca.
 */
export default function TableroElemental({
  partida,
  colorPorUid,
  casillasResaltadas = [],
  casillasSeleccionadas = [],
  onCasillaClick,
  deshabilitado,
  casillaEnProceso = null,
  relleno = null,
  rellenoVisible = 0,
}) {
  const { filas, columnas } = calcularDimensionesElemental(partida);
  const resaltadas = new Set(casillasResaltadas);
  const seleccionadas = new Set(casillasSeleccionadas);
  const contenedorRef = useRef(null);
  const visiblesPrevias = useRef(rellenoVisible);

  const ordenRelleno = useMemo(() => {
    const m = new Map();
    (relleno?.casillas || []).forEach((clave, i) => m.set(clave, i));
    return m;
  }, [relleno]);

  // Cada casilla que se revela en el relleno hace un pequeño "pop".
  useEffect(() => {
    const desde = visiblesPrevias.current;
    visiblesPrevias.current = rellenoVisible;
    if (!relleno || rellenoVisible <= desde || !contenedorRef.current) return;
    for (let i = desde; i < rellenoVisible; i++) {
      const clave = relleno.casillas[i];
      animarMarca(contenedorRef.current.querySelector(`[data-casilla="${clave}"]`));
    }
  }, [rellenoVisible, relleno]);

  const celdas = [];
  for (let f = 0; f < filas; f++) {
    for (let c = 0; c < columnas; c++) {
      const clave = `${f}_${c}`;
      const casilla = partida.casillas[clave];

      if (!casilla) {
        celdas.push(<div key={clave} className="gp-cell gp-cell--hueco" />);
        continue;
      }

      const indiceRelleno = ordenRelleno.get(clave);
      const pendienteDeRelleno = indiceRelleno !== undefined && indiceRelleno >= rellenoVisible;
      const color = casilla.marcadaPor && !pendienteDeRelleno ? colorPorUid[casilla.marcadaPor] : null;
      const bloqueada = casillaBloqueada(clave, partida);
      const esResaltada = resaltadas.has(clave);
      const esSeleccionada = seleccionadas.has(clave);
      const enProceso = casillaEnProceso === clave;

      const clases = ["gp-cell", "gp-cell--elemental"];
      if (color) clases.push(`gp-cell--${color}`);
      if (indiceRelleno !== undefined && !pendienteDeRelleno) clases.push("gp-cell--relleno");
      if (bloqueada) clases.push("gp-cell--lianas");
      if (esResaltada) clases.push("gp-cell--jugable gp-cell--resaltada");
      if (esSeleccionada) clases.push("gp-cell--seleccionada");
      if (enProceso) clases.push("gp-cell--procesando");

      celdas.push(
        <button
          key={clave}
          type="button"
          className={clases.join(" ")}
          data-casilla={clave}
          disabled={deshabilitado || (!esResaltada && !esSeleccionada && !enProceso)}
          onClick={() => onCasillaClick(clave)}
          title={bloqueada ? "Bloqueada por Lianas" : undefined}
        >
          {bloqueada && <img className="gp-cell-lianas" src={IMAGEN_BOMBA.lianas} alt="" draggable="false" />}
          {enProceso && <span className="gp-spinner" />}
        </button>
      );
    }
  }

  return (
    <div className="gp-board gp-board--elemental" ref={contenedorRef}>
      <div className="gp-board-grid" style={{ "--cols": columnas, "--rows": filas }}>
        {celdas}
      </div>
      <div className="gp-fx" aria-hidden="true" />
    </div>
  );
}