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
const { getFirestore } = require("firebase-admin/firestore");
const { registrarProgreso } = require("./misiones");
const { obtenerCantidadBombasVenenosas } = require("./bombas");
const {
  generarCasillasElementales,
  casillasPropiasDisponibles,
  marcarCasillaPropia,
  aplicarBombaElectrica,
  aplicarBombaLianas,
  aplicarBombaHielo,
  partidaTerminada: partidaElementalTerminada,
  resolverGanadorPorCasillas,
  otroJugador: otroJugadorElemental,
  ANCHO_TABLERO: ANCHO_TABLERO_ELEMENTAL,
  ALTO_TABLERO: ALTO_TABLERO_ELEMENTAL,
} = require("./elementales");

// Timer de turno fijo confirmado para Bombas Elementales (una sola ronda,
// no hay progresión de rondas como en Estándar/Venenosas).
const DURACION_TURNO_ELEMENTAL_MS = 7000;
const { onValueWritten } = require("firebase-functions/v2/database");
const { getDatabase } = require("firebase-admin/database");
const { initializeApp, getApps } = require("firebase-admin/app");

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

exports.validarUsername = onCall(async (request) => {
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

  if (esOfensivo) {
    return { valido: false, motivo: "ofensivo" };
  }

  // Verificación de unicidad, usando Admin SDK (ignora reglas de seguridad)
  const firestore = getFirestore();
  const snapshot = await firestore
    .collection("usuarios")
    .where("username", "==", username.trim())
    .limit(1)
    .get();

  if (!snapshot.empty) {
    return { valido: false, motivo: "en_uso" };
  }

  return { valido: true };
});

exports.limpiarInvitadosViejos = require("./mantenimiento").limpiarInvitadosViejos;
exports.comprarCosmetico = require("./tienda").comprarCosmetico;

//TRIGGER MATCHMAKING - RECIBE CADA VEZ QUE CAMBIA LA COLA



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

// Reemplaza este bloque completo dentro de intentarEmparejar:

const ahora = Date.now();
const tiempoEsperando = ahora - jugador.timestamp;

const UMBRAL_SENOR = 1000;
const UMBRAL_SENOR_SIN_LIMITE = 1150;

