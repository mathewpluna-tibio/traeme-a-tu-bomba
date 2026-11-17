import { usePosicionRanking } from "../../hooks/usePosicionRanking";

export default function StatsPanel({ profile, modalidad }) {
  return (
    <section className="pf-section">
      <h2 className="pf-section-title">Estadísticas</h2>
      <StatsContent profile={profile} modalidad={modalidad} />
    </section>
  );
}

function StatsContent({ profile, modalidad }) {
  if (modalidad === "general") {
    return <VistaGeneral estadisticas={profile.estadisticas} />;
  }

  const stats = profile.estadisticas?.[modalidad];

  if (!stats) {
    return <p className="pf-stats-empty">No hay estadísticas disponibles para esta modalidad.</p>;
  }

  // Consideramos "sin partidas" cuando victorias + derrotas (+ empates si aplica) es 0
  const totalPartidas =
    (stats.victorias || 0) +
    (stats.derrotas || 0) +
    (stats.empates || 0);

  if (totalPartidas === 0) {
    return <p className="pf-stats-empty">No hay estadísticas disponibles para esta modalidad.</p>;
  }

  if (modalidad === "elementales") {
    return <StatsElementales stats={stats} posicion={<PosicionRanking profile={profile} modalidad={modalidad} />} />;
  }

  return <StatsEstandarVenenosas stats={stats} posicion={<PosicionRanking profile={profile} modalidad={modalidad} />} />;
}

// RQF-PER-06: posición en el ranking global de la modalidad.
function PosicionRanking({ profile, modalidad }) {
  const posicion = usePosicionRanking(profile.estadisticas, modalidad);
  return <StatCard label="Posición en el ranking global" value={posicion ? `#${posicion}` : "..."} />;
}

// Las vidas pueden ser fraccionarias (MiniBomba quita 0.5).
function formatoVidas(v) {
  return Math.round((v || 0) * 100) / 100;
}

function VistaGeneral({ estadisticas }) {
  const modos = ["estandar", "venenosas", "elementales"];
  const totalVictorias = modos.reduce(
    (sum, m) => sum + (estadisticas[m]?.victorias || 0),
    0
  );
  const totalDerrotas = modos.reduce(
    (sum, m) => sum + (estadisticas[m]?.derrotas || 0),
    0
  );

  return (
    <div className="pf-stats-grid">
      <StatCard label="Victorias totales" value={totalVictorias} />
      <StatCard label="Derrotas totales" value={totalDerrotas} />
    </div>
  );
}

function StatsEstandarVenenosas({ stats, posicion }) {
  return (
    <div className="pf-stats-grid">
      <StatCard label="Elo" value={stats.elo} />
      <StatCard label="Rango" value={stats.rango} />
      {posicion}
      <StatCard label="Victorias" value={stats.victorias} />
      <StatCard label="Derrotas" value={stats.derrotas} />
      <StatCard label="Vidas perdidas" value={formatoVidas(stats.vidasPerdidas)} />
      <StatCard label="Vidas conservadas" value={formatoVidas(stats.vidasConservadas)} />
      <StatCard label="Partidas sin perder vida" value={stats.partidasSinPerderVida ?? 0} />
    </div>
  );
}

function StatsElementales({ stats, posicion }) {
  return (
    <div className="pf-stats-grid">
      <StatCard label="Elo" value={stats.elo} />
      <StatCard label="Rango" value={stats.rango} />
      {posicion}
      <StatCard label="Victorias" value={stats.victorias} />
      <StatCard label="Derrotas" value={stats.derrotas} />
      <StatCard label="Empates" value={stats.empates} />
      <StatCard label="Casillas marcadas" value={stats.casillasMarcadas} />
      <StatCard label="Bombas de hielo usadas" value={stats.bombasHieloUsadas} />
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="pf-stat-card">
      <span className="pf-stat-label">{label}</span>
      <span className="pf-stat-value">{value}</span>
    </div>
  );
}