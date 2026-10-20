import { useRef } from "react";
import "./PartidaScreen.css";
import { usePartida } from "../../hooks/usePartida";
import { usePerfilesPartida } from "../../hooks/usePerfilesPartida";
import { useAuth } from "../../context/AuthContext";
import { useEfectosPartida } from "./efectos/useEfectosPartida";
import Tablero from "./Tablero";
import TableroElemental from "./TableroElemental";
import FasePreparacion from "./FasePreparacion";
import ModalResultados from "./ModalResultados";
import FaseJuego from "./FaseJuego";
import FaseJuegoElemental from "./FaseJuegoElemental";
import InvitacionesRetos from "../lobby/InvitacionesRetos";
import LobbyEntrante from "../lobby/LobbyEntrante";

const NOMBRE_MODALIDAD = {
  estandar: "Estándar",
  venenosas: "Bombas Venenosas",
  elementales: "Bombas Elementales",
};

const NOMBRE_TABLERO = { cuadrado: "Cuadrado", rectangulo: "Rectángulo", anillo: "Anillo" };

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
  const perfiles = usePerfilesPartida(Object.keys(partida?.jugadores || {}));
  const contenedorRef = useRef(null);
  // Animaciones y sonidos de colocación, activación y detonación (RQF-TAB-03).
  useEfectosPartida(partida, contenedorRef);

  if (loading) return <div className="gp-page gp-page--centro"><p className="gp-muted">Cargando partida...</p></div>;
  if (!partida) return <div className="gp-page gp-page--centro"><p className="gp-muted">No se encontró la partida.</p></div>;

  if (partida.estado === "cancelada") {
    return (
      <div className="gp-page gp-page--centro">
        <div className="gp-aviso">
          <h2>Partida cancelada</h2>
          <p>Ningún jugador colocó bombas durante la fase de preparación.</p>
          <button type="button" className="gp-btn gp-btn--primario" onClick={onVolverAlMenu}>Volver al menú</button>
        </div>
      </div>
    );
  }

  if (!partida.casillas) {
    return <div className="gp-page gp-page--centro"><p className="gp-muted">Generando tablero...</p></div>;
  }

  const esElementales = partida.modalidad === "elementales";
  const subtitulo = [NOMBRE_MODALIDAD[partida.modalidad] || partida.modalidad, !esElementales && NOMBRE_TABLERO[partida.tablero]]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="gp-page">
      <div className="gp-container" ref={contenedorRef}>
        <p className="gp-modalidad">{subtitulo}</p>

        {partida.estado === "preparacion" && (
          <FasePreparacion partidaId={partidaId} partida={partida} perfiles={perfiles} />
        )}
        {partida.estado === "en_curso" && esElementales && (
          <FaseJuegoElemental partidaId={partidaId} partida={partida} perfiles={perfiles} />
        )}
        {partida.estado === "en_curso" && !esElementales && (
          <FaseJuego partidaId={partidaId} partida={partida} perfiles={perfiles} />
        )}

        {/* Al terminar, el tablero final queda de fondo detrás del resultado. */}
        {partida.estado === "finalizada" &&
          (esElementales ? (
            <TableroElemental partida={partida} colorPorUid={colorPorUid(partida)} onCasillaClick={() => {}} deshabilitado relleno={null} />
          ) : (
            <Tablero casillas={partida.casillas} onCasillaClick={() => {}} deshabilitado />
          ))}
      </div>

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

function colorPorUid(partida) {
  return Object.fromEntries(Object.entries(partida.jugadores || {}).map(([uid, j]) => [uid, j.color]));
}