const candidatosValidos = candidatos.filter((c) => {
  const tiempoEsperandoCandidato = ahora - c.timestamp;
  const tiempoMax = Math.max(tiempoEsperando, tiempoEsperandoCandidato);

  if (jugador.elo >= UMBRAL_SENOR_SIN_LIMITE) {
    if (c.elo < UMBRAL_SENOR) return false;

    let tolerancia = 30;
    if (tiempoMax >= 15000) tolerancia = Infinity;
    else if (tiempoMax >= 5000) tolerancia = 60;
    return Math.abs(c.elo - jugador.elo) <= tolerancia;
  }

  let tolerancia = 30;
  if (tiempoMax >= 15000) tolerancia = 150;
  else if (tiempoMax >= 5000) tolerancia = 60;
  return Math.abs(c.elo - jugador.elo) <= tolerancia;
});

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

    const esVenenosas = modalidad === "venenosas";
    const esElementales = modalidad === "elementales";
    const claseJugador = (esVenenosas || esElementales) ? null : resolverClase(jugador.clase);
    const claseRival = (esVenenosas || esElementales) ? null : resolverClase(rival.clase);

    const bombasIniciales = esVenenosas
      ? obtenerCantidadBombasVenenosas(1)
      : esElementales
        ? null
        : obtenerCantidadBombas(claseJugador, 1);
    const bombasIncialesRival = esVenenosas
      ? obtenerCantidadBombasVenenosas(1)
      : esElementales
        ? null
        : obtenerCantidadBombas(claseRival, 1)

      console.log(`[Matchmaking] esVenenosas=${esVenenosas}, esElementales=${esElementales}, bombasIniciales=${bombasIniciales}, bombasIncialesRival=${bombasIncialesRival}`);

    const updates = {};
    updates[`colaEspera/${modalidad}/${uid}`] = null;
    updates[`colaEspera/${modalidad}/${rival.uid}`] = null;

    if (esElementales) {
      // Elementales no tiene selección de tablero al azar ni rondas: el
      // tablero es fijo (el rectángulo más grande) y la partida arranca
      // "en_curso" de inmediato, sin pasar por "generando_tablero".
      const indiceAzul = Math.floor(Math.random() * 2);
      const uidAzul = indiceAzul === 0 ? uid : rival.uid;
      const uidRojo = indiceAzul === 0 ? rival.uid : uid;
      const datosPorUid = { [uid]: jugador, [rival.uid]: rival };

      updates[`partidas/${partidaId}`] = {
        modalidad,
        tipo: "matchmaking",
        estado: "en_curso",
        anchoTablero: ANCHO_TABLERO_ELEMENTAL,
        altoTablero: ALTO_TABLERO_ELEMENTAL,
        casillas: generarCasillasElementales(),
        numeroTurno: 1,
        jugadores: {
          [uidAzul]: {
            color: "azul",
            esInvitado: datosPorUid[uidAzul].esInvitado === true,
            eloInicial: datosPorUid[uidAzul].elo ?? 0,
            casillasMarcadas: 0,
            bombas: { electrica: true, lianas: true, hielo: true },
            congeladoPorTurnos: 0,
          },
          [uidRojo]: {
            color: "rojo",
            esInvitado: datosPorUid[uidRojo].esInvitado === true,
            eloInicial: datosPorUid[uidRojo].elo ?? 0,
            casillasMarcadas: 0,
            bombas: { electrica: true, lianas: true, hielo: true },
            congeladoPorTurnos: 0,
          },
        },
        turnoActual: {
          uidActivo: uidAzul,
          inicioEn: ahora,
          finalizaEn: ahora + DURACION_TURNO_ELEMENTAL_MS,
        },
        creadaEn: ahora,
      };
    } else {
      updates[`partidas/${partidaId}`] = {
        modalidad,
        tipo: "matchmaking",
        tablero: null,
        ronda: 1,
        estado: "generando_tablero",
        jugadores: {
          [uid]: {
            vidas: 3,
            clase: claseJugador,
            listo: false,
            esInvitado: jugador.esInvitado === true,
            eloInicial: jugador.elo ?? 0,
            bombasDisponibles: bombasIniciales,
            cargasVeneno: [],
          },
          [rival.uid]: {
            vidas: 3,
            clase: claseRival,
            listo: false,
            esInvitado: rival.esInvitado === true,
            eloInicial: rival.elo ?? 0,
            bombasDisponibles: bombasIncialesRival,
            cargasVeneno: [],
          },
        },
        creadaEn: ahora,
      };
    }
    updates[`notificacionesPartida/${uid}`] = partidaId;
    updates[`notificacionesPartida/${rival.uid}`] = partidaId;

    await rtdb.ref().update(updates);

    console.log(`[Matchmaking] ¡Partida creada! ID: ${partidaId} (esperando generación de tablero)`);
  } finally {

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

    const partidaSnap = await rtdb.ref(`partidas/${partidaId}/jugadores`).once("value");
    const jugadores = partidaSnap.val();
    const uids = Object.keys(jugadores);

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
    tipo: jugador.clase || "veneno",
    dano: jugador.clase ? obtenerDanoBomba(jugador.clase) : 0,
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

  await registrarProgreso(uid, "bomba_colocada", 1);
  if (jugador.clase === "bombota") {
    await registrarProgreso(uid, "partida_con_bombota", 1);
  }

  return { exito: true, bombasRestantes: jugador.bombasDisponibles - 1 };
});

