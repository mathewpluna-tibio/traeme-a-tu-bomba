// Lógica del modo "Bombas Elementales" (RQF del Modo Extra: Bombas
// Elementales). A diferencia de Estándar/Venenosas, aquí NO hay vidas ni
// bombas ocultas: es un juego de territorio. Cada jugador va marcando
// casillas adyacentes a las suyas (empezando desde una esquina), y gana
// quien termine con más casillas marcadas. Las 3 bombas elementales son
// jugadas tácticas de un solo uso por partida, no explosivos escondidos.
//
// Las claves de casilla usan el mismo formato "fila_columna" que el resto
// del proyecto (ver tableroUtils.calcularDimensiones en el frontend).
//
// Reglas confirmadas con el equipo:
// - Tablero fijo: el rectángulo más grande (9x6 = 54 casillas), una sola
//   ronda, sin progresión de rondas. 6 filas x 9 columnas.
// - Movimiento normal: primera jugada de cada jugador = una esquina libre;
//   después, cualquier casilla libre ortogonalmente adyacente a alguna
//   casilla ya suya.
// - Usar Lianas o Hielo también cuenta como "marcar una casilla propia"
//   (misma regla de adyacencia que un movimiento normal) Y ADEMÁS aplica
//   su efecto especial en la misma jugada.
// - La Eléctrica ignora la regla de adyacencia: se puede colocar en
//   cualquier casilla que no esté marcada por el rival, y su cruz (centro
//   + 4 ortogonales) roba las casillas del rival que alcance.
// - Lianas bloquea 3 casillas LIBRES junto al territorio del rival
//   (las que usaría para expandirse) durante su siguiente turno.
// - Hielo hace que el rival pierda su siguiente turno directamente.
// - Timer de turno: 7 segundos fijos toda la partida. Si se acaba el
//   tiempo, se pierde el turno (no se marca nada).
// - Fin de partida: en cuanto NINGÚN jugador tiene una jugada legal
//   disponible (ni movimiento normal, ni una bomba con objetivo válido),
//   termina ahí mismo. Gana quien tenga más casillas marcadas; empate
//   técnico reparte 15/15 de Elo (eso se resuelve en competitivo.js).

const ANCHO_TABLERO = 9; // columnas
const ALTO_TABLERO = 6; // filas

function formarClave(fila, columna) {
  return `${fila}_${columna}`;
}

function parsearClave(clave) {
  const [fila, columna] = clave.split("_").map(Number);
  return { fila, columna };
}

function esCasillaValida(fila, columna) {
  return fila >= 0 && fila < ALTO_TABLERO && columna >= 0 && columna < ANCHO_TABLERO;
}

function generarCasillasElementales() {
  // OJO: no se pueden inicializar los campos en `null` aquí. RTDB borra
  // cualquier campo escrito como `null`, y si TODOS los campos de un
  // objeto son `null` al hacer un `.update()`/`.set()` masivo, el nodo
  // completo desaparece (ni siquiera queda un objeto vacío). Con las 54
  // casillas así, `casillas` nunca se llegaba a crear en la base de datos,
  // y el cliente se quedaba esperando para siempre en "Generando tablero"
  // porque `partida.casillas` llegaba `undefined`.
  //
  // Se guarda `fila`/`columna` como datos reales (no nulos) para que el
  // nodo sí se cree. El resto del código sigue funcionando igual: cuando
  // `marcadaPor`/`bloqueadaHastaTurno` no existen todavía, valen
  // `undefined`, que se comporta igual que `null` en todas las
  // comparaciones (`!c.marcadaPor`, `c.bloqueadaHastaTurno != null`).
  const casillas = {};
  for (let fila = 0; fila < ALTO_TABLERO; fila++) {
    for (let columna = 0; columna < ANCHO_TABLERO; columna++) {
      casillas[formarClave(fila, columna)] = { fila, columna };
    }
  }
  return casillas;
}

function obtenerEsquinas() {
  return [
    formarClave(0, 0),
    formarClave(0, ANCHO_TABLERO - 1),
    formarClave(ALTO_TABLERO - 1, 0),
    formarClave(ALTO_TABLERO - 1, ANCHO_TABLERO - 1),
  ];
}

