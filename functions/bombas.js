const CONFIG_BOMBAS = {
  bomba: {
    dano: 1,
    cantidad: { 1: 5, 2: 8, 3: 11, default: 14 },
  },
  bombota: {
    dano: 1.5,
    cantidad: { 1: 3, 2: 5, 3: 7, default: 10 },
  },
  minibomba: {
    dano: 0.5,
    cantidad: { 1: 8, 2: 12, 3: 16, default: 18 },
  },
};

const CANTIDAD_BOMBAS_VENENOSAS = { 1: 5, 2: 8, 3: 11, default: 14 };

function obtenerCantidadBombas(clase, ronda) {
  const config = CONFIG_BOMBAS[clase];
  if (!config) return 0;
  return config.cantidad[ronda] ?? config.cantidad.default;
}

function obtenerCantidadBombasVenenosas(ronda) {
  return CANTIDAD_BOMBAS_VENENOSAS[ronda] ?? CANTIDAD_BOMBAS_VENENOSAS.default;
}

function obtenerDanoBomba(clase) {
  return CONFIG_BOMBAS[clase]?.dano ?? 0;
}

module.exports = { CONFIG_BOMBAS, obtenerCantidadBombas, obtenerDanoBomba, obtenerCantidadBombasVenenosas };