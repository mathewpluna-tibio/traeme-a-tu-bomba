import "./PartidaScreen.css";
import { usePartida } from "../../hooks/usePartida";
import Tablero from "./Tablero";
import FasePreparacion from "./FasePreparacion";

export default function PartidaScreen({ partidaId }) {
  const { partida, loading } = usePartida(partidaId);

  if (loading) return <p>Cargando partida...</p>;
  if (!partida) return <p>No se encontró la partida.</p>;
  if (!partida.casillas) return <p>Generando tablero...</p>;

  return (
    <div className="partida-screen">
      <h2>Partida en curso</h2>
      <p>Modalidad: {partida.modalidad}</p>
      <p>Tablero: {partida.tablero}</p>
      <p>Ronda: {partida.ronda}</p>
      <p>Estado: {partida.estado}</p>

      {partida.estado === "preparacion" ? (
        <FasePreparacion partidaId={partidaId} partida={partida} />
      ) : (
        <Tablero casillas={partida.casillas} onCasillaClick={() => {}} deshabilitado />
      )}
    </div>
  );
}