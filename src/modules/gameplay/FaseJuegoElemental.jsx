import { useState, useEffect, useRef } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../firebase/config";
import { useAuth } from "../../context/AuthContext";
import { useServerTimeOffset } from "../../hooks/useServerTimeOffset";
import TableroElemental from "./TableroElemental";
import HudPartida from "./HudPartida";
import { useProgresoRelleno } from "./efectos/useProgresoRelleno";
import { IMAGEN_BOMBA } from "./bombasAssets";
import {
  casillasPropiasDisponibles,
  objetivosElectrica,
  casillasBloqueablesLianas,
  otroJugador,
} from "./elementalesUtils";

const marcarCasillaElementalCallable = httpsCallable(functions, "marcarCasillaElemental");
const usarBombaElementalCallable = httpsCallable(functions, "usarBombaElemental");
const verificarTimeoutTurnoElementalCallable = httpsCallable(functions, "verificarTimeoutTurnoElemental");

const NOMBRES_BOMBA = {
  electrica: { nombre: "Eléctrica", imagen: IMAGEN_BOMBA.electrica },
  lianas: { nombre: "Lianas", imagen: IMAGEN_BOMBA.lianas },
  hielo: { nombre: "Hielo", imagen: IMAGEN_BOMBA.hielo },
};

// Bombas elementales que le quedan a un jugador, con su propio título para
// no confundirlas con el marcador de casillas.
function ExtraElemental({ jugador }) {
  return (
    <div className="gp-extra gp-extra--bombas">
      <span className="gp-extra-titulo">Bombas</span>
      <div className="gp-extra-fila">
        {Object.entries(NOMBRES_BOMBA).map(([tipo, { nombre, imagen }]) => (
          <img
            key={tipo}
            className={"gp-extra-img" + (jugador.bombas?.[tipo] ? "" : " gp-extra-img--usada")}
            src={imagen}
            alt={nombre}
            title={jugador.bombas?.[tipo] ? nombre : `${nombre} (usada)`}
          />
        ))}
      </div>
    </div>
  );
}

// Marcador central: casillas marcadas de cada jugador (el color es el de su territorio).
function MarcadorCasillas({ yo, rival, pendientesYo = 0, pendientesRival = 0 }) {
  const numeroYo = Math.max(0, (yo.casillasMarcadas || 0) - pendientesYo);
  const numeroRival = Math.max(0, (rival.casillasMarcadas || 0) - pendientesRival);
  return (
    <div className="gp-marcador" title="Casillas marcadas">
      <span className="gp-marcador-titulo">Casillas marcadas</span>
      <div className="gp-marcador-fila">
        <span className={`gp-marcador-num gp-marcador-num--${yo.color}`}>{numeroYo}</span>
        <span className="gp-marcador-sep">:</span>
        <span className={`gp-marcador-num gp-marcador-num--${rival.color}`}>{numeroRival}</span>
      </div>
    </div>
  );
}

