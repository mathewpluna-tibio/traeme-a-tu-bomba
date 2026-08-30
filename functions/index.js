
const {setGlobalOptions} = require("firebase-functions");
const {onRequest} = require("firebase-functions/https");
const logger = require("firebase-functions/logger");


setGlobalOptions({ maxInstances: 10 });

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const Filter = require("bad-words");
const malasPalabras = require("./malasPalabras");
const { elegirTableroAleatorio, generarCasillas } = require("./tableros");
const { obtenerCantidadBombas, obtenerDanoBomba } = require("./bombas");
const { aplicarResultadoCompetitivo } = require("./competitivo");
const { duracionTurnoJuego } = require("./turnos");

//FILTRO MALAS PALABRAS

const MAPA_LEETSPEAK = {
  "4": "a", "@": "a",
  "3": "e",
  "1": "i", "!": "i", "|": "i",
  "0": "o",
  "5": "s", "$": "s",
  "7": "t",
  "8": "b",
  "9": "g",
};

function normalizar(texto) {
  let resultado = texto.toLowerCase();
  resultado = resultado.split("").map((c) => MAPA_LEETSPEAK[c] ?? c).join("");
  resultado = resultado.replace(/[\s\-_.*+~^]/g, "");
  resultado = resultado.replace(/(.)\1+/g, "$1");
  return resultado;
}

function contienePalabraProhibida(textoNormalizado, listaPalabras) {
  return listaPalabras.some((palabra) => {
    const palabraNorm = normalizar(palabra);
    return (
      textoNormalizado === palabraNorm ||
      textoNormalizado.startsWith(palabraNorm) ||
      textoNormalizado.endsWith(palabraNorm)
    );
  });
}

function quitarDigitos(texto) {
  return texto.replace(/[0-9]/g, "");
}

exports.validarUsername = onCall((request) => {
  const username = request.data?.username;

  if (!username || typeof username !== "string" || username.trim().length === 0) {
    throw new HttpsError("invalid-argument", "El nombre de usuario es requerido.");
  }

  const filter = new Filter();
  filter.addWords(...malasPalabras);

  const esOfensivoDirecto = filter.isProfane(username);
  const textoNormalizado = normalizar(username);
  const esOfensivoNormalizado = filter.isProfane(textoNormalizado);
  const esOfensivoPorPrefijoSufijo = contienePalabraProhibida(textoNormalizado, malasPalabras);

  const textoSinDigitos = quitarDigitos(textoNormalizado);
  const esOfensivoSinDigitos =
    textoSinDigitos.length > 0 &&
    (filter.isProfane(textoSinDigitos) ||
      contienePalabraProhibida(textoSinDigitos, malasPalabras));

  const esOfensivo =
    esOfensivoDirecto ||
    esOfensivoNormalizado ||
    esOfensivoPorPrefijoSufijo ||
    esOfensivoSinDigitos;

  return { valido: !esOfensivo };
});

//TRIGGER MATCHMAKING - RECIBE CADA VEZ QUE CAMBIA LA COLA

const { onValueWritten } = require("firebase-functions/v2/database");
const { getDatabase } = require("firebase-admin/database");
const { initializeApp, getApps } = require("firebase-admin/app");

if (!getApps().length) {
  initializeApp();
}

const rtdb = getDatabase();

// Se dispara cada vez que algo cambia en colaEspera/{modalidad}/{uid}
exports.onColaEsperaChange = onValueWritten(
  "/colaEspera/{modalidad}/{uid}",
  async (event) => {
    const { modalidad, uid } = event.params;

    // Si el nodo fue borrado (alguien salió de la cola o ya fue emparejado),
    // no hay nada que buscar para ESE jugador.
    if (!event.data.after.exists()) {
      return null;
    }

    const jugador = event.data.after.val();
    await intentarEmparejar(modalidad, uid, jugador);

    return null;
  }
);

//EMPAREJAMIENTO

function resolverClase(clase) {
  if (clase !== "aleatoria") return clase;
  const clasesReales = ["minibomba", "bomba", "bombota"];
  return clasesReales[Math.floor(Math.random() * clasesReales.length)];
}

