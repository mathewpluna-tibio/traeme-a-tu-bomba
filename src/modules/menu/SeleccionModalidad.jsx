import { useState } from "react";
import { MODOS, buscarModo } from "./buscarPartidaConfig";
import { PanelBuscar, TarjetaBomba } from "./BuscarPartidaUI";

export default function SeleccionModalidad({ tipoAccion, onSeleccionar, onCancelar }) {
  const [modalidad, setModalidad] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const esLobby = tipoAccion === "lobby";
  const modo = buscarModo(modalidad);

  const confirmar = async () => {
    if (!modo || enviando) return;
    setEnviando(true);
    try {
      await onSeleccionar(modo.id);
    } finally {
      setEnviando(false);
    }
  };

  const textoBoton = !modo
    ? "Continuar"
    : modo.tieneClase
    ? "Continuar"
    : esLobby
    ? "Crear lobby"
    : "Buscar partida";

  return (
    <PanelBuscar
      titulo={esLobby ? "Crear lobby privado" : "Buscar partida"}
      paso="modo"
      conClase={!modo || modo.tieneClase}
      onAtras={onCancelar}
      pie={
        <button className="sm-btn sm-btn--primary" onClick={confirmar} disabled={!modo || enviando}>
          {textoBoton}
        </button>
      }
    >
      <p className="sm-subtitle">Elige la modalidad de juego</p>
      <div className="sm-card-grid sm-card-grid--3">
        {MODOS.map((m) => (
          <TarjetaBomba key={m.id} item={m} seleccionada={m.id === modalidad} onSeleccionar={setModalidad} deshabilitada={enviando} />
        ))}
      </div>
    </PanelBuscar>
  );
}