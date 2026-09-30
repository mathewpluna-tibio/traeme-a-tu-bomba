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
    return <StatsElementales stats={stats} />;
  }

  return <StatsEstandarVenenosas stats={stats} />;
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

function StatsEstandarVenenosas({ stats }) {
  return (
    <div className="pf-stats-grid">
      <StatCard label="Elo" value={stats.elo} />
      <StatCard label="Rango" value={stats.rango} />
      <StatCard label="Victorias" value={stats.victorias} />
      <StatCard label="Derrotas" value={stats.derrotas} />
      <StatCard label="Vidas perdidas" value={stats.vidasPerdidas} />
      <StatCard label="Partidas sin perder vida" value={stats.partidasSinPerderVida} />
    </div>
  );
}

function StatsElementales({ stats }) {
  return (
    <div className="pf-stats-grid">
      <StatCard label="Elo" value={stats.elo} />
      <StatCard label="Rango" value={stats.rango} />
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