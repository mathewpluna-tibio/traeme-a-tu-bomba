import { useState, useEffect, useRef } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../firebase/config";
import { useAuth } from "../../context/AuthContext";
import { useServerTimeOffset } from "../../hooks/useServerTimeOffset";
import TableroElemental from "./TableroElemental";
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
  electrica: { nombre: "Eléctrica", icono: "⚡" },
  lianas: { nombre: "Lianas", icono: "🌿" },
  hielo: { nombre: "Hielo", icono: "❄️" },
};

export default function FaseJuegoElemental({ partidaId, partida }) {
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
    const intervalo = setInterval(() => {
      const restante = Math.max(0, Math.ceil((finalizaEn - (Date.now() + offset)) / 1000));
      setSegundosRestantes(restante);
      // Mientras mi propia jugada está en camino no pido el timeout: el
      // servidor debe recibirla y contarla (seguro de tiempo).
      if (restante === 0 && !procesandoRef.current) {
        verificarTimeoutTurnoElementalCallable({ partidaId }).catch((err) =>
          console.error("Error verificando timeout de turno:", err)
        );
      }
    }, 1000);
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
    electrica: "Eléctrica armada: toca el centro de la cruz (roba casillas del rival alrededor).",
    hielo: "Hielo armado: toca la casilla propia que quieres marcar. El rival perderá su próximo turno.",
    "lianas-paso1": "Lianas: primero toca la casilla propia que quieres marcar.",
    "lianas-paso2": `Lianas: elige 3 casillas junto al rival para bloquear — se aplica sola al elegir la tercera (${bloqueoSeleccionado.length}/3).`,
  }[modo === null ? "null" : modo];

  return (
    <div className="fase-juego-elemental">
      <div className="elemental-marcador">
        <span className={`elemental-marcador-color elemental-marcador-${miJugador.color}`}>
          Tú: {miJugador.casillasMarcadas || 0}
        </span>
        <span className={`elemental-marcador-color elemental-marcador-${rivalJugador.color}`}>
          Rival: {rivalJugador.casillasMarcadas || 0}
        </span>
      </div>

      {esMiTurno ? (
        <p className="turno-activo">
          Tu turno{" "}
          {procesando
            ? "(enviando jugada...)"
            : segundosRestantes !== null && `(${segundosRestantes}s)`}
        </p>
      ) : (
        <p className="turno-espera">
          {estoyCongelado ? "Congelado — " : ""}
          Turno del rival {segundosRestantes !== null && `(${segundosRestantes}s)`}
        </p>
      )}

      {esMiTurno && <p className="elemental-instruccion">{mensajeModo}</p>}
      {error && <p className="error-text">{error}</p>}

      <div className="elemental-inventarios">
        <div className="elemental-inventario">
          <p className="elemental-inventario-titulo">Tus bombas</p>
          <div className="elemental-bombas">
            {Object.entries(NOMBRES_BOMBA).map(([tipo, { nombre, icono }]) => {
              const disponible = miJugador.bombas?.[tipo];
              const armada = modo === tipo || (tipo === "lianas" && modo?.startsWith("lianas"));
              return (
                <button
                  key={tipo}
                  className={`elemental-bomba-btn ${!disponible ? "elemental-bomba-usada" : ""} ${armada ? "elemental-bomba-armada" : ""}`}
                  disabled={!disponible || !esMiTurno || procesando || (modo !== null && !armada)}
                  onClick={() => armarBomba(tipo)}
                  title={disponible ? `Usar ${nombre}` : `${nombre} ya usada`}
                >
                  {icono} {nombre}
                </button>
              );
            })}
          </div>
        </div>

        <div className="elemental-inventario">
          <p className="elemental-inventario-titulo">Bombas del rival</p>
          <div className="elemental-bombas">
            {Object.entries(NOMBRES_BOMBA).map(([tipo, { nombre, icono }]) => {
              const disponible = rivalJugador.bombas?.[tipo];
              return (
                <span
                  key={tipo}
                  className={`elemental-bomba-rival ${!disponible ? "elemental-bomba-usada" : ""}`}
                >
                  {icono} {nombre}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {modo !== null && (
        <div className="elemental-acciones-modo">
          <button onClick={cancelarModo} disabled={procesando} className="elemental-cancelar">
            Cancelar
          </button>
        </div>
      )}

      <TableroElemental
        partida={partida}
        colorPorUid={colorPorUid}
        casillasResaltadas={casillasResaltadas}
        casillasSeleccionadas={casillasSeleccionadas}
        onCasillaClick={handleCasillaClick}
        deshabilitado={!esMiTurno || procesando}
        casillaEnProceso={casillaEnProceso}
      />
    </div>
  );
}