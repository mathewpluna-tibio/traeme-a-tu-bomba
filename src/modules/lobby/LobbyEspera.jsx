import { useEffect, useState } from "react";
import { ref, onValue, onDisconnect } from "firebase/database";
import { httpsCallable } from "firebase/functions";
import { rtdb, functions } from "../../firebase/config";
import { buscarModo, buscarClase } from "../menu/buscarPartidaConfig";
import { PanelBuscar, VisualBomba } from "../menu/BuscarPartidaUI";
import "./Lobby.css";

const cancelarLobbyCallable = httpsCallable(functions, "cancelarLobby");

export default function LobbyEspera({ lobbyId, esReto, modalidad, clase, onCancelar, onCerrado }) {
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

  const modo = buscarModo(modalidad);
  const claseBomba = buscarClase(clase);
  const visual = claseBomba || modo;

  return (
    <PanelBuscar titulo="Crear lobby privado" paso="busqueda" conClase={!!modo?.tieneClase}>
      <div className="sm-status">
        <div className="sm-status-visual sm-status-visual--pulse">{visual && <VisualBomba item={visual} />}</div>
        <h2 className="sm-status-title">{esReto ? "Reto enviado" : "Lobby creado"}</h2>
        <p className="sm-status-text">
          {esReto
            ? "Esperando a que el jugador acepte el reto..."
            : "Comparte el enlace con tu rival. La partida inicia cuando se una y elija su clase."}
        </p>

        <div className="sm-chips">
          {[modo, claseBomba].filter(Boolean).map((i) => (
            <span key={i.id} className="sm-chip">{i.nombre}</span>
          ))}
        </div>

        <div className="sm-invite">
          <input className="sm-invite-input" type="text" readOnly value={enlace} onFocus={(e) => e.target.select()} />
          <button className="sm-btn sm-btn--secondary" onClick={copiar}>
            {copiado ? "¡Copiado!" : "Copiar"}
          </button>
        </div>

        <p className="sm-status-text">El enlace deja de funcionar cuando inicia la partida o cancelas el lobby.</p>

        <button className="sm-btn sm-btn--danger" onClick={cancelar} disabled={cancelando}>
          Cancelar lobby
        </button>
      </div>
    </PanelBuscar>
  );
}