// Cada misión/logro define: id, descripción, tipo de evento que rastrea,
// objetivo (cuánto hay que acumular), y recompensa (coronas, título,
// marco o banner - un logro puede dar más de una).

const MISIONES_DIARIAS = [
  { id: "jugar_3_estandar", descripcion: "Juega 3 partidas en modo Estándar", tipo: "partida_jugada_estandar", objetivo: 3, recompensaCoronas: 10 },
  { id: "descubrir_10_seguras", descripcion: "Descubre 10 casillas seguras", tipo: "casilla_segura_descubierta", objetivo: 10, recompensaCoronas: 10 },
  { id: "usar_bombota", descripcion: "Juega una partida usando la Bombota", tipo: "partida_con_bombota", objetivo: 1, recompensaCoronas: 8 },
  { id: "ganar_1_partida", descripcion: "Gana 1 partida", tipo: "victoria", objetivo: 1, recompensaCoronas: 12 },
  { id: "colocar_15_bombas", descripcion: "Coloca 15 bombas en total", tipo: "bomba_colocada", objetivo: 15, recompensaCoronas: 8 },
];

const LOGROS = [
  // --- Los 3 que ya existían (recompensa: título) ---
  { id: "10_victorias_sin_perder_vida", descripcion: "Gana 10 partidas sin perder una sola vida", tipo: "victoria_sin_perder_vida", objetivo: 10, recompensaCoronas: 100, tituloDesbloqueado: "Intachable" },
  { id: "rango_genios_explosivos", descripcion: "Alcanza el rango de Genios Explosivos", tipo: "rango_alcanzado_genios", objetivo: 1, recompensaCoronas: 150, tituloDesbloqueado: "Genio Explosivo" },
  { id: "50_veneno_sobrevividas", descripcion: "Sobrevive 50 veces al veneno en el Modo Extra", tipo: "sobrevivencia_veneno", objetivo: 50, recompensaCoronas: 120, tituloDesbloqueado: "Inmune" },

  // --- Nuevos: fáciles (10 coronas) ---
  { id: "primera_sangre", descripcion: "Gana tu primera partida", tipo: "victoria", objetivo: 1, recompensaCoronas: 10 },
  { id: "mano_fria", descripcion: "Usa una Bomba de Hielo en Bombas Elementales", tipo: "bomba_hielo_usada", objetivo: 1, recompensaCoronas: 10 },
  {
    id: "todoterreno",
    descripcion: "Juega al menos una partida en cada modalidad (Estándar, Venenosas y Elementales)",
    // Caso especial: no es un `tipo` que se suma, sino "que llegue al
    // menos una vez cada uno de estos 3 eventos" (ver misiones.js).
    tipoMultiple: ["partida_jugada_estandar", "partida_jugada_venenosas", "partida_jugada_elementales"],
    recompensaCoronas: 10,
  },

  // --- Nuevos: medios (50 coronas) ---
  { id: "veterano", descripcion: "Acumula 25 victorias totales", tipo: "victoria", objetivo: 25, recompensaCoronas: 50 },
  { id: "ingeniero_de_casillas", descripcion: "Marca 100 casillas en Bombas Elementales", tipo: "casilla_marcada_elemental", objetivo: 100, recompensaCoronas: 50 },
  {
    id: "racha_invencible",
    descripcion: "Consigue una racha de 5 victorias seguidas (cualquier modalidad)",
    tipo: "racha_victorias",
    esRacha: true, // progreso por racha, no aditivo (ver misiones.js)
    objetivo: 5,
    recompensaCoronas: 50,
  },

  // --- Nuevos: difíciles y tardados (100 coronas) ---
  { id: "leyenda_de_las_bombas", descripcion: "Acumula 100 victorias totales", tipo: "victoria", objetivo: 100, recompensaCoronas: 100 },
  {
    id: "maestro_del_territorio",
    descripcion: "Gana 30 partidas de Bombas Elementales",
    tipo: "victoria_elementales",
    objetivo: 30,
    recompensaCoronas: 100,
  },

  // --- Nuevos: complejos (cosmético exclusivo, no comprable en Tienda) ---
  { id: "siete_por_siete", descripcion: "Gana 49 partidas en total, sumando Estándar, Venenosas y Elementales", tipo: "victoria", objetivo: 49, marcoDesbloqueado: "007" },
  {
    id: "doble_cero",
    descripcion: "Gana 7 partidas seguidas sin perder una sola vida (Estándar y Venenosas)",
    tipo: "racha_victoria_sin_perder_vida",
    esRacha: true,
    objetivo: 7,
    bannerDesbloqueado: "007",
  },
];

module.exports = { MISIONES_DIARIAS, LOGROS };
