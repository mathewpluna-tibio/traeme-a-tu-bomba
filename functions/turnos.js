function duracionTurnoJuego(ronda) {
  if (ronda === 1) return 7000;
  if (ronda === 2) return 6000;
  if (ronda === 3) return 5000;
  return 3000; // ronda 4+
}

module.exports = { duracionTurnoJuego };