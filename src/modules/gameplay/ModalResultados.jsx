import { useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../firebase/config";

const enviarSolicitudCallable = httpsCallable(functions, "enviarSolicitudAmistad");

export default function ModalResultados({ partida, user, onVolverAlMenu, onJugarDeNuevo, onRevancha }) {
  const [solicitudEnviada, setSolicitudEnviada] = useState(false);
  const [enviandoSolicitud, setEnviandoSolicitud] = useState(false);
  const [errorSolicitud, setErrorSolicitud] = useState("");
  const [retando, setRetando] = useState(false);
  const [errorReto, setErrorReto] = useState("");

  const uidRival = Object.keys(partida.jugadores || {}).find((id) => id !== user.uid);
  const esVictoria = partida.resultado === "victoria" && partida.ganador === user.uid;
  const esDerrota = partida.resultado === "victoria" && partida.ganador !== user.uid;
  const esEmpate = partida.resultado === "empate";
  const misCasillas = partida.jugadores?.[user.uid]?.casillasMarcadas || 0;
  const casillasRival = partida.jugadores?.[uidRival]?.casillasMarcadas || 0;

  // En una partida privada "jugar de nuevo" es retar otra vez al mismo rival
  // (misma modalidad y clase), no volver al matchmaking general.
  const esPrivada = partida.tipo === "privada";

  const handleRevancha = async () => {
    if (retando) return;
    setRetando(true);
    setErrorReto("");
    try {
      await onRevancha(uidRival, partida.modalidad, partida.jugadores?.[user.uid]?.clase || null);
    } catch (err) {
      console.error("Error al retar nuevamente:", err);
      setErrorReto(err.message || "No se pudo enviar el reto.");
      setRetando(false);
    }
  };

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
        {esVictoria && <h2 className="gp-resultado gp-resultado--victoria">¡Victoria!</h2>}
        {esDerrota && <h2 className="gp-resultado gp-resultado--derrota">Derrota</h2>}
        {esEmpate && <h2 className="gp-resultado">Empate técnico</h2>}
        {partida.modalidad === "elementales" && (
          <div className="gp-marcador-final" title="Casillas marcadas">
            <span className="gp-marcador-final-num">{misCasillas}</span>
            <span className="gp-marcador-final-sep">-</span>
            <span className="gp-marcador-final-num">{casillasRival}</span>
            <span className="gp-marcador-final-leyenda">casillas marcadas (tú - rival)</span>
          </div>
        )}

        <div className="modal-resultados-botones">
          <button onClick={handleSolicitudAmistad} disabled={enviandoSolicitud || solicitudEnviada}>
            {solicitudEnviada ? "Solicitud enviada" : "Mandar solicitud de amistad"}
          </button>
          {errorSolicitud && <p className="error-text">{errorSolicitud}</p>}

          <button className="gp-btn--primario" onClick={onVolverAlMenu}>Volver al menú</button>

          {esPrivada ? (
            <>
              <button onClick={handleRevancha} disabled={retando}>
                {retando ? "Enviando reto..." : "Retar nuevamente"}
              </button>
              {errorReto && <p className="error-text">{errorReto}</p>}
            </>
          ) : (
            <button onClick={onJugarDeNuevo}>Buscar partida (Jugar de nuevo)</button>
          )}
        </div>
      </div>
    </div>
  );
}