function vecinosOrtogonales(clave) {
  const { fila, columna } = parsearClave(clave);
  const candidatos = [
    [fila - 1, columna],
    [fila + 1, columna],
    [fila, columna - 1],
    [fila, columna + 1],
  ];
  return candidatos
    .filter(([f, c]) => esCasillaValida(f, c))
    .map(([f, c]) => formarClave(f, c));
}

function casillaLibre(clave, partida) {
  const c = partida.casillas[clave];
  if (!c) return false;
  if (c.marcadaPor) return false;
  const numeroTurno = partida.numeroTurno || 1;
  if (c.bloqueadaHastaTurno != null && numeroTurno <= c.bloqueadaHastaTurno) return false;
  return true;
}

function jugadorYaJugo(uid, partida) {
  return Object.values(partida.casillas).some((c) => c.marcadaPor === uid);
}

function otroJugador(uid, partida) {
  return Object.keys(partida.jugadores).find((id) => id !== uid);
}

/** Casillas donde `uid` puede jugar su "casilla propia": si todavía no ha
 * marcado nada, cualquier esquina libre; si ya tiene territorio, cualquier
 * casilla libre ortogonalmente adyacente a alguna de sus casillas. Esta
 * regla es compartida por el movimiento normal Y por el paso de "marcar
 * una casilla" al usar Lianas o Hielo. */
function casillasPropiasDisponibles(uid, partida) {
  if (!jugadorYaJugo(uid, partida)) {
    return obtenerEsquinas().filter((clave) => casillaLibre(clave, partida));
  }
  const propias = Object.entries(partida.casillas)
    .filter(([, c]) => c.marcadaPor === uid)
    .map(([clave]) => clave);
  const candidatas = new Set();
  for (const clave of propias) {
    for (const vecino of vecinosOrtogonales(clave)) {
      if (casillaLibre(vecino, partida)) candidatas.add(vecino);
    }
  }
  return [...candidatas];
}

/** Actualizaciones de RTDB para marcar una casilla propia (movimiento
 * normal, o el paso de "marcar" de Lianas/Hielo). No valida por sí sola;
 * quien la llame debe confirmar antes que la casilla está en
 * `casillasPropiasDisponibles`. */
function marcarCasillaPropia(clave, uid, partida) {
  return {
    [`casillas/${clave}/marcadaPor`]: uid,
    [`jugadores/${uid}/casillasMarcadas`]: (partida.jugadores[uid].casillasMarcadas || 0) + 1,
  };
}

/** Bomba Eléctrica: cruz (centro + 4 ortogonales). El centro puede ser
 * cualquier casilla que NO esté marcada por el rival (ignora la regla de
 * adyacencia). Roba las casillas del rival que caigan dentro de la cruz. */
function aplicarBombaElectrica(centroClave, uid, partida) {
  const rival = otroJugador(uid, partida);
  const centro = partida.casillas[centroClave];
  if (!centro || centro.marcadaPor === rival) {
    throw new Error("Objetivo inválido para la bomba eléctrica.");
  }

  const objetivo = [centroClave, ...vecinosOrtogonales(centroClave)];
  const actualizaciones = {};
  let nuevasPropias = 0;
  let robadas = 0;

  for (const clave of objetivo) {
    const casilla = partida.casillas[clave];
    if (!casilla || casilla.marcadaPor === uid) continue;
    if (casilla.marcadaPor === rival) robadas++;
    else nuevasPropias++;
    actualizaciones[`casillas/${clave}/marcadaPor`] = uid;
    actualizaciones[`casillas/${clave}/bloqueadaHastaTurno`] = null;
  }

  actualizaciones[`jugadores/${uid}/casillasMarcadas`] =
    (partida.jugadores[uid].casillasMarcadas || 0) + nuevasPropias + robadas;
  if (robadas > 0) {
    actualizaciones[`jugadores/${rival}/casillasMarcadas`] = Math.max(
      0,
      (partida.jugadores[rival].casillasMarcadas || 0) - robadas
    );
  }
  actualizaciones[`jugadores/${uid}/bombas/electrica`] = false;

  return actualizaciones;
}

/** Casillas libres válidas para que Lianas las bloquee: libres y
 * ortogonalmente junto a alguna casilla del rival (las que usaría para
 * expandirse). */
function casillasBloqueablesLianas(uid, partida) {
  const rival = otroJugador(uid, partida);
  const casillasRival = Object.entries(partida.casillas)
    .filter(([, c]) => c.marcadaPor === rival)
    .map(([clave]) => clave);
  const candidatas = new Set();
  for (const clave of casillasRival) {
    for (const vecino of vecinosOrtogonales(clave)) {
      if (casillaLibre(vecino, partida)) candidatas.add(vecino);
    }
  }
  return [...candidatas];
}