exports.tickVeneno = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Debes iniciar sesión.");

  const { partidaId } = request.data || {};
  if (!partidaId) throw new HttpsError("invalid-argument", "Falta el ID de partida.");

  const partidaSnap = await rtdb.ref(`partidas/${partidaId}`).once("value");
  const partida = partidaSnap.val();

  if (!partida || partida.estado !== "en_curso" || partida.modalidad !== "venenosas") {
    return { aplicado: false };
  }
  if (!partida.jugadores?.[uid]) {
    throw new HttpsError("permission-denied", "No perteneces a esta partida.");
  }

  const TICK_MS = 10000;
  const ahora = Date.now();
  const jugador = partida.jugadores[uid];
  const cargas = jugador.cargasVeneno || [];

  if (cargas.length === 0) return { aplicado: false };

  let dañoTotal = 0;
  const cargasActualizadas = cargas.map((carga) => {
    const intervalosTranscurridos = Math.floor((ahora - carga.ultimoTick) / TICK_MS);
    if (intervalosTranscurridos > 0) {
      dañoTotal += intervalosTranscurridos * 0.25;
      return { ...carga, ultimoTick: carga.ultimoTick + intervalosTranscurridos * TICK_MS };
    }
    return carga;
  });

  if (dañoTotal === 0) return { aplicado: false };

  const vidasNuevas = Math.max(0, jugador.vidas - dañoTotal);

  await rtdb.ref(`partidas/${partidaId}/jugadores/${uid}`).update({
    vidas: vidasNuevas,
    cargasVeneno: cargasActualizadas,
  });

  console.log(`[Veneno] Tick para ${uid}: -${dañoTotal}, vidas=${vidasNuevas}`);

  if (vidasNuevas <= 0) {
    const uidRival = Object.keys(partida.jugadores).find((id) => id !== uid);
    await finalizarPartidaPorDerrota(partidaId, uid, uidRival);
    return { aplicado: true, resultado: "derrota", vidasNuevas };
  }

  return { aplicado: true, vidasNuevas };
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
    const esVenenosas = partida.modalidad === "venenosas";
    const clase = partida.jugadores[id].clase;
    updates[`jugadores/${id}/bombasDisponibles`] = esVenenosas
      ? obtenerCantidadBombasVenenosas(nuevaRonda)
      : obtenerCantidadBombas(clase, nuevaRonda);
    updates[`jugadores/${id}/yaColoco`] = false;
    updates[`jugadores/${id}/coloco`] = false;
    updates[`jugadores/${id}/cargasVeneno`] = [];
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
  if (casilla.detonada === true) {
    throw new HttpsError("failed-precondition", "Esa casilla ya fue detonada.");
  }

  const uids = Object.keys(partida.jugadores);
  const uidRival = uids.find((id) => id !== uid);
  const bombas = casilla.bombas || [];

  if (bombas.length > 0) {
    if (partida.modalidad === "venenosas") {
    // --- Modo Venenosas: aplica cargas de veneno, NO termina la ronda ---
      const cantidadCargas = bombas.length;
      const ahora = Date.now();
      const dañoInicial = cantidadCargas * 0.25;

      const cargasActuales = partida.jugadores[uid].cargasVeneno || [];
      const nuevasCargas = [];
      for (let i = 0; i < cantidadCargas; i++) {
        nuevasCargas.push({ creadaEn: ahora, ultimoTick: ahora });
      }

      const vidasActuales = partida.jugadores[uid].vidas;
      const vidasNuevas = Math.max(0, vidasActuales - dañoInicial);

      const updates = {};
      updates[`casillas/${casillaClave}/detonada`] = true;
      updates[`jugadores/${uid}/vidas`] = vidasNuevas;
      updates[`jugadores/${uid}/cargasVeneno`] = [...cargasActuales, ...nuevasCargas];
      updates.turnoJuego = {
        uidActivo: uidRival,
        inicioEn: Date.now(),
        finalizaEn: Date.now() + duracionTurnoJuego(partida.ronda),
      };

      await rtdb.ref(`partidas/${partidaId}`).update(updates);
      console.log(`[Veneno] ${uid} detonó ${casillaClave}, cargas=${cantidadCargas}, daño inicial=${dañoInicial}, vidas=${vidasNuevas}`);

      if (vidasNuevas <= 0) {
        await finalizarPartidaPorDerrota(partidaId, uid, uidRival);
        return { resultado: "derrota", vidasNuevas };
      }

      return { resultado: "veneno_aplicado", cargas: cantidadCargas, vidasNuevas };
    }

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
    await registrarProgreso(uid, "casilla_segura_descubierta", 1);

    const updates = {};
    updates[`casillas/${casillaClave}/segura`] = true;

    const todasLasCasillas = { ...partida.casillas, [casillaClave]: { ...casilla, segura: true } };

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

  if (partida.modalidad === "venenosas") {
    // En Venenosas, el timeout SOLO pasa el turno - la ronda únicamente
    // avanza al limpiar todas las casillas seguras (RQF-MOD-01/02).
    await rtdb.ref(`partidas/${partidaId}/turnoJuego`).set({
      uidActivo: uidRival,
      inicioEn: Date.now(),
      finalizaEn: Date.now() + duracionTurnoJuego(partida.ronda),
    });
    console.log(`[Veneno] Timeout: turno pasa a ${uidRival}, misma ronda`);
    return { expirado: true, resultado: "timeout_pasa_turno" };
  }

  // Estándar: comportamiento original, termina la ronda
  const uidInicioSiguiente = siguienteInicioColocacion("detonacion", uidActivo, uidRival);
  await iniciarNuevaRonda(partidaId, uidInicioSiguiente);

  return { expirado: true, resultado: "timeout" };
});