function transactionConTimeout(ref, updateFn, timeoutMs = 3000) {
  return Promise.race([
    ref.transaction(updateFn),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Transaction timeout")), timeoutMs)
    ),
  ]);
}

async function intentarEmparejar(modalidad, uid, jugador) {
  console.log(`[Matchmaking] Iniciando para uid=${uid}, modalidad=${modalidad}`);

  const notifPropia = await rtdb.ref(`notificacionesPartida/${uid}`).once("value");
  if (notifPropia.exists()) {
    console.log(`[Matchmaking] uid=${uid} ya tiene partida asignada, ignorando.`);
    return;
  }

  const colaRef = rtdb.ref(`colaEspera/${modalidad}`);
  const snapshot = await colaRef.once("value");
  const cola = snapshot.val() || {};

  const candidatos = Object.entries(cola)
    .filter(([otroUid]) => otroUid !== uid)
    .map(([otroUid, datos]) => ({ uid: otroUid, ...datos }));

  if (candidatos.length === 0) {
    console.log(`[Matchmaking] Sin candidatos, saliendo.`);
    return;
  }

  const ahora = Date.now();
  const tiempoEsperando = ahora - jugador.timestamp;

  let tolerancia = 10;
  if (tiempoEsperando >= 15000) tolerancia = 60;
  else if (tiempoEsperando >= 5000) tolerancia = 30;

  const candidatosValidos = candidatos.filter(
    (c) => Math.abs(c.elo - jugador.elo) <= tolerancia
  );

  if (candidatosValidos.length === 0) {
    console.log(`[Matchmaking] Ningún candidato dentro de tolerancia, saliendo.`);
    return;
  }

  candidatosValidos.sort((a, b) => a.timestamp - b.timestamp);
  const rival = candidatosValidos[0];

  const parOrdenado = [uid, rival.uid].sort();
  const lockRef = rtdb.ref(`matchmakingLocks/${modalidad}/${parOrdenado[0]}_${parOrdenado[1]}`);

  let resultadoLock;
  try {
    resultadoLock = await transactionConTimeout(lockRef, (actual) => {
      if (actual !== null) return undefined;
      return true;
    });
  } catch (err) {
    console.log(`[Matchmaking] Timeout en transacción de lock, abortando por seguridad.`);
    return;
  }

  if (!resultadoLock.committed) {
    console.log(`[Matchmaking] Este par ya fue reservado por otra ejecución, saliendo.`);
    return;
  }

  // --- A partir de aquí, SIEMPRE liberamos el lock al terminar,
  // sin importar si la partida se creó o si algo falló en el camino. ---
  try {
    const checkSnapshot = await rtdb.ref(`colaEspera/${modalidad}/${rival.uid}`).once("value");
    if (!checkSnapshot.exists()) {
      console.log(`[Matchmaking] El rival ya no está en la cola, saliendo.`);
      return;
    }

    const notifRivalCheck = await rtdb.ref(`notificacionesPartida/${rival.uid}`).once("value");
    if (notifRivalCheck.exists()) {
      console.log(`[Matchmaking] El rival ya fue emparejado por otra ejecución, saliendo.`);
      return;
    }

    const notifPropiaCheck = await rtdb.ref(`notificacionesPartida/${uid}`).once("value");
    if (notifPropiaCheck.exists()) {
      console.log(`[Matchmaking] Yo ya fui emparejado por otra ejecución, saliendo.`);
      return;
    }

    const partidaRef = rtdb.ref("partidas").push();
    const partidaId = partidaRef.key;

    const claseJugador = resolverClase(jugador.clase);
    const claseRival = resolverClase(rival.clase);

    const updates = {};
    updates[`colaEspera/${modalidad}/${uid}`] = null;
    updates[`colaEspera/${modalidad}/${rival.uid}`] = null;
    updates[`partidas/${partidaId}`] = {
      modalidad,
      tablero: null,
      ronda: 1,
      estado: "generando_tablero",
      jugadores: {
        [uid]: {
          vidas: 3,
          clase: claseJugador,
          listo: false,
          bombasDisponibles: obtenerCantidadBombas(claseJugador, 1),
        },
        [rival.uid]: {
          vidas: 3,
          clase: claseRival,
          listo: false,
          bombasDisponibles: obtenerCantidadBombas(claseRival, 1),
        },
      },
      creadaEn: ahora,
    };
    updates[`notificacionesPartida/${uid}`] = partidaId;
    updates[`notificacionesPartida/${rival.uid}`] = partidaId;

    await rtdb.ref().update(updates);

    console.log(`[Matchmaking] ¡Partida creada! ID: ${partidaId} (esperando generación de tablero)`);
  } finally {
    // Liberamos el lock SIEMPRE - éxito, error, o cualquier `return`
    // dentro del bloque try anterior pasará por aquí antes de salir.
    await lockRef.remove();
  }
}

