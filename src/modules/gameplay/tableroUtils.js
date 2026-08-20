// Calcula filas y columnas máximas a partir de las claves existentes en `casillas`
export function calcularDimensiones(casillas) {
  let maxFila = 0;
  let maxCol = 0;

  Object.keys(casillas || {}).forEach((clave) => {
    const [f, c] = clave.split("_").map(Number);
    if (f > maxFila) maxFila = f;
    if (c > maxCol) maxCol = c;
  });

  return { filas: maxFila + 1, columnas: maxCol + 1 };
}