exports.rotarMisionesDiarias = require("./misiones").rotarMisionesDiarias;

// ============================================================
// BOMBAS ELEMENTALES (Modo Extra: juego de territorio, sin vidas)
// ============================================================

/** Avanza el turno tras una jugada válida en Elementales: revisa si la
 * partida terminó, salta el turno de cualquier jugador congelado, y arma
 * el siguiente `turnoActual` con el timer fijo de 7s. */
async function avanzarTurnoElemental(partidaId, uidPropuesto) {
  const partidaSnap = await rtdb.ref(`partidas/${partidaId}`).once("value");
  const partida = partidaSnap.val();
  if (!partida || partida.estado !== "en_curso") return;

  if (partidaElementalTerminada(partida)) {
    await finalizarPartidaElemental(partidaId, partida);
    return;
  }

  let siguienteUid = uidPropuesto;
  let numeroTurno = (partida.numeroTurno || 1) + 1;
  const actualizaciones = {};

  // Si el siguiente jugador está congelado (Bomba de Hielo), se le salta
  // el turno automáticamente.
  let vueltas = 0;
  while ((partida.jugadores[siguienteUid]?.congeladoPorTurnos || 0) > 0 && vueltas < 4) {
    actualizaciones[`jugadores/${siguienteUid}/congeladoPorTurnos`] =
      partida.jugadores[siguienteUid].congeladoPorTurnos - 1;
    partida.jugadores[siguienteUid].congeladoPorTurnos -= 1;
    siguienteUid = otroJugadorElemental(siguienteUid, partida);
    numeroTurno += 1;
    vueltas += 1;
  }

  actualizaciones.numeroTurno = numeroTurno;
  actualizaciones.turnoActual = {
    uidActivo: siguienteUid,
    inicioEn: Date.now(),
    finalizaEn: Date.now() + DURACION_TURNO_ELEMENTAL_MS,
  };

  await rtdb.ref(`partidas/${partidaId}`).update(actualizaciones);
}

async function finalizarPartidaElemental(partidaId, partida) {
  const resultado = resolverGanadorPorCasillas(partida);
  await rtdb.ref(`partidas/${partidaId}`).update({
    estado: "finalizada",
    turnoActual: null,
    resultado: resultado.empate ? "empate" : "victoria",
    ganador: resultado.empate ? null : resultado.ganador,
  });
  console.log(`[Elementales] Partida ${partidaId} finalizada. ${resultado.empate ? "Empate" : `Gana ${resultado.ganador}`}`);

  const partidaActualizada = { ...partida, estado: "finalizada" };
  if (resultado.empate) {
    await aplicarResultadoCompetitivo(partidaId, partidaActualizada, { tipo: "empate" });
  } else {
    await aplicarResultadoCompetitivo(partidaId, partidaActualizada, {
      tipo: "victoria",
      ganador: resultado.ganador,
    });
  }
}