exports.onPartidaCreada = onValueWritten(
  "/partidas/{partidaId}/estado",
  async (event) => {
    const { partidaId } = event.params;
    const estado = event.data.after.val();

    if (estado !== "generando_tablero") {
      return null;
    }

    console.log(`[Tablero] Generando para partida ${partidaId}`);

    const tipoTablero = elegirTableroAleatorio();
    const casillasIniciales = generarCasillas(tipoTablero, 1);

    // Leemos los jugadores para asignar colores
    const partidaSnap = await rtdb.ref(`partidas/${partidaId}/jugadores`).once("value");
    const jugadores = partidaSnap.val();
    const uids = Object.keys(jugadores);

    // Asignación aleatoria de quién es azul (tu documento no especifica
    // el criterio de asignación inicial, solo que "el azul siempre empieza")
    const indiceAzul = Math.floor(Math.random() * 2);
    const uidAzul = uids[indiceAzul];
    const uidRojo = uids[1 - indiceAzul];

    const DURACION_TURNO_MS = 30000;

    await rtdb.ref(`partidas/${partidaId}`).update({
      tablero: tipoTablero,
      casillas: casillasIniciales,
      estado: "preparacion",
      [`jugadores/${uidAzul}/color`]: "azul",
      [`jugadores/${uidRojo}/color`]: "rojo",
      turnoColocacion: {
        uidActivo: uidAzul,
        inicioEn: Date.now(),
        finalizaEn: Date.now() + DURACION_TURNO_MS,
      },
    });

    console.log(`[Tablero] Completado para partida ${partidaId}, tipo: ${tipoTablero}, inicia: ${uidAzul}`);

    return null;
  }
);

exports.testCasillas = onRequest(async (req, res) => {
  const resultados = {};

  // Prueba A: solo el arreglo vacío, sin "segura"
  await rtdb.ref("testA").set({ "0_0": { bombas: [] }, "0_1": { bombas: [] } });
  const verifA = await rtdb.ref("testA").once("value");
  resultados.soloArregloVacio = { existe: verifA.exists(), valor: verifA.val() };

  // Prueba B: solo "segura: null", sin arreglo
  await rtdb.ref("testB").set({ "0_0": { segura: null }, "0_1": { segura: null } });
  const verifB = await rtdb.ref("testB").once("value");
  resultados.soloSeguraNull = { existe: verifB.exists(), valor: verifB.val() };

  // Prueba C: arreglo con contenido (no vacío) + segura null
  await rtdb.ref("testC").set({
    "0_0": { bombas: ["x"], segura: null },
    "0_1": { bombas: ["y"], segura: null },
  });
  const verifC = await rtdb.ref("testC").once("value");
  resultados.arregloConContenido = { existe: verifC.exists(), valor: verifC.val() };

  // Prueba D: igual que la real, pero con segura: false en vez de null
  await rtdb.ref("testD").set({
    "0_0": { bombas: [], segura: false },
    "0_1": { bombas: [], segura: false },
  });
  const verifD = await rtdb.ref("testD").once("value");
  resultados.seguraFalse = { existe: verifD.exists(), valor: verifD.val() };

  res.json(resultados);
});

