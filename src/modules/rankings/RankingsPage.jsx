import { useState } from "react";
import { useRanking } from "../../hooks/useRanking";
import { MODALIDADES, CATEGORIAS_POR_MODALIDAD } from "./rankingsConfig";
import "./RankingsPage.css";

export default function RankingsPage({ onVolver }) {
  const [modalidad, setModalidad] = useState("estandar");
  const [categoria, setCategoria] = useState("elo");

  const categoriasDisponibles = CATEGORIAS_POR_MODALIDAD[modalidad];
  const { jugadores, loading, error } = useRanking(modalidad, categoria);

  const cambiarModalidad = (nuevaModalidad) => {
    setModalidad(nuevaModalidad);
    setCategoria("elo"); // reinicia a Elo al cambiar de modalidad
  };

  return (
    <div className="rankings-page">
      <button onClick={onVolver} style={{ marginBottom: "12px" }}>← Volver al menú</button>
      
      <h2>Rankings — Top 100</h2>

      <div className="rankings-tabs-modalidad">
        {MODALIDADES.map((m) => (
          <button
            key={m.key}
            className={modalidad === m.key ? "activo" : ""}
            onClick={() => cambiarModalidad(m.key)}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="rankings-tabs-categoria">
        {categoriasDisponibles.map((c) => (
          <button
            key={c.key}
            className={categoria === c.key ? "activo" : ""}
            onClick={() => setCategoria(c.key)}
          >
            {c.label}
          </button>
        ))}
      </div>

      {loading && <p>Cargando ranking...</p>}
      {error && <p className="error-text">{error}</p>}

      {!loading && !error && jugadores.length === 0 && (
        <p>Aún no hay jugadores en este ranking.</p>
      )}

      {!loading && !error && jugadores.length > 0 && (
        <table className="rankings-tabla">
          <thead>
            <tr>
              <th>#</th>
              <th>Jugador</th>
              <th>{categoriasDisponibles.find((c) => c.key === categoria)?.label}</th>
            </tr>
          </thead>
          <tbody>
            {jugadores.map((j) => (
              <tr key={j.uid}>
                <td>{j.posicion}</td>
                <td>{j.username}</td>
                <td>{j.valor}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}