exports.marcarCasillaElemental = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Debes iniciar sesión.");

  const { partidaId, casillaClave } = request.data || {};
  if (!partidaId || !casillaClave) {
    throw new HttpsError("invalid-argument", "Faltan datos.");
  }

  const partidaSnap = await rtdb.ref(`partidas/${partidaId}`).once("value");
  const partida = partidaSnap.val();

  if (!partida || partida.modalidad !== "elementales") {
    throw new HttpsError("failed-precondition", "Esta partida no es de Bombas Elementales.");
  }
  if (partida.estado !== "en_curso") {
    throw new HttpsError("failed-precondition", "La partida no está en curso.");
  }
  if (partida.turnoActual?.uidActivo !== uid) {
    throw new HttpsError("failed-precondition", "No es tu turno.");
  }
  if (!partida.jugadores?.[uid]) {
    throw new HttpsError("permission-denied", "No perteneces a esta partida.");
  }

  if (!casillasPropiasDisponibles(uid, partida).includes(casillaClave)) {
    throw new HttpsError("invalid-argument", "Esa casilla no es un movimiento válido.");
  }

  const actualizaciones = marcarCasillaPropia(casillaClave, uid, partida);
  await rtdb.ref(`partidas/${partidaId}`).update(actualizaciones);
  await registrarProgreso(uid, "casilla_marcada_elemental", 1);

  await avanzarTurnoElemental(partidaId, otroJugadorElemental(uid, partida));
  return { exito: true };
});

exports.usarBombaElemental = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Debes iniciar sesión.");

  const { partidaId, tipoBomba, casillaObjetivo, casillasBloqueo } = request.data || {};
  if (!partidaId || !tipoBomba || !casillaObjetivo) {
    throw new HttpsError("invalid-argument", "Faltan datos.");
  }
  if (!["electrica", "lianas", "hielo"].includes(tipoBomba)) {
    throw new HttpsError("invalid-argument", "Tipo de bomba inválido.");
  }

  const partidaSnap = await rtdb.ref(`partidas/${partidaId}`).once("value");
  const partida = partidaSnap.val();

  if (!partida || partida.modalidad !== "elementales") {
    throw new HttpsError("failed-precondition", "Esta partida no es de Bombas Elementales.");
  }
  if (partida.estado !== "en_curso") {
    throw new HttpsError("failed-precondition", "La partida no está en curso.");
  }
  if (partida.turnoActual?.uidActivo !== uid) {
    throw new HttpsError("failed-precondition", "No es tu turno.");
  }
  const jugador = partida.jugadores?.[uid];
  if (!jugador) throw new HttpsError("permission-denied", "No perteneces a esta partida.");
  if (!jugador.bombas?.[tipoBomba]) {
    throw new HttpsError("failed-precondition", "Ya usaste esa bomba.");
  }

  let actualizaciones;
  try {
    if (tipoBomba === "electrica") {
      actualizaciones = aplicarBombaElectrica(casillaObjetivo, uid, partida);
    } else if (tipoBomba === "lianas") {
      actualizaciones = aplicarBombaLianas(casillaObjetivo, casillasBloqueo, uid, partida);
    } else {
      actualizaciones = aplicarBombaHielo(casillaObjetivo, uid, partida);
    }
  } catch (err) {
    throw new HttpsError("invalid-argument", err.message);
  }

  await rtdb.ref(`partidas/${partidaId}`).update(actualizaciones);
  await registrarProgreso(uid, "bomba_elemental_usada", 1);
  if (tipoBomba === "hielo") {
    await registrarProgreso(uid, "bomba_hielo_usada", 1);
  }

  await avanzarTurnoElemental(partidaId, otroJugadorElemental(uid, partida));
  return { exito: true };
});

exports.verificarTimeoutTurnoElemental = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Debes iniciar sesión.");

  const { partidaId } = request.data || {};
  if (!partidaId) throw new HttpsError("invalid-argument", "Falta el ID de partida.");

  const partidaSnap = await rtdb.ref(`partidas/${partidaId}`).once("value");
  const partida = partidaSnap.val();

  if (!partida || partida.modalidad !== "elementales" || partida.estado !== "en_curso") {
    return { expirado: false };
  }
  if (!partida.jugadores?.[uid]) {
    throw new HttpsError("permission-denied", "No perteneces a esta partida.");
  }

  const finalizaEn = partida.turnoActual?.finalizaEn;
  if (!finalizaEn || Date.now() < finalizaEn) return { expirado: false };

  const uidActivo = partida.turnoActual.uidActivo;
  // Se le acabó el tiempo: pierde el turno sin marcar nada (confirmado).
  await avanzarTurnoElemental(partidaId, otroJugadorElemental(uidActivo, partida));

  return { expirado: true, resultado: "turno_perdido" };
});