/** Lianas: marca una casilla propia (regla normal de adyacencia) y
 * bloquea 3 casillas junto al rival durante su siguiente turno. */
function aplicarBombaLianas(casillaPropia, casillasBloqueo, uid, partida) {
  if (!casillasPropiasDisponibles(uid, partida).includes(casillaPropia)) {
    throw new Error("Casilla propia inválida para Lianas.");
  }
  if (!Array.isArray(casillasBloqueo) || casillasBloqueo.length !== 3) {
    throw new Error("Lianas necesita exactamente 3 casillas para bloquear.");
  }
  const disponibles = new Set(casillasBloqueablesLianas(uid, partida));
  const unicas = new Set(casillasBloqueo);
  if (unicas.size !== 3 || [...unicas].some((c) => !disponibles.has(c))) {
    throw new Error("Alguna casilla de bloqueo no es válida.");
  }

  const actualizaciones = marcarCasillaPropia(casillaPropia, uid, partida);
  const turnoBloqueo = (partida.numeroTurno || 1) + 1;
  for (const clave of unicas) {
    actualizaciones[`casillas/${clave}/bloqueadaHastaTurno`] = turnoBloqueo;
  }
  actualizaciones[`jugadores/${uid}/bombas/lianas`] = false;
  return actualizaciones;
}

/** Hielo: marca una casilla propia (regla normal de adyacencia) y congela
 * al rival, que pierde su siguiente turno directamente. */
function aplicarBombaHielo(casillaPropia, uid, partida) {
  if (!casillasPropiasDisponibles(uid, partida).includes(casillaPropia)) {
    throw new Error("Casilla propia inválida para Hielo.");
  }
  const rival = otroJugador(uid, partida);
  const actualizaciones = marcarCasillaPropia(casillaPropia, uid, partida);
  actualizaciones[`jugadores/${rival}/congeladoPorTurnos`] =
    (partida.jugadores[rival].congeladoPorTurnos || 0) + 1;
  actualizaciones[`jugadores/${uid}/bombas/hielo`] = false;
  return actualizaciones;
}

/** ¿Le queda a `uid` alguna jugada legal? Un movimiento normal ya cubre
 * también la posibilidad de usar Lianas/Hielo (comparten la misma regla
 * de adyacencia). Si no tiene casillas adyacentes libres, solo la
 * Eléctrica puede rescatarlo, porque es la única que ignora esa regla. */
function jugadorTieneMovimientoValido(uid, partida) {
  if (casillasPropiasDisponibles(uid, partida).length > 0) return true;

  if (partida.jugadores[uid]?.bombas?.electrica) {
    const rival = otroJugador(uid, partida);
    const hayObjetivoElectrica = Object.values(partida.casillas).some(
      (c) => c.marcadaPor !== rival
    );
    if (hayObjetivoElectrica) return true;
  }
  return false;
}

function partidaTerminada(partida) {
  const [uidA, uidB] = Object.keys(partida.jugadores);
  return (
    !jugadorTieneMovimientoValido(uidA, partida) &&
    !jugadorTieneMovimientoValido(uidB, partida)
  );
}

function resolverGanadorPorCasillas(partida) {
  const [uidA, uidB] = Object.keys(partida.jugadores);
  const marcadasA = partida.jugadores[uidA].casillasMarcadas || 0;
  const marcadasB = partida.jugadores[uidB].casillasMarcadas || 0;
  if (marcadasA === marcadasB) return { empate: true };
  return { empate: false, ganador: marcadasA > marcadasB ? uidA : uidB };
}

module.exports = {
  ANCHO_TABLERO,
  ALTO_TABLERO,
  formarClave,
  parsearClave,
  generarCasillasElementales,
  obtenerEsquinas,
  vecinosOrtogonales,
  casillaLibre,
  jugadorYaJugo,
  casillasPropiasDisponibles,
  otroJugador,
  marcarCasillaPropia,
  aplicarBombaElectrica,
  casillasBloqueablesLianas,
  aplicarBombaLianas,
  aplicarBombaHielo,
  jugadorTieneMovimientoValido,
  partidaTerminada,
  resolverGanadorPorCasillas,
};