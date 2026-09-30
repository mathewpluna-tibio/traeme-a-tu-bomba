// Espejo en el cliente de la lógica de "Bombas Elementales" en
// functions/elementales.js. Esto es SOLO para resaltar en la UI qué
// casillas son jugables (mejor experiencia, feedback inmediato); el
// servidor (marcarCasillaElemental / usarBombaElemental) sigue siendo la
// única fuente de verdad y vuelve a validar todo.
//
// Mismo formato de clave que el resto del proyecto: "fila_columna"
// (ver tableroUtils.calcularDimensiones).

export function calcularDimensionesElemental(partida) {
  if (partida?.altoTablero && partida?.anchoTablero) {
    return { filas: partida.altoTablero, columnas: partida.anchoTablero };
  }
  // Respaldo: si por algo no vinieran esos campos, se calculan a partir
  // de las claves de `casillas` (igual que tableroUtils.calcularDimensiones).
  let maxFila = 0;
  let maxCol = 0;
  Object.keys(partida?.casillas || {}).forEach((clave) => {
    const [f, c] = clave.split("_").map(Number);
    if (f > maxFila) maxFila = f;
    if (c > maxCol) maxCol = c;
  });
  return { filas: maxFila + 1, columnas: maxCol + 1 };
}

export function formarClave(fila, columna) {
  return `${fila}_${columna}`;
}

export function parsearClave(clave) {
  const [fila, columna] = clave.split("_").map(Number);
  return { fila, columna };
}

function esCasillaValida(fila, columna, filas, columnas) {
  return fila >= 0 && fila < filas && columna >= 0 && columna < columnas;
}

export function obtenerEsquinas(partida) {
  const { filas, columnas } = calcularDimensionesElemental(partida);
  return [
    formarClave(0, 0),
    formarClave(0, columnas - 1),
    formarClave(filas - 1, 0),
    formarClave(filas - 1, columnas - 1),
  ];
}

export function vecinosOrtogonales(clave, partida) {
  const { filas, columnas } = calcularDimensionesElemental(partida);
  const { fila, columna } = parsearClave(clave);
  const candidatos = [
    [fila - 1, columna],
    [fila + 1, columna],
    [fila, columna - 1],
    [fila, columna + 1],
  ];
  return candidatos
    .filter(([f, c]) => esCasillaValida(f, c, filas, columnas))
    .map(([f, c]) => formarClave(f, c));
}

export function casillaLibre(clave, partida) {
  const c = partida.casillas[clave];
  if (!c) return false;
  if (c.marcadaPor) return false;
  const numeroTurno = partida.numeroTurno || 1;
  if (c.bloqueadaHastaTurno != null && numeroTurno <= c.bloqueadaHastaTurno) return false;
  return true;
}

export function casillaBloqueada(clave, partida) {
  const c = partida.casillas[clave];
  if (!c) return false;
  const numeroTurno = partida.numeroTurno || 1;
  return c.bloqueadaHastaTurno != null && numeroTurno <= c.bloqueadaHastaTurno && !c.marcadaPor;
}

export function jugadorYaJugo(uid, partida) {
  return Object.values(partida.casillas).some((c) => c.marcadaPor === uid);
}

export function otroJugador(uid, partida) {
  return Object.keys(partida.jugadores).find((id) => id !== uid);
}

/** Casillas donde `uid` puede marcar "una casilla propia": movimiento
 * normal, y también el paso de marcar al usar Lianas o Hielo. */
export function casillasPropiasDisponibles(uid, partida) {
  if (!jugadorYaJugo(uid, partida)) {
    return obtenerEsquinas(partida).filter((clave) => casillaLibre(clave, partida));
  }
  const propias = Object.entries(partida.casillas)
    .filter(([, c]) => c.marcadaPor === uid)
    .map(([clave]) => clave);
  const candidatas = new Set();
  for (const clave of propias) {
    for (const vecino of vecinosOrtogonales(clave, partida)) {
      if (casillaLibre(vecino, partida)) candidatas.add(vecino);
    }
  }
  return [...candidatas];
}

/** Objetivos válidos para la Eléctrica: cualquier casilla que no sea ya
 * del rival (ignora la regla de adyacencia). */
export function objetivosElectrica(uid, partida) {
  const rival = otroJugador(uid, partida);
  return Object.keys(partida.casillas).filter(
    (clave) => partida.casillas[clave].marcadaPor !== rival
  );
}

/** Casillas libres junto al territorio rival que Lianas puede bloquear. */
export function casillasBloqueablesLianas(uid, partida) {
  const rival = otroJugador(uid, partida);
  const casillasRival = Object.entries(partida.casillas)
    .filter(([, c]) => c.marcadaPor === rival)
    .map(([clave]) => clave);
  const candidatas = new Set();
  for (const clave of casillasRival) {
    for (const vecino of vecinosOrtogonales(clave, partida)) {
      if (casillaLibre(vecino, partida)) candidatas.add(vecino);
    }
  }
  return [...candidatas];
}