exports.colocarBomba = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
  }

  const { partidaId, casillaClave } = request.data || {};
  if (!partidaId || !casillaClave) {
    throw new HttpsError("invalid-argument", "Faltan datos de la partida o casilla.");
  }

  const partidaSnap = await rtdb.ref(`partidas/${partidaId}`).once("value");
  const partida = partidaSnap.val();

  if (!partida) {
    throw new HttpsError("not-found", "La partida no existe.");
  }
  if (partida.estado !== "preparacion") {
    throw new HttpsError("failed-precondition", "No estás en fase de preparación.");
  }

  if (partida.turnoColocacion?.uidActivo !== uid) {
    throw new HttpsError("failed-precondition", "No es tu turno de colocar bombas.");
  }

  const jugador = partida.jugadores?.[uid];
  if (!jugador) {
    throw new HttpsError("permission-denied", "No perteneces a esta partida.");
  }
  if ((jugador.bombasDisponibles || 0) <= 0) {
    throw new HttpsError("failed-precondition", "Ya no tienes bombas disponibles.");
  }
  if (!partida.casillas?.[casillaClave]) {
    throw new HttpsError("invalid-argument", "Casilla inválida.");
  }

  // Leemos las bombas actuales de esa casilla (puede que no exista el campo todavía)
  const casillaActual = partida.casillas[casillaClave];
  const bombasActuales = casillaActual.bombas || [];

  const nuevaBomba = {
    uid,
    tipo: jugador.clase,
    dano: obtenerDanoBomba(jugador.clase),
    colocadaEn: Date.now(),
  };

  const updates = {};
  updates[`partidas/${partidaId}/casillas/${casillaClave}/bombas`] = [
    ...bombasActuales,
    nuevaBomba,
  ];
  updates[`partidas/${partidaId}/jugadores/${uid}/bombasDisponibles`] =
    jugador.bombasDisponibles - 1;
  updates[`partidas/${partidaId}/jugadores/${uid}/coloco`] = true;

  await rtdb.ref().update(updates);

  return { exito: true, bombasRestantes: jugador.bombasDisponibles - 1 };
});

async function avanzarFaseColocacion(partidaId, uidQueTermina) {
  const partidaSnap = await rtdb.ref(`partidas/${partidaId}`).once("value");
  const partida = partidaSnap.val();
  if (!partida || partida.estado !== "preparacion") return;

  // Verificación de idempotencia SIN transacción: si el turno activo ya
  // no es este jugador, alguien más ya lo procesó - abortamos limpio.
  if (partida.turnoColocacion?.uidActivo !== uidQueTermina) {
    console.log(`[Preparación] Turno ya fue procesado para ${uidQueTermina}, abortando.`);
    return;
  }

  // Esperamos a que la última bomba complete su visibilidad de 3s
  const TIEMPO_VISIBLE_MS = 3000;
  const casillas = partida.casillas || {};
  let bombaMasReciente = 0;
  Object.values(casillas).forEach((casilla) => {
    (casilla.bombas || []).forEach((bomba) => {
      if (bomba.colocadaEn > bombaMasReciente) bombaMasReciente = bomba.colocadaEn;
    });
  });
  const tiempoDesdeUltimaBomba = Date.now() - bombaMasReciente;
  if (bombaMasReciente > 0 && tiempoDesdeUltimaBomba < TIEMPO_VISIBLE_MS) {
    await new Promise((resolve) => setTimeout(resolve, TIEMPO_VISIBLE_MS - tiempoDesdeUltimaBomba));
  }

  // Re-verificamos justo antes de escribir, por si algo cambió durante la espera
  const partidaFrescaSnap = await rtdb.ref(`partidas/${partidaId}`).once("value");
  const partidaFresca = partidaFrescaSnap.val();
  if (!partidaFresca || partidaFresca.turnoColocacion?.uidActivo !== uidQueTermina) {
    console.log(`[Preparación] Turno cambió durante la espera para ${uidQueTermina}, abortando.`);
    return;
  }

  const uids = Object.keys(partidaFresca.jugadores);
  const uidRival = uids.find((id) => id !== uidQueTermina);
  const yaJugoRival = partidaFresca.jugadores[uidRival]?.yaColoco === true;

  if (!yaJugoRival) {
    const DURACION_TURNO_MS = 30000;
    await rtdb.ref(`partidas/${partidaId}`).update({
      [`jugadores/${uidQueTermina}/yaColoco`]: true,
      turnoColocacion: {
        uidActivo: uidRival,
        inicioEn: Date.now(),
        finalizaEn: Date.now() + DURACION_TURNO_MS,
      },
    });
    console.log(`[Preparación] Turno de ${uidQueTermina} terminado, pasa a ${uidRival}`);
  } else {
    const coloroQuienTermina = partidaFresca.jugadores[uidQueTermina]?.coloco === true;
    const coloroRival = partidaFresca.jugadores[uidRival]?.coloco === true;

    if (partidaFresca.ronda === 1 && !coloroQuienTermina && !coloroRival) {
      await rtdb.ref(`partidas/${partidaId}`).update({
        [`jugadores/${uidQueTermina}/yaColoco`]: true,
        estado: "cancelada",
        turnoColocacion: null,
        motivoCancelacion: "inactividad",
      });
      console.log(`[Preparación] Partida ${partidaId} cancelada: nadie colocó bombas`);
      return;
    }

    const uidAzul = uids.find((id) => partidaFresca.jugadores[id].color === "azul");
    await rtdb.ref(`partidas/${partidaId}`).update({
      [`jugadores/${uidQueTermina}/yaColoco`]: true,
      estado: "en_curso",
      turnoColocacion: null,
      turnoActual: uidAzul,
      turnoJuego: {
        uidActivo: uidAzul,
        inicioEn: Date.now(),
        finalizaEn: Date.now() + duracionTurnoJuego(partidaFresca.ronda),
      },
    });
    console.log(`[Preparación] Ambos listos, partida ${partidaId} inicia`);
  }
}

