import { useState, useRef } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../firebase/config";
import { useAuth } from "../../context/AuthContext";
import { unirseACola } from "./matchmaking";
import { CLASES_BOMBA } from "./buscarPartidaConfig";
import { PanelBuscar, TarjetaBomba } from "./BuscarPartidaUI";

const crearLobbyCallable = httpsCallable(functions, "crearLobby");

export default function SeleccionClase({ tipoAccion, modalidad, uidRetado, onConfirmar, onCancelar, onAtras }) {
  const [claseId, setClaseId] = useState(null);
  const [confirmando, setConfirmando] = useState(false);
  const yaConfirmado = useRef(false); // evita que se busque dos veces partida
  const { user } = useAuth();
  const esLobby = tipoAccion === "lobby";

  const handleConfirmar = async () => {
    if (!claseId || yaConfirmado.current) return; // ignora cualquier segundo disparo
    yaConfirmado.current = true;
    setConfirmando(true);

    if (tipoAccion === "buscar") {
      await unirseACola(modalidad, user.uid, claseId, user.isAnonymous);
      onConfirmar(claseId);
      return;
    }

    // RQF-MEN-05: crear el lobby privado (y el reto, si se eligió a alguien)
    try {
      const resultado = await crearLobbyCallable({ modalidad, clase: claseId, uidRetado: uidRetado || null });
      onConfirmar(claseId, resultado.data.lobbyId);
    } catch (err) {
      console.error("Error al crear lobby:", err);
      alert(err.message || "No se pudo crear el lobby.");
      yaConfirmado.current = false;
      setConfirmando(false);
    }
  };

  return (
    <PanelBuscar
      titulo={esLobby ? "Crear lobby privado" : "Buscar partida"}
      paso="clase"
      conClase
      onAtras={confirmando ? null : onAtras || onCancelar}
      pie={
        <button className="sm-btn sm-btn--primary" onClick={handleConfirmar} disabled={!claseId || confirmando}>
          {esLobby ? "Crear lobby" : "Buscar partida"}
        </button>
      }
    >
      <p className="sm-subtitle">Elige tu clase de bomba</p>
      <div className="sm-card-grid sm-card-grid--4">
        {CLASES_BOMBA.map((c) => (
          <TarjetaBomba key={c.id} item={c} seleccionada={c.id === claseId} onSeleccionar={setClaseId} deshabilitada={confirmando} />
        ))}
      </div>
    </PanelBuscar>
  );
}