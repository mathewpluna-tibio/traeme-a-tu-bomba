import { useEffect, useState } from "react";
import { ref, onValue, onDisconnect } from "firebase/database";
import { httpsCallable } from "firebase/functions";
import { rtdb, functions } from "../../firebase/config";
import "./Lobby.css";

const cancelarLobbyCallable = httpsCallable(functions, "cancelarLobby");

export default function LobbyEspera({ lobbyId, esReto, onCancelar, onCerrado }) {
  const [copiado, setCopiado] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const enlace = `${window.location.origin}/?lobby=${lobbyId}`;

  useEffect(() => {
    const estadoRef = ref(rtdb, `lobbies/${lobbyId}/estado`);

    // Si el creador se desconecta, el lobby se cancela solo (así el enlace
    // y el reto dejan de servir).
    const alDesconectar = onDisconnect(estadoRef);
    alDesconectar.set("cancelada");

    const desuscribir = onValue(estadoRef, (snap) => {
      if (snap.val() === "cancelada") {
        onCerrado();
      }
    });

    return () => {
      desuscribir();
      alDesconectar.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lobbyId]);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(enlace);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      window.prompt("Copia el enlace:", enlace);
    }
  };

  const cancelar = async () => {
    setCancelando(true);
    try {
      await cancelarLobbyCallable({ lobbyId });
    } catch (err) {
      console.error("Error al cancelar lobby:", err);
    }
    onCancelar();
  };

  return (
    <div className="lobby-pantalla">
      <h2>Lobby privado</h2>
      <p className="lobby-texto">
        {esReto
          ? "Reto enviado. Esperando a que el jugador acepte..."
          : "Comparte este enlace con tu rival. La partida empieza en cuanto elija su clase."}
      </p>

      <div className="lobby-enlace">
        <input readOnly value={enlace} onFocus={(e) => e.target.select()} />
        <button onClick={copiar}>{copiado ? "¡Copiado!" : "Copiar"}</button>
      </div>

      <p className="lobby-nota">
        El enlace deja de funcionar cuando inicia la partida o cancelas el lobby.
      </p>

      <button className="lobby-cancelar" onClick={cancelar} disabled={cancelando}>
        Cancelar lobby
      </button>
    </div>
  );
}