exports.finalizarTurnoColocacion = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
  }

  const { partidaId } = request.data || {};
  if (!partidaId) {
    throw new HttpsError("invalid-argument", "Falta el ID de partida.");
  }

  const partidaSnap = await rtdb.ref(`partidas/${partidaId}`).once("value");
  const partida = partidaSnap.val();

  if (!partida) {
    throw new HttpsError("not-found", "La partida no existe.");
  }
  if (partida.turnoColocacion?.uidActivo !== uid) {
    throw new HttpsError("failed-precondition", "No es tu turno.");
  }

  await avanzarFaseColocacion(partidaId, uid);
  return { exito: true };
});

// --- NUEVO: verificación de timeout, puede llamarla cualquiera de los dos
// jugadores, pero la decisión real usa el reloj del servidor, no el cliente.
exports.verificarTimeoutColocacion = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
  }

  const { partidaId } = request.data || {};
  if (!partidaId) {
    throw new HttpsError("invalid-argument", "Falta el ID de partida.");
  }

  const partidaSnap = await rtdb.ref(`partidas/${partidaId}`).once("value");
  const partida = partidaSnap.val();

  if (!partida || partida.estado !== "preparacion") {
    return { expirado: false };
  }
  if (!partida.jugadores?.[uid]) {
    throw new HttpsError("permission-denied", "No perteneces a esta partida.");
  }

  const finalizaEn = partida.turnoColocacion?.finalizaEn;
  const ahoraServidor = Date.now();

  if (!finalizaEn || ahoraServidor < finalizaEn) {
    return { expirado: false };
  }

  // --- NUEVO: verificar si hay alguna bomba colocada hace menos de 3s ---
  // Si la hay, esperamos a que termine su visibilidad antes de avanzar,
  // para no cortar la fase mientras una bomba sigue mostrándose.
  const TIEMPO_VISIBLE_MS = 3000;
  const casillas = partida.casillas || {};
  let bombaMasReciente = 0;

  Object.values(casillas).forEach((casilla) => {
    (casilla.bombas || []).forEach((bomba) => {
      if (bomba.colocadaEn > bombaMasReciente) {
        bombaMasReciente = bomba.colocadaEn;
      }
    });
  });

  const tiempoDesdeUltimaBomba = ahoraServidor - bombaMasReciente;
  if (bombaMasReciente > 0 && tiempoDesdeUltimaBomba < TIEMPO_VISIBLE_MS) {
    // Todavía hay una bomba visible; no avanzamos todavía.
    return { expirado: false, esperandoOcultamiento: true };
  }

  const uidActivo = partida.turnoColocacion.uidActivo;
  await avanzarFaseColocacion(partidaId, uidActivo);

  return { expirado: true };
});

