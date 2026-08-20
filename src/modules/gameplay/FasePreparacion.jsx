import { useState, useEffect, useRef } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../firebase/config";
import { useAuth } from "../../context/AuthContext";
import Tablero from "./Tablero";

const colocarBombaCallable = httpsCallable(functions, "colocarBomba");
const finalizarTurnoCallable = httpsCallable(functions, "finalizarTurnoColocacion");

export default function FasePreparacion({ partidaId, partida }) {
  const { user } = useAuth();
  const [colocando, setColocando] = useState(false);
  const [error, setError] = useState("");
  const yaFinalizoTurno = useRef(false); // evita llamar dos veces al agotar bombas

  const miInfo = partida.jugadores?.[user.uid];
  const bombasRestantes = miInfo?.bombasDisponibles ?? 0;
  const esMiTurno = partida.turnoColocacion?.uidActivo === user.uid;

  // Cuando se me acaben las bombas Y sea mi turno, finalizo automáticamente
  useEffect(() => {
    if (esMiTurno && bombasRestantes === 0 && !yaFinalizoTurno.current) {
      yaFinalizoTurno.current = true;
      finalizarTurnoCallable({ partidaId }).catch((err) => {
        console.error("Error al finalizar turno:", err);
        yaFinalizoTurno.current = false; // permite reintentar si falló
      });
    }
  }, [esMiTurno, bombasRestantes, partidaId]);

  // Si vuelve a ser mi turno más adelante (no debería pasar en esta fase,
  // pero por seguridad reseteamos la guardia)
  useEffect(() => {
    if (!esMiTurno) {
      yaFinalizoTurno.current = false;
    }
  }, [esMiTurno]);

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
        <p className="turno-activo">Tu turno — coloca tus bombas</p>
      ) : (
        <p className="turno-espera">Esperando al rival...</p>
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