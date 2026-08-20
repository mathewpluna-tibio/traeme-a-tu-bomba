// Configuración de dimensiones por tipo de tablero y ronda
const CONFIG_TABLEROS = {
  cuadrado: {
    1: { filas: 5, columnas: 5 },
    2: { filas: 6, columnas: 6 },
    default: { filas: 7, columnas: 7 }, // ronda 3+
  },
  rectangulo: {
    1: { filas: 4, columnas: 7 },
    2: { filas: 5, columnas: 8 },
    default: { filas: 6, columnas: 9 },
  },
  anillo: {
    1: { filas: 6, columnas: 6, huecoCentro: 2 },
    2: { filas: 7, columnas: 7, huecoCentro: 3 },
    default: { filas: 8, columnas: 8, huecoCentro: 4 },
  },
};

function obtenerConfigTablero(tipo, ronda) {
  const configTipo = CONFIG_TABLEROS[tipo];
  return configTipo[ronda] || configTipo.default;
}

// Genera el objeto de casillas vacías para un tablero,
// respetando el hueco central en el caso del tipo "anillo"
function generarCasillas(tipo, ronda) {
  const config = obtenerConfigTablero(tipo, ronda);
  const { filas, columnas, huecoCentro } = config;
  const casillas = {};

  const inicioHuecoFila = huecoCentro
    ? Math.floor((filas - huecoCentro) / 2)
    : null;
  const inicioHuecoCol = huecoCentro
    ? Math.floor((columnas - huecoCentro) / 2)
    : null;

  for (let f = 0; f < filas; f++) {
    for (let c = 0; c < columnas; c++) {
      if (huecoCentro) {
        const enHuecoFila = f >= inicioHuecoFila && f < inicioHuecoFila + huecoCentro;
        const enHuecoCol = c >= inicioHuecoCol && c < inicioHuecoCol + huecoCentro;
        if (enHuecoFila && enHuecoCol) continue;
      }
      // Antes: { bombas: [], segura: null }  -> colapsaba a vacío
      // Ahora: usamos "segura: false" como estado inicial real (no null),
      // y omitimos "bombas" hasta que exista al menos una bomba real.
      casillas[`${f}_${c}`] = { segura: false };
    }
  }

  return casillas;
}

function elegirTableroAleatorio() {
  const tipos = ["cuadrado", "rectangulo", "anillo"];
  return tipos[Math.floor(Math.random() * tipos.length)];
}

module.exports = {
  CONFIG_TABLEROS,
  obtenerConfigTablero,
  generarCasillas,
  elegirTableroAleatorio,
};