function siguienteInicioColocacion(tipoFin, uidQueActivo, uidRival) {
  // Detonación: quien hizo explotar la bomba inicia la siguiente ronda
  if (tipoFin === "detonacion") return uidQueActivo;
  // Limpieza de tablero: quien NO tuvo el último turno inicia
  return uidRival;
}

// --- Helper: arma una nueva ronda (o resuelve fin de partida en ronda 10) ---
async function iniciarNuevaRonda(partidaId, uidInicial) {
  const partidaSnap = await rtdb.ref(`partidas/${partidaId}`).once("value");
  const partida = partidaSnap.val();
  if (!partida) return;

  const nuevaRonda = partida.ronda + 1;

  if (nuevaRonda > 10) {
    // RQNF-GAM-10: límite de rondas alcanzado, se decide por vidas restantes
    await resolverDesempatePorRondas(partidaId, partida);
    return;
  }

  const casillasNuevas = generarCasillas(partida.tablero, nuevaRonda);
  const uids = Object.keys(partida.jugadores);

  const updates = {
    ronda: nuevaRonda,
    casillas: casillasNuevas,
    estado: "preparacion",
    turnoJuego: null,
    turnoColocacion: {
      uidActivo: uidInicial,
      inicioEn: Date.now(),
      finalizaEn: Date.now() + 30000,
    },
  };

  uids.forEach((id) => {
    const clase = partida.jugadores[id].clase;
    updates[`jugadores/${id}/bombasDisponibles`] = obtenerCantidadBombas(clase, nuevaRonda);
    updates[`jugadores/${id}/yaColoco`] = false;
    updates[`jugadores/${id}/coloco`] = false;
  });

  await rtdb.ref(`partidas/${partidaId}`).update(updates);
  console.log(`[Ronda] Nueva ronda ${nuevaRonda} para partida ${partidaId}, inicia ${uidInicial}`);
}

// Reemplaza tu resolverDesempatePorRondas actual por esta versión:
async function resolverDesempatePorRondas(partidaId, partida) {
  const uids = Object.keys(partida.jugadores);
  const [uidA, uidB] = uids;
  const vidasA = partida.jugadores[uidA].vidas;
  const vidasB = partida.jugadores[uidB].vidas;

  const updates = { estado: "finalizada", turnoJuego: null };

  if (vidasA === vidasB) {
    updates.resultado = "empate";
  } else {
    const uidGanador = vidasA > vidasB ? uidA : uidB;
    updates.resultado = "victoria";
    updates.ganador = uidGanador;
  }

  await rtdb.ref(`partidas/${partidaId}`).update(updates);
  console.log(`[Partida] Finalizada por límite de rondas: ${partidaId}`);

  const partidaActualizada = { ...partida, ...updates };
  if (updates.resultado === "empate") {
    await aplicarResultadoCompetitivo(partidaId, partidaActualizada, { tipo: "empate" });
  } else {
    await aplicarResultadoCompetitivo(partidaId, partidaActualizada, {
      tipo: "victoria",
      ganador: updates.ganador,
    });
  }
}

// Reemplaza tu finalizarPartidaPorDerrota actual por esta versión (le agregué 2 líneas al final):
async function finalizarPartidaPorDerrota(partidaId, uidPerdedor, uidGanador) {
  await rtdb.ref(`partidas/${partidaId}`).update({
    estado: "finalizada",
    resultado: "victoria",
    ganador: uidGanador,
    turnoJuego: null,
  });
  console.log(`[Partida] ${partidaId} finalizada, ganador: ${uidGanador}`);

  const partidaSnap = await rtdb.ref(`partidas/${partidaId}`).once("value");
  const partida = partidaSnap.val();
  await aplicarResultadoCompetitivo(partidaId, partida, { tipo: "victoria", ganador: uidGanador });
}

