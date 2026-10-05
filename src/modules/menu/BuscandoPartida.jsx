import { useEffect, useState } from "react";
import { buscarModo, buscarClase } from "./buscarPartidaConfig";
import { PanelBuscar, VisualBomba } from "./BuscarPartidaUI";

function formatoTiempo(segundos) {
  const m = String(Math.floor(segundos / 60)).padStart(2, "0");
  const s = String(segundos % 60).padStart(2, "0");
  return `${m}:${s}`;
}

export default function BuscandoPartida({ modalidad, clase, onCancelar }) {
  const [segundos, setSegundos] = useState(0);
  const [cancelando, setCancelando] = useState(false);
  const modo = buscarModo(modalidad);
  const claseBomba = buscarClase(clase);
  const visual = claseBomba || modo;

  useEffect(() => {
    const id = setInterval(() => setSegundos((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const cancelar = async () => {
    setCancelando(true);
    await onCancelar();
  };

  return (
    <PanelBuscar titulo="Buscar partida" paso="busqueda" conClase={!!modo?.tieneClase}>
      <div className="sm-status">
        <div className="sm-status-visual sm-status-visual--pulse">{visual && <VisualBomba item={visual} />}</div>
        <h2 className="sm-status-title">Buscando rival...</h2>
        <p className="sm-status-text">Te avisaremos en cuanto encontremos uno.</p>
        <div className="sm-chips">
          {[modo, claseBomba].filter(Boolean).map((i) => (
            <span key={i.id} className="sm-chip">{i.nombre}</span>
          ))}
        </div>
        <p className="sm-timer">{formatoTiempo(segundos)}</p>
        <button className="sm-btn sm-btn--danger" onClick={cancelar} disabled={cancelando}>
          Cancelar búsqueda
        </button>
      </div>
    </PanelBuscar>
  );
}