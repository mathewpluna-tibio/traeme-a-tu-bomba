// Cada misión/logro define: id, descripción, tipo de evento que rastrea,
// objetivo (cuánto hay que acumular), y recompensa.

const MISIONES_DIARIAS = [
  { id: "jugar_3_estandar", descripcion: "Juega 3 partidas en modo Estándar", tipo: "partida_jugada_estandar", objetivo: 3, recompensaCoronas: 10 },
  { id: "descubrir_10_seguras", descripcion: "Descubre 10 casillas seguras", tipo: "casilla_segura_descubierta", objetivo: 10, recompensaCoronas: 10 },
  { id: "usar_bombota", descripcion: "Juega una partida usando la Bombota", tipo: "partida_con_bombota", objetivo: 1, recompensaCoronas: 8 },
  { id: "ganar_1_partida", descripcion: "Gana 1 partida", tipo: "victoria", objetivo: 1, recompensaCoronas: 12 },
  { id: "colocar_15_bombas", descripcion: "Coloca 15 bombas en total", tipo: "bomba_colocada", objetivo: 15, recompensaCoronas: 8 },
];

const LOGROS = [
  { id: "10_victorias_sin_perder_vida", descripcion: "Gana 10 partidas sin perder una sola vida", tipo: "victoria_sin_perder_vida", objetivo: 10, recompensaCoronas: 100, tituloDesbloqueado: "Intachable" },
  { id: "rango_genios_explosivos", descripcion: "Alcanza el rango de Genios Explosivos", tipo: "rango_alcanzado_genios", objetivo: 1, recompensaCoronas: 150, tituloDesbloqueado: "Genio Explosivo" },
  { id: "50_veneno_sobrevividas", descripcion: "Sobrevive 50 veces al veneno en el Modo Extra", tipo: "sobrevivencia_veneno", objetivo: 50, recompensaCoronas: 120, tituloDesbloqueado: "Inmune" },
];

module.exports = { MISIONES_DIARIAS, LOGROS };