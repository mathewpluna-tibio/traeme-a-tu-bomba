import { useEffect, useState } from "react";
import { ref, onValue } from "firebase/database";
import { httpsCallable } from "firebase/functions";
import { rtdb, functions } from "../../firebase/config";
import { useAuth } from "../../context/AuthContext";
import { NOMBRE_MODALIDAD } from "./lobbyConfig";
import { CLASES_BOMBA } from "../menu/buscarPartidaConfig";
import { VisualBomba } from "../menu/BuscarPartidaUI";
import "./Lobby.css";

const unirseALobbyCallable = httpsCallable(functions, "unirseALobby");
const rechazarRetoCallable = httpsCallable(functions, "rechazarReto");

export default function LobbyEntrante({ lobbyId, onCerrar }) {
  const { user } = useAuth();
  const [lobby, setLobby] = useState(undefined); // undefined = cargando
  const [error, setError] = useState("");
  const [uniendose, setUniendose] = useState(false);

  useEffect(() => {
    return onValue(
      ref(rtdb, `lobbies/${lobbyId}`),
      (snap) => setLobby(snap.val()),
      () => setLobby(null)
    );
  }, [lobbyId]);

  const valido = lobby && lobby.estado === "esperando" && lobby.creador !== user?.uid;

  const unirse = async (clase) => {
    if (uniendose) return;
    setUniendose(true);
    setError("");
    try {
      await unirseALobbyCallable({ lobbyId, clase: clase || null });
      // La partida llega por notificacionesPartida; solo quitamos el overlay.
      onCerrar();
    } catch (err) {
      console.error("Error al unirse al lobby:", err);
      setError(err.message || "No se pudo entrar al lobby.");
      setUniendose(false);
    }
  };

  const rechazar = async () => {
    if (lobby?.uidRetado === user?.uid) {
      try {
        await rechazarRetoCallable({ lobbyId });
      } catch (err) {
        console.error("Error al rechazar reto:", err);
      }
    }
    onCerrar();
  };

  return (
    <div className="lobby-overlay">
      <div className="lobby-modal">
        {lobby === undefined && <p>Cargando lobby...</p>}

        {lobby !== undefined && !valido && (
          <>
            <h3>Enlace no válido</h3>
            <p className="lobby-texto">
              {lobby && lobby.creador === user?.uid
                ? "Este es tu propio lobby."
                : "Este lobby ya no está disponible (la partida inició o fue cancelada)."}
            </p>
            <button className="lobby-btn" onClick={onCerrar}>Cerrar</button>
          </>
        )}

        {valido && (
          <>
            <h3>
              {lobby.uidRetado ? "¡Te retaron!" : "Invitación a partida privada"}
            </h3>
            <p className="lobby-texto">
              <strong>{lobby.creadorUsername}</strong> te invita a jugar{" "}
              <strong>{NOMBRE_MODALIDAD[lobby.modalidad]}</strong> (sin Elo ni coronas).
            </p>

            {lobby.modalidad === "estandar" ? (
              <>
                <p className="lobby-texto">Elige tu clase de bomba para empezar:</p>
                <div className="lobby-clases">
                  {CLASES_BOMBA.map((c) => (
                    <button key={c.id} className="lobby-btn lobby-clase" disabled={uniendose} onClick={() => unirse(c.id)}>
                      <span className="lobby-clase-img"><VisualBomba item={c} /></span>
                      {c.nombre}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <button className="lobby-btn lobby-btn--primary" disabled={uniendose} onClick={() => unirse(null)}>
                Aceptar y jugar
              </button>
            )}

            {error && <p className="lobby-error">{error}</p>}

            <button className="lobby-cancelar" onClick={rechazar} disabled={uniendose}>
              {lobby.uidRetado ? "Rechazar" : "Cancelar"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}