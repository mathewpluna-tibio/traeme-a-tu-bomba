export default function StatsPanel({ profile, modalidad }) {
  if (modalidad === "general") {
    return <VistaGeneral estadisticas={profile.estadisticas} />;
  }

  const stats = profile.estadisticas?.[modalidad];

  if (!stats) {
    return <p>No hay estadísticas disponibles para esta modalidad.</p>;
  }

  // Consideramos "sin partidas" cuando victorias + derrotas (+ empates si aplica) es 0
  const totalPartidas =
    (stats.victorias || 0) +
    (stats.derrotas || 0) +
    (stats.empates || 0);

  if (totalPartidas === 0) {
    return <p>No hay estadísticas disponibles para esta modalidad.</p>;
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
    <div className="stats-panel">
      <h3>Vista General</h3>
      <p>Victorias totales: {totalVictorias}</p>
      <p>Derrotas totales: {totalDerrotas}</p>
    </div>
  );
}

function StatsEstandarVenenosas({ stats }) {
  return (
    <div className="stats-panel">
      <p>Elo: {stats.elo}</p>
      <p>Rango: {stats.rango}</p>
      <p>Victorias: {stats.victorias}</p>
      <p>Derrotas: {stats.derrotas}</p>
      <p>Vidas perdidas: {stats.vidasPerdidas}</p>
      <p>Partidas sin perder vida: {stats.partidasSinPerderVida}</p>
    </div>
  );
}

function StatsElementales({ stats }) {
  return (
    <div className="stats-panel">
      <p>Elo: {stats.elo}</p>
      <p>Rango: {stats.rango}</p>
      <p>Victorias: {stats.victorias}</p>
      <p>Derrotas: {stats.derrotas}</p>
      <p>Empates: {stats.empates}</p>
      <p>Casillas marcadas: {stats.casillasMarcadas}</p>
      <p>Bombas de hielo usadas: {stats.bombasHieloUsadas}</p>
    </div>
  );
}