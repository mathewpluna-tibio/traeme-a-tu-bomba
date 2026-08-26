import { useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../firebase/config";

const enviarSolicitudCallable = httpsCallable(functions, "enviarSolicitudAmistad");

export default function ModalResultados({ partida, user, onVolverAlMenu, onJugarDeNuevo }) {
  const [solicitudEnviada, setSolicitudEnviada] = useState(false);
  const [enviandoSolicitud, setEnviandoSolicitud] = useState(false);
  const [errorSolicitud, setErrorSolicitud] = useState("");

  const uidRival = Object.keys(partida.jugadores || {}).find((id) => id !== user.uid);
  const esVictoria = partida.resultado === "victoria" && partida.ganador === user.uid;
  const esDerrota = partida.resultado === "victoria" && partida.ganador !== user.uid;
  const esEmpate = partida.resultado === "empate";

  const handleSolicitudAmistad = async () => {
    if (enviandoSolicitud || solicitudEnviada) return;
    setEnviandoSolicitud(true);
    setErrorSolicitud("");
    try {
      await enviarSolicitudCallable({ uidDestino: uidRival });
      setSolicitudEnviada(true);
    } catch (err) {
      console.error("Error al enviar solicitud:", err);
      setErrorSolicitud(err.message || "No se pudo enviar la solicitud.");
    } finally {
      setEnviandoSolicitud(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-resultados">
        {esVictoria && <h2>¡Victoria! 🎉</h2>}
        {esDerrota && <h2>Derrota</h2>}
        {esEmpate && <h2>Empate técnico</h2>}

        <div className="modal-resultados-botones">
          <button onClick={handleSolicitudAmistad} disabled={enviandoSolicitud || solicitudEnviada}>
            {solicitudEnviada ? "Solicitud enviada ✓" : "Mandar solicitud de amistad"}
          </button>
          {errorSolicitud && <p className="error-text">{errorSolicitud}</p>}

          <button onClick={onVolverAlMenu}>Volver al menú</button>

          <button onClick={onJugarDeNuevo}>Buscar partida (Jugar de nuevo)</button>
        </div>
      </div>
    </div>
  );
}