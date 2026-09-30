export const LOGROS = [
  // --- Los 3 originales (recompensa: título) ---
  {
    id: "10_victorias_sin_perder_vida",
    descripcion: "Gana 10 partidas sin perder una sola vida",
    objetivo: 10,
    recompensaCoronas: 100,
    tituloDesbloqueado: "Intachable",
    categoria: "original",
  },
  {
    id: "rango_genios_explosivos",
    descripcion: "Alcanza el rango de Genios Explosivos",
    objetivo: 1,
    recompensaCoronas: 150,
    tituloDesbloqueado: "Genio Explosivo",
    categoria: "original",
  },
  {
    id: "50_veneno_sobrevividas",
    descripcion: "Sobrevive 50 veces al veneno en el Modo Extra",
    objetivo: 50,
    recompensaCoronas: 120,
    tituloDesbloqueado: "Inmune",
    categoria: "original",
  },

  // --- Fáciles (10 coronas) ---
  {
    id: "primera_sangre",
    descripcion: "Gana tu primera partida",
    objetivo: 1,
    recompensaCoronas: 10,
    categoria: "facil",
  },
  {
    id: "mano_fria",
    descripcion: "Usa una Bomba de Hielo en Bombas Elementales",
    objetivo: 1,
    recompensaCoronas: 10,
    categoria: "facil",
  },
  {
    id: "todoterreno",
    descripcion: "Juega al menos una partida en cada modalidad (Estándar, Venenosas y Elementales)",
    objetivo: 3,
    recompensaCoronas: 10,
    categoria: "facil",
  },

  // --- Medios (50 coronas) ---
  {
    id: "veterano",
    descripcion: "Acumula 25 victorias totales",
    objetivo: 25,
    recompensaCoronas: 50,
    categoria: "medio",
  },
  {
    id: "ingeniero_de_casillas",
    descripcion: "Marca 100 casillas en Bombas Elementales",
    objetivo: 100,
    recompensaCoronas: 50,
    categoria: "medio",
  },
  {
    id: "racha_invencible",
    descripcion: "Consigue una racha de 5 victorias seguidas (cualquier modalidad)",
    objetivo: 5,
    recompensaCoronas: 50,
    categoria: "medio",
  },

  // --- Difíciles y tardados (100 coronas) ---
  {
    id: "leyenda_de_las_bombas",
    descripcion: "Acumula 100 victorias totales",
    objetivo: 100,
    recompensaCoronas: 100,
    categoria: "dificil",
  },
  {
    id: "maestro_del_territorio",
    descripcion: "Gana 30 partidas de Bombas Elementales",
    objetivo: 30,
    recompensaCoronas: 100,
    categoria: "dificil",
  },

  // --- Complejos (cosmético exclusivo, no comprable en Tienda) ---
  {
    id: "siete_por_siete",
    descripcion: "Gana 49 partidas en total, sumando Estándar, Venenosas y Elementales",
    objetivo: 49,
    marcoDesbloqueado: "007",
    categoria: "complejo",
  },
  {
    id: "doble_cero",
    descripcion: "Gana 7 partidas seguidas sin perder una sola vida (Estándar y Venenosas)",
    objetivo: 7,
    bannerDesbloqueado: "007",
    categoria: "complejo",
  },
];

export const CATEGORIAS = [
  { id: "original", titulo: "Logros de rango" },
  { id: "facil", titulo: "Fáciles" },
  { id: "medio", titulo: "Medios" },
  { id: "dificil", titulo: "Difíciles" },
  { id: "complejo", titulo: "Complejos" },
];

export function describirRecompensa(logro) {
  const partes = [];
  if (logro.recompensaCoronas) partes.push(`${logro.recompensaCoronas} coronas`);
  if (logro.tituloDesbloqueado) partes.push(`título "${logro.tituloDesbloqueado}"`);
  if (logro.marcoDesbloqueado) partes.push(`marco "${logro.marcoDesbloqueado}"`);
  if (logro.bannerDesbloqueado) partes.push(`banner "${logro.bannerDesbloqueado}"`);
  return partes.join(" + ");
}