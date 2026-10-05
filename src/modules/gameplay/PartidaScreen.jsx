import "./PartidaScreen.css";
import { usePartida } from "../../hooks/usePartida";
import { useAuth } from "../../context/AuthContext";
import Tablero from "./Tablero";
import FasePreparacion from "./FasePreparacion";
import ModalResultados from "./ModalResultados";
import FaseJuego from "./FaseJuego";
import FaseJuegoElemental from "./FaseJuegoElemental";
import InvitacionesRetos from "../lobby/InvitacionesRetos";
import LobbyEntrante from "../lobby/LobbyEntrante";

export default function PartidaScreen({
  partidaId,
  onVolverAlMenu,
  onJugarDeNuevo,
  onRevancha,
  lobbyEntrante,
  onAceptarReto,
  onCerrarLobbyEntrante,
}) {
  const { partida, loading } = usePartida(partidaId);
  const { user } = useAuth();

  if (loading) return <p>Cargando partida...</p>;
  if (!partida) return <p>No se encontró la partida.</p>;

  if (partida.estado === "cancelada") {
    return (
      <div className="partida-cancelada">
        <h2>Partida cancelada</h2>
        <p>Ningún jugador colocó bombas durante la fase de preparación.</p>
        <button onClick={onVolverAlMenu}>Volver al menú</button>
      </div>
    );
  }

  if (!partida.casillas) return <p>Generando tablero...</p>;

  const esElementales = partida.modalidad === "elementales";

  return (
    <div className="partida-screen">
      <h2>Partida en curso</h2>
      <p>Modalidad: {partida.modalidad}</p>
      {!esElementales && (
        <>
          <p>Tablero: {partida.tablero}</p>
          <p>Ronda: {partida.ronda}</p>
        </>
      )}
      <p>Estado: {partida.estado}</p>

      {partida.estado === "preparacion" && (
        <FasePreparacion partidaId={partidaId} partida={partida} />
      )}
      {partida.estado === "en_curso" && esElementales && (
        <FaseJuegoElemental partidaId={partidaId} partida={partida} />
      )}
      {partida.estado === "en_curso" && !esElementales && (
        <FaseJuego partidaId={partidaId} partida={partida} />
      )}
      {partida.estado === "finalizada" && (
        <ModalResultados
          partida={partida}
          user={user}
          onVolverAlMenu={onVolverAlMenu}
          onJugarDeNuevo={onJugarDeNuevo}
          onRevancha={onRevancha}
        />
      )}
      {/* Al terminar la partida sí se pueden recibir retos (p. ej. la revancha
          del rival); durante la partida no, para no interrumpirla. */}
      {partida.estado === "finalizada" && onAceptarReto && (
        <>
          <InvitacionesRetos onAceptar={onAceptarReto} />
          {lobbyEntrante && (
            <LobbyEntrante lobbyId={lobbyEntrante} onCerrar={onCerrarLobbyEntrante} />
          )}
        </>
      )}
    </div>
  );
}