// --- Función principal: activar una casilla durante el juego ---
exports.activarCasilla = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
  }

  const { partidaId, casillaClave } = request.data || {};
  if (!partidaId || !casillaClave) {
    throw new HttpsError("invalid-argument", "Faltan datos.");
  }

  const partidaSnap = await rtdb.ref(`partidas/${partidaId}`).once("value");
  const partida = partidaSnap.val();

  if (!partida) throw new HttpsError("not-found", "La partida no existe.");
  if (partida.estado !== "en_curso") {
    throw new HttpsError("failed-precondition", "La partida no está en curso.");
  }
  if (partida.turnoJuego?.uidActivo !== uid) {
    throw new HttpsError("failed-precondition", "No es tu turno.");
  }

  const casilla = partida.casillas?.[casillaClave];
  if (!casilla) throw new HttpsError("invalid-argument", "Casilla inválida.");
  if (casilla.segura === true) {
    throw new HttpsError("failed-precondition", "Esa casilla ya está bloqueada.");
  }

  const uids = Object.keys(partida.jugadores);
  const uidRival = uids.find((id) => id !== uid);
  const bombas = casilla.bombas || [];

  if (bombas.length > 0) {
    // --- Detonación: aplica daño al jugador activo (RQF-GAM-08/08B) ---
    const danoTotal = bombas.reduce((sum, b) => sum + (b.dano || 0), 0);
    const vidasActuales = partida.jugadores[uid].vidas;
    const vidasNuevas = Math.max(0, vidasActuales - danoTotal);

    await rtdb.ref(`partidas/${partidaId}/jugadores/${uid}/vidas`).set(vidasNuevas);
    console.log(`[Juego] ${uid} detonó ${casillaClave}, daño=${danoTotal}, vidas restantes=${vidasNuevas}`);

    if (vidasNuevas <= 0) {
      await finalizarPartidaPorDerrota(partidaId, uid, uidRival);
      return { resultado: "derrota", vidasNuevas };
    }

    const uidInicioSiguiente = siguienteInicioColocacion("detonacion", uid, uidRival);
    await iniciarNuevaRonda(partidaId, uidInicioSiguiente);
    return { resultado: "detonacion", vidasNuevas };
  } else {
  // --- Casilla segura (RQF-GAM-06/07) ---
    const updates = {};
    updates[`casillas/${casillaClave}/segura`] = true;

    const todasLasCasillas = { ...partida.casillas, [casillaClave]: { ...casilla, segura: true } };

  // Solo nos importan las casillas SIN bombas para saber si ya se
  // completó la limpieza (las casillas con bombas nunca se marcan "segura")
    const casillasSinBomba = Object.values(todasLasCasillas).filter(
      (c) => !(c.bombas && c.bombas.length > 0)
    );
    const quedanSegurasSinMarcar = casillasSinBomba.some((c) => c.segura !== true);

    if (!quedanSegurasSinMarcar) {
    // Limpieza completa -> fin de ronda
      await rtdb.ref(`partidas/${partidaId}`).update(updates);
      const uidInicioSiguiente = siguienteInicioColocacion("limpieza", uid, uidRival);
      await iniciarNuevaRonda(partidaId, uidInicioSiguiente);
      return { resultado: "limpieza_completa" };
    } else {
      updates.turnoJuego = {
        uidActivo: uidRival,
        inicioEn: Date.now(),
        finalizaEn: Date.now() + duracionTurnoJuego(partida.ronda),
      };
      await rtdb.ref(`partidas/${partidaId}`).update(updates);
      return { resultado: "segura" };
    }
  }
});

exports.verificarTimeoutJuego = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Debes iniciar sesión.");

  const { partidaId } = request.data || {};
  if (!partidaId) throw new HttpsError("invalid-argument", "Falta el ID de partida.");

  const partidaSnap = await rtdb.ref(`partidas/${partidaId}`).once("value");
  const partida = partidaSnap.val();

  if (!partida || partida.estado !== "en_curso") return { expirado: false };
  if (!partida.jugadores?.[uid]) {
    throw new HttpsError("permission-denied", "No perteneces a esta partida.");
  }

  const finalizaEn = partida.turnoJuego?.finalizaEn;
  if (!finalizaEn || Date.now() < finalizaEn) return { expirado: false };

  const uidActivo = partida.turnoJuego.uidActivo;
  const uidRival = Object.keys(partida.jugadores).find((id) => id !== uidActivo);
  const vidasActuales = partida.jugadores[uidActivo].vidas;
  const vidasNuevas = Math.max(0, vidasActuales - 1); // RQF-GAM-09: pierde 1 vida

  await rtdb.ref(`partidas/${partidaId}/jugadores/${uidActivo}/vidas`).set(vidasNuevas);
  console.log(`[Juego] Timeout de ${uidActivo}, pierde 1 vida, restantes=${vidasNuevas}`);

  if (vidasNuevas <= 0) {
    await finalizarPartidaPorDerrota(partidaId, uidActivo, uidRival);
    return { expirado: true, resultado: "derrota" };
  }

  // RQF-GAM-09: si expira, termina la ronda (mismo tratamiento que detonación
  // en cuanto a quién inicia la siguiente colocación, ya que "termina la ronda")
  const uidInicioSiguiente = siguienteInicioColocacion("detonacion", uidActivo, uidRival);
  await iniciarNuevaRonda(partidaId, uidInicioSiguiente);

  return { expirado: true, resultado: "timeout" };
});

