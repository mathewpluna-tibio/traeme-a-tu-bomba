import { useEffect, useState } from "react";
import { ref, onValue } from "firebase/database";
import { httpsCallable } from "firebase/functions";
import { rtdb, functions } from "../../firebase/config";
import { useAuth } from "../../context/AuthContext";
import { NOMBRE_MODALIDAD } from "./lobbyConfig";
import "./Lobby.css";

const rechazarRetoCallable = httpsCallable(functions, "rechazarReto");

function Reto({ lobbyId, reto, onAceptar }) {
  const [estado, setEstado] = useState(null);
  const [ahora, setAhora] = useState(() => Date.now());

  // RQF-AMI-02B: cuenta regresiva hasta que el reto expire.
  useEffect(() => {
    if (!reto.expiraEn) return;
    const id = setInterval(() => setAhora(Date.now()), 500);
    return () => clearInterval(id);
  }, [reto.expiraEn]);

  // El reto deja de mostrarse en cuanto el lobby ya no está esperando
  // (el retador canceló, se desconectó o la partida ya inició).
  useEffect(() => {
    return onValue(ref(rtdb, `lobbies/${lobbyId}/estado`), (snap) => setEstado(snap.val()));
  }, [lobbyId]);

  const segundos = reto.expiraEn ? Math.max(0, Math.ceil((reto.expiraEn - ahora) / 1000)) : null;
  if (estado !== "esperando" || segundos === 0) return null;

  return (
    <div className="reto-toast">
      <p>
        <strong>{reto.deUsername}</strong> te reta a{" "}
        <strong>{NOMBRE_MODALIDAD[reto.modalidad]}</strong>
      </p>
      {segundos != null && <p className="reto-cuenta">Expira en {segundos} s</p>}
      <div>
        <button className="lobby-btn lobby-btn--primary" onClick={() => onAceptar(lobbyId)}>
          Aceptar
        </button>
        <button
          className="lobby-btn"
          onClick={() => rechazarRetoCallable({ lobbyId }).catch((e) => console.error(e))}
        >
          Rechazar
        </button>
      </div>
    </div>
  );
}

// Retos recibidos de otros jugadores (RQF-SOC-02).
export default function InvitacionesRetos({ onAceptar }) {
  const { user } = useAuth();
  const [retos, setRetos] = useState({});

  useEffect(() => {
    if (!user) return;
    return onValue(ref(rtdb, `invitaciones/${user.uid}`), (snap) => setRetos(snap.val() || {}));
  }, [user]);

  const ids = Object.keys(retos);
  if (ids.length === 0) return null;

  return (
    <div className="retos-contenedor">
      {ids.map((id) => (
        <Reto key={id} lobbyId={id} reto={retos[id]} onAceptar={onAceptar} />
      ))}
    </div>
  );
}