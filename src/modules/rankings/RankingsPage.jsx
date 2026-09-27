import { useState } from "react";
import { useRanking } from "../../hooks/useRanking";
import { MODALIDADES, CATEGORIAS_POR_MODALIDAD } from "./rankingsConfig";
import UserBomb from "../../assets/UserBomb.png";
import "./RankingsPage.css";

const ICONO_POR_RANGO = {
  "Cadetes Bomberos": "💥",
  "Entusiastas de las Explosiones": "💥",
  "Genios Explosivos": "💥",
  "Señor de las Bombas": "💥",
};

function medalFor(posicion) {
  if (posicion === 1) return "🥇";
  if (posicion === 2) return "🥈";
  if (posicion === 3) return "🥉";
  return null;
}

export default function RankingsPage({ onVolver, onVerPerfil }) {
  const [modalidad, setModalidad] = useState("estandar");
  const [categoria, setCategoria] = useState("elo");

  const categoriasDisponibles = CATEGORIAS_POR_MODALIDAD[modalidad];
  const { jugadores, loading, error } = useRanking(modalidad, categoria);

  const cambiarModalidad = (nuevaModalidad) => {
    setModalidad(nuevaModalidad);
    setCategoria("elo");
  };

  const etiquetaCategoria = categoriasDisponibles.find((c) => c.key === categoria)?.label;

  return (
    <div className="rankings-page">
      <button className="rk-back" onClick={onVolver}>← Volver al menú</button>

      <header className="rk-header">
        <h1 className="rk-title">
          <span className="rk-title-icon">🏆</span>
          Ranking Competitivo
        </h1>

        <div className="rk-mode-tabs">
          {MODALIDADES.map((m) => (
            <button
              key={m.key}
              className={"rk-mode-tab" + (modalidad === m.key ? " rk-mode-tab--active" : "")}
              onClick={() => cambiarModalidad(m.key)}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="rk-category-tabs">
          {categoriasDisponibles.map((c) => (
            <button
              key={c.key}
              className={"rk-category-tab" + (categoria === c.key ? " rk-category-tab--active" : "")}
              onClick={() => setCategoria(c.key)}
            >
              {c.label}
            </button>
          ))}
        </div>
      </header>

      {loading && <p className="rk-status">Cargando ranking...</p>}
      {error && <p className="rk-status rk-status--error">{error}</p>}
      {!loading && !error && jugadores.length === 0 && (
        <p className="rk-status">Aún no hay jugadores en este ranking.</p>
      )}

      {!loading && !error && jugadores.length > 0 && (
        <div className="rk-table">
          <div className="rk-table-head">
            <span className="rk-col rk-col-pos">#</span>
            <span className="rk-col rk-col-player">Jugador</span>
            <span className="rk-col rk-col-tier">Rango</span>
            <span className="rk-col rk-col-stat">{etiquetaCategoria}</span>
          </div>

          <div className="rk-list">
            {jugadores.map((j) => {
              const medalla = medalFor(j.posicion);
              return (
                <button
                  key={j.uid}
                  className={"rk-row" + (j.posicion <= 3 ? " rk-row--top" : "")}
                  onClick={() => onVerPerfil(j.uid)}
                >
                  <span className="rk-col rk-col-pos">
                    {medalla ? (
                      <span className="rk-medal">{medalla}</span>
                    ) : (
                      <span className="rk-pos-number">{j.posicion}</span>
                    )}
                  </span>

                  <span className="rk-col rk-col-player">
                    <img className="rk-avatar" src={j.fotoPerfil || UserBomb} alt={j.username} />
                    <span className="rk-name">{j.username}</span>
                  </span>

                  <span className="rk-col rk-col-tier">
                    <span className="rk-tier-badge">
                      <span>{ICONO_POR_RANGO[j.rango] || "💥"}</span>
                      {j.rango}
                    </span>
                  </span>

                  <span className="rk-col rk-col-stat">{j.valor}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}