async function actualizarPerfilTrasPartida(uid, modalidad, datos) {
  const perfilRef = firestore.collection("usuarios").doc(uid);
  const perfilSnap = await perfilRef.get();
  if (!perfilSnap.exists) return;

  const stats = perfilSnap.data()?.estadisticas?.[modalidad] || {};
  const nuevoRango = determinarRango(datos.elo);

  const actualizaciones = {
    [`estadisticas.${modalidad}.elo`]: datos.elo,
    [`estadisticas.${modalidad}.rango`]: nuevoRango,
  };

  if (datos.esVictoria !== undefined) {
    actualizaciones[`estadisticas.${modalidad}.victorias`] = FieldValue.increment(
      datos.esVictoria ? 1 : 0
    );
    actualizaciones[`estadisticas.${modalidad}.derrotas`] = FieldValue.increment(
      datos.esVictoria ? 0 : 1
    );
    actualizaciones[`estadisticas.${modalidad}.vidasPerdidas`] = FieldValue.increment(
      datos.vidasPerdidas || 0
    );
    if (datos.esVictoria && datos.vidasPerdidas === 0) {
      actualizaciones[`estadisticas.${modalidad}.partidasSinPerderVida`] = FieldValue.increment(1);
    }
    actualizaciones.coronas = FieldValue.increment(datos.coronas || 0);
  }

  await perfilRef.update(actualizaciones);
  console.log(`[Competitivo] Perfil ${uid} actualizado: elo=${datos.elo}, rango=${nuevoRango}`);
}

async function finalizarPartidaPorDerrota(partidaId, uidPerdedor, uidGanador) {
  await rtdb.ref(`partidas/${partidaId}`).update({
    estado: "finalizada",
    resultado: "victoria",
    ganador: uidGanador,
    turnoJuego: null,
  });
  console.log(`[Partida] ${partidaId} finalizada, ganador: ${uidGanador}`);

  const partidaSnap = await rtdb.ref(`partidas/${partidaId}`).once("value");
  const partida = partidaSnap.val();
  await aplicarResultadoCompetitivo(partidaId, partida, { tipo: "victoria", ganador: uidGanador });
}

async function resolverDesempatePorRondas(partidaId, partida) {
  const uids = Object.keys(partida.jugadores);
  const [uidA, uidB] = uids;
  const vidasA = partida.jugadores[uidA].vidas;
  const vidasB = partida.jugadores[uidB].vidas;

  const updates = { estado: "finalizada", turnoJuego: null };

  if (vidasA === vidasB) {
    updates.resultado = "empate";
  } else {
    const uidGanador = vidasA > vidasB ? uidA : uidB;
    updates.resultado = "victoria";
    updates.ganador = uidGanador;
  }

  await rtdb.ref(`partidas/${partidaId}`).update(updates);
  console.log(`[Partida] Finalizada por límite de rondas: ${partidaId}`);

  const partidaActualizada = { ...partida, ...updates };
  if (updates.resultado === "empate") {
    await aplicarResultadoCompetitivo(partidaId, partidaActualizada, { tipo: "empate" });
  } else {
    await aplicarResultadoCompetitivo(partidaId, partidaActualizada, {
      tipo: "victoria",
      ganador: updates.ganador,
    });
  }
}