export default function FaseJuegoElemental({ partidaId, partida, perfiles = {} }) {
  const { user } = useAuth();
  const offset = useServerTimeOffset();

  const [procesando, setProcesando] = useState(false);
  const procesandoRef = useRef(false);
  const [casillaEnProceso, setCasillaEnProceso] = useState(null);
  const [error, setError] = useState("");
  const [segundosRestantes, setSegundosRestantes] = useState(null);

  // `modo` controla qué se espera que el jugador toque en el tablero:
  //   null            -> movimiento normal
  //   "electrica"     -> eligiendo el centro de la cruz
  //   "hielo"         -> eligiendo la casilla propia a marcar
  //   "lianas-paso1"  -> eligiendo la casilla propia a marcar
  //   "lianas-paso2"  -> eligiendo las 3 casillas a bloquear
  const [modo, setModo] = useState(null);
  const [casillaPropiaLianas, setCasillaPropiaLianas] = useState(null);
  const [bloqueoSeleccionado, setBloqueoSeleccionado] = useState([]);

  const uid = user.uid;
  const rivalUid = otroJugador(uid, partida);
  const miJugador = partida.jugadores[uid];
  const rivalJugador = partida.jugadores[rivalUid];
  const colorPorUid = { [uid]: miJugador.color, [rivalUid]: rivalJugador.color };

  const esMiTurno = partida.turnoActual?.uidActivo === uid;
  const finalizaEn = partida.turnoActual?.finalizaEn;
  const estoyCongelado = (miJugador.congeladoPorTurnos || 0) > 0;

  useEffect(() => {
    if (!finalizaEn) {
      setSegundosRestantes(null);
      return;
    }
    const tick = () => {
      const restante = Math.max(0, Math.ceil((finalizaEn - (Date.now() + offset)) / 1000));
      setSegundosRestantes(restante);
      // Mientras mi propia jugada está en camino no pido el timeout: el
      // servidor debe recibirla y contarla (seguro de tiempo).
      if (restante === 0 && !procesandoRef.current) {
        verificarTimeoutTurnoElementalCallable({ partidaId }).catch((err) =>
          console.error("Error verificando timeout de turno:", err)
        );
      }
    };
    setSegundosRestantes(Math.max(0, Math.ceil((finalizaEn - (Date.now() + offset)) / 1000)));
    const intervalo = setInterval(tick, 1000);
    return () => clearInterval(intervalo);
  }, [finalizaEn, partidaId, offset]);

  // Si deja de ser mi turno (p. ej. se acabó el tiempo), cancela cualquier
  // selección de bomba a medias.
  useEffect(() => {
    if (!esMiTurno) {
      setModo(null);
      setCasillaPropiaLianas(null);
      setBloqueoSeleccionado([]);
    }
  }, [esMiTurno, partida.numeroTurno]);

  // Datos que acompañan cada jugada para el "seguro" del servidor: a qué
  // turno pertenece y a qué hora (reloj del servidor) hice clic.
  const datosDeTiempo = () => ({
    numeroTurno: partida.numeroTurno,
    enviadoEn: Date.now() + offset,
  });

  // Envuelve una jugada: marca la casilla como "cargando" desde el clic
  // hasta que el servidor responde, aunque el contador ya haya llegado a 0.
  const ejecutarJugada = async (casillaVisible, accion) => {
    procesandoRef.current = true;
    setProcesando(true);
    setCasillaEnProceso(casillaVisible);
    setError("");
    try {
      await accion();
      return true;
    } catch (err) {
      console.error("Error en la jugada:", err);
      setError(err.message || "No se pudo completar la jugada.");
      return false;
    } finally {
      procesandoRef.current = false;
      setProcesando(false);
      setCasillaEnProceso(null);
    }
  };

  const cancelarModo = () => {
    setModo(null);
    setCasillaPropiaLianas(null);
    setBloqueoSeleccionado([]);
    setError("");
  };

  const armarBomba = (tipoBomba) => {
    if (procesando || !esMiTurno || !miJugador.bombas?.[tipoBomba]) return;
    setError("");
    if (tipoBomba === "lianas") {
      setModo("lianas-paso1");
    } else {
      setModo(tipoBomba);
    }
  };

  const handleCasillaClick = async (clave) => {
    if (procesando || !esMiTurno) return;

    // --- Movimiento normal ---
    if (modo === null) {
      await ejecutarJugada(clave, () =>
        marcarCasillaElementalCallable({ partidaId, casillaClave: clave, ...datosDeTiempo() })
      );
      return;
    }

    // --- Eléctrica: un solo clic ---
    if (modo === "electrica") {
      const ok = await ejecutarJugada(clave, () =>
        usarBombaElementalCallable({
          partidaId,
          tipoBomba: "electrica",
          casillaObjetivo: clave,
          ...datosDeTiempo(),
        })
      );
      if (ok) cancelarModo();
      return;
    }

    // --- Hielo: un solo clic (marca casilla + congela al rival) ---
    if (modo === "hielo") {
      const ok = await ejecutarJugada(clave, () =>
        usarBombaElementalCallable({
          partidaId,
          tipoBomba: "hielo",
          casillaObjetivo: clave,
          ...datosDeTiempo(),
        })
      );
      if (ok) cancelarModo();
      return;
    }

    // --- Lianas paso 1: elegir la casilla propia a marcar ---
    if (modo === "lianas-paso1") {
      setCasillaPropiaLianas(clave);
      setBloqueoSeleccionado([]);
      setModo("lianas-paso2");
      return;
    }

    // --- Lianas paso 2: elegir 3 casillas a bloquear. En cuanto se marca
    // la tercera se envía sola, sin pedir confirmación aparte (se puede
    // seguir destocando/cambiando mientras haya menos de 3). ---
    if (modo === "lianas-paso2") {
      if (bloqueoSeleccionado.includes(clave)) {
        setBloqueoSeleccionado(bloqueoSeleccionado.filter((c) => c !== clave));
        return;
      }
      if (bloqueoSeleccionado.length >= 3) return;

      const nuevaSeleccion = [...bloqueoSeleccionado, clave];
      setBloqueoSeleccionado(nuevaSeleccion);

      if (nuevaSeleccion.length === 3) {
        await confirmarLianas(nuevaSeleccion);
      }
    }
  };

  const confirmarLianas = async (casillasBloqueo) => {
    if (procesando || casillasBloqueo.length !== 3 || !casillaPropiaLianas) return;
    const ok = await ejecutarJugada(casillaPropiaLianas, () =>
      usarBombaElementalCallable({
        partidaId,
        tipoBomba: "lianas",
        casillaObjetivo: casillaPropiaLianas,
        casillasBloqueo,
        ...datosDeTiempo(),
      })
    );
    if (ok) cancelarModo();
  };

  // Casillas resaltadas como jugables, según el modo actual.
  let casillasResaltadas = [];
  let casillasSeleccionadas = [];
  if (esMiTurno && !procesando) {
    if (modo === null) casillasResaltadas = casillasPropiasDisponibles(uid, partida);
    else if (modo === "electrica") casillasResaltadas = objetivosElectrica(uid, partida);
    else if (modo === "hielo") casillasResaltadas = casillasPropiasDisponibles(uid, partida);
    else if (modo === "lianas-paso1") casillasResaltadas = casillasPropiasDisponibles(uid, partida);
    else if (modo === "lianas-paso2") {
      casillasResaltadas = casillasBloqueablesLianas(uid, partida);
      casillasSeleccionadas = bloqueoSeleccionado;
    }
  }

  const mensajeModo = {
    null: "Toca una casilla libre junto a tu territorio para marcarla.",
    electrica: "Eléctrica: toca el centro de la cruz (roba casillas del rival alrededor).",
    hielo: "Hielo: toca la casilla que quieres marcar. El rival perderá su próximo turno.",
    "lianas-paso1": "Lianas: primero toca la casilla propia que quieres marcar.",
    "lianas-paso2": `Lianas: elige 3 casillas junto al rival para bloquear (${bloqueoSeleccionado.length}/3). Se aplica al elegir la tercera.`,
  }[modo === null ? "null" : modo];

  const rivalCongelado = (rivalJugador.congeladoPorTurnos || 0) > 0;

  // Relleno final: cuando alguien ya no puede moverse, el servidor rellena las
  // casillas restantes para el otro y aquí se anima casilla por casilla.
  const { rellenando, progreso, total: totalRelleno } = useProgresoRelleno(partida.relleno, offset);
  const pendientes = rellenando ? totalRelleno - Math.min(progreso, totalRelleno) : 0;
  const yoRellena = partida.relleno?.uid === uid;

  return (
    <>
      <HudPartida
        titulo="Bombas Elementales"
        fase={rellenando ? "Relleno final" : esMiTurno ? "Tu turno" : "Turno del rival"}
        segundos={segundosRestantes}
        centro={
          <MarcadorCasillas
            yo={miJugador}
            rival={rivalJugador}
            pendientesYo={yoRellena ? pendientes : 0}
            pendientesRival={rellenando && !yoRellena ? pendientes : 0}
          />
        }
        yo={{
          perfil: perfiles[uid],
          mostrarVidas: false,
          enTurno: esMiTurno,
          color: miJugador.color,
          extra: <ExtraElemental jugador={miJugador} />,
        }}
        rival={{
          perfil: perfiles[rivalUid],
          mostrarVidas: false,
          enTurno: !esMiTurno,
          color: rivalJugador.color,
          extra: <ExtraElemental jugador={rivalJugador} />,
        }}
      />

      <div className={"gp-status" + (esMiTurno ? " gp-status--activo" : "")}>
        {rellenando
          ? yoRellena
            ? "El rival ya no puede moverse: te quedas con las casillas restantes"
            : "Ya no puedes moverte: el rival se queda con las casillas restantes"
          : esMiTurno
          ? procesando
            ? "Enviando jugada..."
            : mensajeModo
          : estoyCongelado
          ? "Estás congelado: pierdes este turno"
          : rivalCongelado
          ? "El rival está congelado"
          : "Turno del rival"}
      </div>
      {error && <p className="gp-error">{error}</p>}

      <div className="gp-elemental-acciones">
        {Object.entries(NOMBRES_BOMBA).map(([tipo, { nombre, imagen }]) => {
          const disponible = miJugador.bombas?.[tipo];
          const armada = modo === tipo || (tipo === "lianas" && modo?.startsWith("lianas"));
          return (
            <button
              key={tipo}
              type="button"
              className={
                "gp-bomba-btn" +
                (!disponible ? " gp-bomba-btn--usada" : "") +
                (armada ? " gp-bomba-btn--armada" : "")
              }
              disabled={!disponible || !esMiTurno || procesando || (modo !== null && !armada)}
              onClick={() => armarBomba(tipo)}
              title={disponible ? `Usar ${nombre}` : `${nombre} ya usada`}
            >
              <img src={imagen} alt="" draggable="false" />
              <span>{nombre}</span>
            </button>
          );
        })}
        {modo !== null && (
          <button type="button" onClick={cancelarModo} disabled={procesando} className="gp-cancelar">
            Cancelar
          </button>
        )}
      </div>

      <TableroElemental
        partida={partida}
        colorPorUid={colorPorUid}
        casillasResaltadas={casillasResaltadas}
        casillasSeleccionadas={casillasSeleccionadas}
        onCasillaClick={handleCasillaClick}
        deshabilitado={!esMiTurno || procesando}
        casillaEnProceso={casillaEnProceso}
        relleno={partida.relleno}
        rellenoVisible={progreso}
      />
    </>
  );
}