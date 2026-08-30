const RANGOS = [
  { nombre: "Cadetes Bomberos", min: 0, max: 299 },
  { nombre: "Entusiastas de las Explosiones", min: 300, max: 699 },
  { nombre: "Genios Explosivos", min: 700, max: 999 },
  { nombre: "Señor de las Bombas", min: 1000, max: Infinity },
];

function determinarRango(elo) {
  const encontrado = RANGOS.find((r) => elo >= r.min && elo <= r.max);
  return encontrado ? encontrado.nombre : RANGOS[0].nombre;
}

// Tabla de puntos por victoria, según la diferencia de Elo con el rival.
// diferencia = eloPerdedor - eloGanador (positivo = el rival era más fuerte)
function calcularPuntosVictoria(eloGanador, eloPerdedor) {
  const diferencia = eloPerdedor - eloGanador;

  if (diferencia >= 61) return 33;
  if (diferencia >= 41) return 32;
  if (diferencia >= 21) return 31;
  if (diferencia >= -20) return 30;
  if (diferencia >= -40) return 29;
  if (diferencia >= -60) return 28;
  return 27;
}

module.exports = { RANGOS, determinarRango, calcularPuntosVictoria };