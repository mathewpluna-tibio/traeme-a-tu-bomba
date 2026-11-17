export const CATEGORIAS_POR_MODALIDAD = {
  estandar: [
    { key: "elo", label: "Elo" },
    { key: "victorias", label: "Más Victorias" },
    { key: "vidasQuitadas", label: "Más Vidas Quitadas" },
  ],
  venenosas: [
    { key: "elo", label: "Elo" },
    { key: "victorias", label: "Más Victorias" },
    { key: "vidasQuitadas", label: "Más Vidas Quitadas" },
  ],
  elementales: [
    { key: "elo", label: "Elo" },
    { key: "victorias", label: "Más Victorias" },
    { key: "casillasMarcadas", label: "Más Casillas Marcadas" },
  ],
};

export const MODALIDADES = [
  { key: "estandar", label: "Estándar" },
  { key: "venenosas", label: "Bombas Venenosas" },
  { key: "elementales", label: "Bombas Elementales" },
];

export const CATEGORIA_POR_DEFECTO = {
  estandar: "elo",
  venenosas: "elo",
  elementales: "casillasMarcadas",
};

export const DESEMPATES = {
  elo: [["victorias", "desc"], ["derrotas", "asc"]],
  victorias: [["derrotas", "asc"]],
  casillasMarcadas: [["victorias", "desc"]],
};