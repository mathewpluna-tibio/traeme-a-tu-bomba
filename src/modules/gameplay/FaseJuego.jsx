import { useState, useEffect } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../firebase/config";
import { useAuth } from "../../context/AuthContext";
import { useServerTimeOffset } from "../../hooks/useServerTimeOffset";
import Tablero from "./Tablero";
import CargasVeneno from "./CargasVeneno.jsx";

const activarCasillaCallable = httpsCallable(functions, "activarCasilla");
const verificarTimeoutJuegoCallable = httpsCallable(functions, "verificarTimeoutJuego");

export default function FaseJuego({ partidaId, partida }) {
  const { user } = useAuth();
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState("");
  const [segundosRestantes, setSegundosRestantes] = useState(null);
  const [casillaEnProceso, setCasillaEnProceso] = useState(null);
  const tickVenenoCallable = httpsCallable(functions, "tickVeneno");
  const offset = useServerTimeOffset();

  const esMiTurno = partida.turnoJuego?.uidActivo === user.uid;
  const finalizaEn = partida.turnoJuego?.finalizaEn;

  useEffect(() => {
    if (!finalizaEn) {
      setSegundosRestantes(null);
      return;
    }
    const intervalo = setInterval(() => {
      const restante = Math.max(0, Math.ceil((finalizaEn - (Date.now() + offset)) / 1000));
      setSegundosRestantes(restante);
      if (restante === 0) {
        verificarTimeoutJuegoCallable({ partidaId }).catch((err) =>
          console.error("Error verificando timeout de juego:", err)
        );
      }
    }, 1000);
    return () => clearInterval(intervalo);
  }, [finalizaEn, partidaId, offset]);

  useEffect(() => {
    if (partida.modalidad !== "venenosas") return;

    const intervalo = setInterval(() => {
      tickVenenoCallable({ partidaId }).catch((err) =>
        console.error("Error en tick de veneno:", err)
      );
    }, 2000); // cada 2s, suficientemente frecuente sin saturar

  return () => clearInterval(intervalo);
}, [partida.modalidad, partidaId]);

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

  const miVida = partida.jugadores?.[user.uid]?.vidas ?? 0;
  const rivalUid = Object.keys(partida.jugadores || {}).find((id) => id !== user.uid);
  const vidaRival = partida.jugadores?.[rivalUid]?.vidas ?? 0;

  return (
    <div className="fase-juego">
      <p>Tus vidas: {"❤️".repeat(Math.ceil(miVida))} ({miVida})</p>
      <p>Vidas del rival: {"❤️".repeat(Math.ceil(vidaRival))} ({vidaRival})</p>

      {partida.modalidad === "venenosas" && (
        <CargasVeneno cargas={partida.jugadores?.[user.uid]?.cargasVeneno || []} />
      )}

      {esMiTurno ? (
        <p className="turno-activo">
          Tu turno {segundosRestantes !== null && `(${segundosRestantes}s)`}
        </p>
      ) : (
        <p className="turno-espera">
          Turno del rival {segundosRestantes !== null && `(${segundosRestantes}s)`}
        </p>
      )}
      {error && <p className="error-text">{error}</p>}

      <Tablero
        casillas={partida.casillas}
        onCasillaClick={handleCasillaClick}
        deshabilitado={!esMiTurno || procesando}
        casillaEnProceso={casillaEnProceso}
      />
    </div>
  );
}