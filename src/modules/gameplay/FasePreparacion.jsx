import { useState, useEffect, useRef } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../firebase/config";
import { useAuth } from "../../context/AuthContext";
import Tablero from "./Tablero";

const colocarBombaCallable = httpsCallable(functions, "colocarBomba");
const finalizarTurnoCallable = httpsCallable(functions, "finalizarTurnoColocacion");
const verificarTimeoutCallable = httpsCallable(functions, "verificarTimeoutColocacion");

const TIEMPO_VISIBLE_MS = 3000;

export default function FasePreparacion({ partidaId, partida }) {
  const { user } = useAuth();
  const [colocando, setColocando] = useState(false);
  const [error, setError] = useState("");
  const [segundosRestantes, setSegundosRestantes] = useState(null);
  const yaFinalizoTurno = useRef(false);

  const miInfo = partida.jugadores?.[user.uid];
  const bombasRestantes = miInfo?.bombasDisponibles ?? 0;
  const esMiTurno = partida.turnoColocacion?.uidActivo === user.uid;
  console.log("[FasePreparacion] uidActivo:", partida.turnoColocacion?.uidActivo, "| mi uid:", user.uid, "| esMiTurno:", esMiTurno, "| bombasRestantes:", bombasRestantes);
  const finalizaEn = partida.turnoColocacion?.finalizaEn;

  // Cuenta regresiva visual + verificación de timeout cada segundo
  useEffect(() => {
    if (!finalizaEn) {
      setSegundosRestantes(null);
      return;
    }

    const intervalo = setInterval(() => {
      const restante = Math.max(0, Math.ceil((finalizaEn - Date.now()) / 1000));
      setSegundosRestantes(restante);

      if (restante === 0) {
        // Cualquiera de los dos jugadores puede "avisar" al servidor;
        // el servidor decide con su propio reloj si de verdad expiró.
        verificarTimeoutCallable({ partidaId }).catch((err) =>
          console.error("Error verificando timeout:", err)
        );
      }
    }, 1000);

    return () => clearInterval(intervalo);
  }, [finalizaEn, partidaId]);

  // Cierre voluntario al agotar bombas (código existente, sin cambios)
  useEffect(() => {
    if (esMiTurno && bombasRestantes === 0 && !yaFinalizoTurno.current) {
      yaFinalizoTurno.current = true;
      finalizarTurnoCallable({ partidaId }).catch((err) => {
        console.error("Error al finalizar turno:", err);
        yaFinalizoTurno.current = false;
      });
    }
  }, [esMiTurno, bombasRestantes, partidaId]);

  useEffect(() => {
    if (!esMiTurno) yaFinalizoTurno.current = false;
  }, [esMiTurno]);

  useEffect(() => {
  if (!finalizaEn || !esMiTurno) {
    setSegundosRestantes(null);
    return;
  }

  const intervalo = setInterval(() => {
    const restante = Math.max(0, Math.ceil((finalizaEn - Date.now()) / 1000));
    setSegundosRestantes(restante);

    if (restante === 0 && esMiTurno) {
      verificarTimeoutCallable({ partidaId }).catch((err) =>
        console.error("Error verificando timeout:", err)
      );
    }
  }, 1000);

  return () => clearInterval(intervalo);
}, [finalizaEn, partidaId, esMiTurno]);

  const handleCasillaClick = async (casillaClave) => {
    if (colocando || !esMiTurno) return;
    if (bombasRestantes <= 0) return;

    setColocando(true);
    setError("");
    try {
      await colocarBombaCallable({ partidaId, casillaClave });
    } catch (err) {
      console.error("Error al colocar bomba:", err);
      setError(err.message || "No se pudo colocar la bomba.");
    } finally {
      setColocando(false);
    }
  };

  return (
    <div className="fase-preparacion">
      {esMiTurno ? (
        <p className="turno-activo">
          Tu turno — coloca tus bombas
          {segundosRestantes !== null && ` (${segundosRestantes}s)`}
        </p>
      ) : (
        <p className="turno-espera">
          Esperando al rival...
          {segundosRestantes !== null && ` (${segundosRestantes}s)`}
        </p>
      )}
      <p>Bombas disponibles: {bombasRestantes}</p>
      {error && <p className="error-text">{error}</p>}

      <Tablero
        casillas={partida.casillas}
        onCasillaClick={handleCasillaClick}
        deshabilitado={!esMiTurno || colocando || bombasRestantes <= 0}
      />
    </div>
  );
}