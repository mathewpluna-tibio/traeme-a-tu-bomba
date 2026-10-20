import { useState, useEffect } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../firebase/config";
import { useAuth } from "../../context/AuthContext";
import { useServerTimeOffset } from "../../hooks/useServerTimeOffset";
import Tablero from "./Tablero";
import HudPartida from "./HudPartida";
import { IMAGEN_BOMBA } from "./bombasAssets";

const activarCasillaCallable = httpsCallable(functions, "activarCasilla");
const verificarTimeoutJuegoCallable = httpsCallable(functions, "verificarTimeoutJuego");
const tickVenenoCallable = httpsCallable(functions, "tickVeneno");

const TICK_VENENO_MS = 10000;

function ExtraVeneno({ cargas = [], ahora }) {
  if (cargas.length === 0) return null;
  const proximo = Math.min(...cargas.map((c) => c.ultimoTick + TICK_VENENO_MS));
  const segundos = Math.max(0, Math.ceil((proximo - ahora) / 1000));
  return (
    <div className="gp-extra gp-extra--veneno" title={`${cargas.length} cargas de veneno (-${(cargas.length * 0.25).toFixed(2)} vidas cada 10 s)`}>
      <img className="gp-extra-img" src={IMAGEN_BOMBA.veneno} alt="" />
      <span className="gp-extra-num">×{cargas.length}</span>
      <span className="gp-extra-timer">{segundos}s</span>
    </div>
  );
}

export default function FaseJuego({ partidaId, partida, perfiles = {} }) {
  const { user } = useAuth();
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState("");
  const [segundosRestantes, setSegundosRestantes] = useState(null);
  const [casillaEnProceso, setCasillaEnProceso] = useState(null);
  const [ahora, setAhora] = useState(Date.now());
  const offset = useServerTimeOffset();

  const esVenenosas = partida.modalidad === "venenosas";
  const esMiTurno = partida.turnoJuego?.uidActivo === user.uid;
  const finalizaEn = partida.turnoJuego?.finalizaEn;
  // Estándar: tras una detonación el servidor congela el turno hasta que
  // termina el sonido de la explosión y luego cambia de ronda.
  const detonando = !partida.turnoJuego && !!partida.detonacion;

  useEffect(() => {
    if (!finalizaEn) {
      setSegundosRestantes(null);
      return;
    }
    const tick = () => {
      const restante = Math.max(0, Math.ceil((finalizaEn - (Date.now() + offset)) / 1000));
      setSegundosRestantes(restante);
      if (restante === 0) {
        verificarTimeoutJuegoCallable({ partidaId }).catch((err) =>
          console.error("Error verificando timeout de juego:", err)
        );
      }
    };
    tick();
    const intervalo = setInterval(tick, 1000);
    return () => clearInterval(intervalo);
  }, [finalizaEn, partidaId, offset]);

  useEffect(() => {
    if (!esVenenosas) return;
    const intervalo = setInterval(() => {
      setAhora(Date.now() + offset);
      tickVenenoCallable({ partidaId }).catch((err) => console.error("Error en tick de veneno:", err));
    }, 2000);
    const reloj = setInterval(() => setAhora(Date.now() + offset), 500);
    return () => {
      clearInterval(intervalo);
      clearInterval(reloj);
    };
  }, [esVenenosas, partidaId, offset]);

  const handleCasillaClick = async (casillaClave) => {
    if (procesando || !esMiTurno) return;
    setProcesando(true);
    setCasillaEnProceso(casillaClave); // feedback inmediato, antes de llamar al servidor
    setError("");
    try {
      await activarCasillaCallable({ partidaId, casillaClave });
    } catch (err) {
      console.error("Error al activar casilla:", err);
      setError(err.message || "No se pudo activar la casilla.");
    } finally {
      setProcesando(false);
      setCasillaEnProceso(null);
    }
  };

  const rivalUid = Object.keys(partida.jugadores || {}).find((id) => id !== user.uid);
  const yo = partida.jugadores?.[user.uid] || {};
  const rival = partida.jugadores?.[rivalUid] || {};

  const casillas = Object.values(partida.casillas || {});
  const segurasRestantes = casillas.filter((c) => !(c.bombas?.length > 0) && c.segura !== true).length;

  let estado;
  if (detonando) {
    estado = partida.detonacion.uid === user.uid ? "¡Boom! Activaste una bomba" : "¡Boom! El rival activó una bomba";
  } else if (esMiTurno) {
    estado = "Tu turno: elige una casilla";
  } else {
    estado = "Turno del rival";
  }

  return (
    <>
      <HudPartida
        titulo={`Ronda ${partida.ronda}`}
        fase={detonando ? "Detonación" : "En juego"}
        segundos={segundosRestantes}
        centro={
          <span className="gp-safe" title="Casillas seguras sin descubrir">
            <span className="gp-safe-icon" /> {segurasRestantes}
          </span>
        }
        yo={{
          perfil: perfiles[user.uid],
          vidas: yo.vidas,
          enTurno: esMiTurno,
          extra: esVenenosas ? <ExtraVeneno cargas={yo.cargasVeneno || []} ahora={ahora} /> : null,
        }}
        rival={{
          perfil: perfiles[rivalUid],
          vidas: rival.vidas,
          enTurno: !esMiTurno && !detonando,
          extra: esVenenosas ? <ExtraVeneno cargas={rival.cargasVeneno || []} ahora={ahora} /> : null,
        }}
      />

      <div className={"gp-status" + (esMiTurno ? " gp-status--activo" : "") + (detonando ? " gp-status--boom" : "")}>
        {estado}
      </div>
      {error && <p className="gp-error">{error}</p>}

      <Tablero
        casillas={partida.casillas}
        onCasillaClick={handleCasillaClick}
        deshabilitado={!esMiTurno || procesando || detonando}
        casillaEnProceso={casillaEnProceso}
      />
    </>
  );
}