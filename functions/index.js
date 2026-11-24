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
  detectarRellenoAutomatico,
  rellenarCasillasPara,
  partidaTerminada: partidaElementalTerminada,
  resolverGanadorPorCasillas,
  otroJugador: otroJugadorElemental,
  ANCHO_TABLERO: ANCHO_TABLERO_ELEMENTAL,
  ALTO_TABLERO: ALTO_TABLERO_ELEMENTAL,
} = require("./elementales");

const DURACION_TURNO_ELEMENTAL_MS = 7000;

const GRACIA_TURNO_ELEMENTAL_MS = 2500;

function validarAccionEnTiempoElemental(partida, { numeroTurno, enviadoEn }) {
 
  if (numeroTurno != null && numeroTurno !== partida.numeroTurno) {
    throw new HttpsError("failed-precondition", "Se acabó el tiempo de tu turno.");
  }
  const finalizaEn = partida.turnoActual?.finalizaEn;
  if (!finalizaEn) return;
  if (typeof enviadoEn === "number") {
    // 500 ms de tolerancia por la imprecisión de serverTimeOffset
    if (enviadoEn > finalizaEn + 500) {
      throw new HttpsError("failed-precondition", "Se acabó el tiempo de tu turno.");
    }
  } else if (Date.now() > finalizaEn + GRACIA_TURNO_ELEMENTAL_MS) {
    throw new HttpsError("failed-precondition", "Se acabó el tiempo de tu turno.");
  }
}
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


const PALABRAS_PERMITIDAS = [
  "computadora", "computacion", "computar", "computo", "computa", "computer",
  "disputa", "disputo", "diputado", "diputada", "diputa", "imputa", "imputo",
  "reputacion", "reputa", "amputa",
  "calculo", "vehiculo", "articulo", "circulo", "ridiculo", "curriculo", "cubiculo",
  "capitolio", "epitome", "pitonisa", "piton",
  "escoger", "recoger", "acoger", "encoger",
  "sexto", "sexta", "sexteto", "sussex", "essex",
  "analisis", "analiza", "analog", "canal", "banal", "anales",
  "documento", "cumple", "cumbia", "cumbre", "acumula", "cucumber", "cumulo",
  "vergara", "scrap", "cocktail", "coctel", "peacock", "hancock", "dickens",
  "scunthorpe", "shitake", "fagot",
].map((p) => normalizar(p)).sort((a, b) => b.length - a.length);

function normalizar(texto) {
  let resultado = texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  resultado = resultado.split("").map((c) => MAPA_LEETSPEAK[c] ?? c).join("");
  resultado = resultado.replace(/[^a-z0-9]/g, "");
  resultado = resultado.replace(/(.)\1+/g, "$1");
  return resultado;
}

function quitarPalabrasPermitidas(textoNormalizado) {
  let resultado = textoNormalizado;
  for (const permitida of PALABRAS_PERMITIDAS) {
    resultado = resultado.split(permitida).join("#");
  }
  return resultado;
}

// Busca la palabra prohibida en cualquier parte del nombre (inicio, medio o
// final), así "xxxput0m" o "elputo123" no pasan el filtro.
function contienePalabraProhibida(textoNormalizado, listaPalabras) {
  const texto = quitarPalabrasPermitidas(textoNormalizado);
  return listaPalabras.some((palabra) => {
    const palabraNorm = normalizar(palabra);
    return palabraNorm.length > 0 && texto.includes(palabraNorm);
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
exports.obtenerCatalogoTienda = require("./tienda").obtenerCatalogoTienda;
exports.enviarSolicitudAmistad = require("./social").enviarSolicitudAmistad;
exports.responderSolicitudAmistad = require("./social").responderSolicitudAmistad;
exports.eliminarAmigo = require("./social").eliminarAmigo;
exports.obtenerIdAmigo = require("./social").obtenerIdAmigo;
exports.asignarIdAmigoNuevoUsuario = require("./social").asignarIdAmigoNuevoUsuario;
exports.crearLobby = require("./lobby").crearLobby;
exports.cancelarLobby = require("./lobby").cancelarLobby;
exports.rechazarReto = require("./lobby").rechazarReto;
exports.unirseALobby = require("./lobby").unirseALobby;
exports.expirarReto = require("./lobby").expirarReto;
exports.guardarEvento = require("./admin").guardarEvento;
exports.eliminarEvento = require("./admin").eliminarEvento;
exports.banearUsuario = require("./admin").banearUsuario;
exports.forzarCambioNombre = require("./admin").forzarCambioNombre;
exports.cerrarEventosVencidos = require("./eventos").cerrarEventosVencidos;

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
  // Invitados y usuarios registrados tienen colas separadas: un invitado
  // solo juega contra invitados y un registrado solo contra registrados.
  if ((jugador.esInvitado === true) !== (c.esInvitado === true)) return false;

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
        // El reloj del primer turno arranca cuando los dos entran
        // (confirmarEntradaPartida).
        turnoActual: { uidActivo: uidAzul },
        esperandoJugadores: true,
        esperandoDesde: ahora,
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

// ---------------------------------------------------------------------------
// TRANSACCIONES DE PARTIDA
// Todas las jugadas de Estándar y Venenosas modifican la partida dentro de una
// transacción: si dos llamadas llegan a la vez (un clic justo cuando se acaba
// el turno, los dos clientes pidiendo el timeout, una conexión lenta que
// reintenta...), solo una se aplica y la otra ve el estado ya actualizado.
// Antes, una jugada "vieja" podía escribirse encima de la ronda siguiente y
// dejar la partida rota (casilla segura en el tablero nuevo, ronda saltada...).
// ---------------------------------------------------------------------------

const DURACION_TURNO_COLOCACION_MS = 30000;
// Margen para jugadas hechas a tiempo que tardan en llegar al servidor.
const GRACIA_TURNO_MS = 800;
// Si un jugador no entra a la partida en este tiempo, la partida empieza igual.
const ESPERA_MAXIMA_JUGADORES_MS = 20000;
const TIEMPO_VISIBLE_BOMBA_MS = 3000;

/**
 * Ejecuta `fn(partida)` dentro de una transacción sobre partidas/{id}.
 * `fn` modifica la partida recibida y devuelve `info` (cualquier valor que no
 * sea undefined) para guardar los cambios, o undefined para no escribir nada.
 * Si `fn` lanza un HttpsError, la transacción se cancela y el error se relanza.
 */
async function transaccionPartida(partidaId, fn) {
  let rechazo = null;
  let info;
  const resultado = await rtdb.ref(`partidas/${partidaId}`).transaction(
    (actual) => {
      rechazo = null;
      info = undefined;
      // Primera llamada con la caché vacía: devolver null hace que Firebase
      // reintente con el valor real del servidor.
      if (actual === null) return null;
      try {
        info = fn(actual);
      } catch (err) {
        if (err instanceof HttpsError) {
          rechazo = err;
          return undefined;
        }
        throw err;
      }
      return info === undefined ? undefined : actual;
    },
    undefined,
    false
  );
  if (rechazo) throw rechazo;
  if (!resultado.snapshot.exists()) {
    throw new HttpsError("not-found", "La partida no existe.");
  }
  return {
    aplicado: resultado.committed && info !== undefined,
    info,
    partida: resultado.snapshot.val(),
  };
}

function nuevoTurno(uidActivo, duracionMs) {
  const ahora = Date.now();
  return { uidActivo, inicioEn: ahora, finalizaEn: ahora + duracionMs };
}

// Arranca el reloj del primer turno cuando ya están los dos jugadores.
function arrancarPrimerTurno(partida) {
  delete partida.esperandoJugadores;
  delete partida.esperandoDesde;
  if (partida.modalidad === "elementales") {
    partida.turnoActual = nuevoTurno(partida.turnoActual?.uidActivo, DURACION_TURNO_ELEMENTAL_MS);
  } else if (partida.estado === "preparacion") {
    partida.turnoColocacion = nuevoTurno(partida.turnoColocacion?.uidActivo, DURACION_TURNO_COLOCACION_MS);
  }
}

function todosEnPartida(partida) {
  return Object.values(partida.jugadores || {}).every((j) => j.listo === true);
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
    const indiceAzul = Math.floor(Math.random() * 2);

    // Transacción: si el trigger se ejecuta dos veces, la segunda no hace nada.
    const { aplicado, partida } = await transaccionPartida(partidaId, (p) => {
      if (p.estado !== "generando_tablero") return undefined;
      const uids = Object.keys(p.jugadores || {});
      const uidAzul = uids[indiceAzul];
      const uidRojo = uids[1 - indiceAzul];

      p.tablero = tipoTablero;
      p.casillas = casillasIniciales;
      p.estado = "preparacion";
      p.jugadores[uidAzul].color = "azul";
      p.jugadores[uidRojo].color = "rojo";
      p.turnoColocacion = { uidActivo: uidAzul };

      // El tiempo de colocación empieza cuando los dos ya están en la partida.
      if (todosEnPartida(p)) {
        arrancarPrimerTurno(p);
      } else {
        p.esperandoJugadores = true;
        p.esperandoDesde = Date.now();
      }
      return true;
    });

    if (aplicado) {
      console.log(
        `[Tablero] Completado para partida ${partidaId}, tipo: ${tipoTablero}, inicia: ${partida.turnoColocacion?.uidActivo}` +
          (partida.esperandoJugadores ? " (esperando a que entren los dos jugadores)" : "")
      );
    }
    return null;
  }
);

// Cada cliente la llama al abrir la partida (y cada pocos segundos mientras
// se espera al rival). Cuando los dos están dentro, empieza el primer turno.
exports.confirmarEntradaPartida = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
  const { partidaId } = request.data || {};
  if (!partidaId || typeof partidaId !== "string") {
    throw new HttpsError("invalid-argument", "Falta el ID de partida.");
  }

  const { aplicado, partida } = await transaccionPartida(partidaId, (p) => {
    if (!p.jugadores?.[uid]) {
      throw new HttpsError("permission-denied", "No perteneces a esta partida.");
    }
    let cambio = false;
    if (p.jugadores[uid].listo !== true) {
      p.jugadores[uid].listo = true;
      cambio = true;
    }
    if (p.esperandoJugadores) {
      const esperaVencida = Date.now() - (p.esperandoDesde || 0) >= ESPERA_MAXIMA_JUGADORES_MS;
      if (todosEnPartida(p) || esperaVencida) {
        arrancarPrimerTurno(p);
        cambio = true;
      }
    }
    return cambio ? true : undefined;
  });

  return { aplicado, esperando: partida.esperandoJugadores === true };
});

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

  const { info } = await transaccionPartida(partidaId, (partida) => {
    if (partida.estado !== "preparacion") {
      throw new HttpsError("failed-precondition", "No estás en fase de preparación.");
    }
    if (partida.esperandoJugadores) {
      throw new HttpsError("failed-precondition", "Esperando a que tu rival entre a la partida.");
    }
    if (partida.turnoColocacion?.uidActivo !== uid) {
      throw new HttpsError("failed-precondition", "No es tu turno de colocar bombas.");
    }
    const finalizaEn = partida.turnoColocacion?.finalizaEn;
    if (finalizaEn && Date.now() > finalizaEn + GRACIA_TURNO_MS) {
      throw new HttpsError("failed-precondition", "Se acabó tu tiempo de colocación.");
    }
    const jugador = partida.jugadores?.[uid];
    if (!jugador) {
      throw new HttpsError("permission-denied", "No perteneces a esta partida.");
    }
    if ((jugador.bombasDisponibles || 0) <= 0) {
      throw new HttpsError("failed-precondition", "Ya no tienes bombas disponibles.");
    }
    const casilla = partida.casillas?.[casillaClave];
    if (!casilla) {
      throw new HttpsError("invalid-argument", "Casilla inválida.");
    }

    casilla.bombas = [
      ...(casilla.bombas || []),
      {
        uid,
        tipo: jugador.clase || "veneno",
        dano: jugador.clase ? obtenerDanoBomba(jugador.clase) : 0,
        colocadaEn: Date.now(),
      },
    ];
    jugador.bombasDisponibles -= 1;
    jugador.coloco = true;
    return { clase: jugador.clase, restantes: jugador.bombasDisponibles };
  });

  await registrarProgreso(uid, "bomba_colocada", 1);
  if (info.clase === "bombota") {
    await registrarProgreso(uid, "partida_con_bombota", 1);
  }

  return { exito: true, bombasRestantes: info.restantes };
});

exports.tickVeneno = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Debes iniciar sesión.");

  const { partidaId } = request.data || {};
  if (!partidaId) throw new HttpsError("invalid-argument", "Falta el ID de partida.");

  const TICK_MS = 10000;
  const { info } = await transaccionPartida(partidaId, (partida) => {
    if (partida.estado !== "en_curso" || partida.modalidad !== "venenosas") return undefined;
    const jugador = partida.jugadores?.[uid];
    if (!jugador) {
      throw new HttpsError("permission-denied", "No perteneces a esta partida.");
    }
    const cargas = jugador.cargasVeneno || [];
    if (cargas.length === 0) return undefined;

    const ahora = Date.now();
    let danoTotal = 0;
    jugador.cargasVeneno = cargas.map((carga) => {
      const intervalos = Math.floor((ahora - carga.ultimoTick) / TICK_MS);
      if (intervalos <= 0) return carga;
      danoTotal += intervalos * 0.25;
      return { ...carga, ultimoTick: carga.ultimoTick + intervalos * TICK_MS };
    });
    if (danoTotal === 0) return undefined;

    jugador.vidas = Math.max(0, jugador.vidas - danoTotal);
    return { danoTotal, vidasNuevas: jugador.vidas };
  });

  if (!info) return { aplicado: false };
  console.log(`[Veneno] Tick para ${uid}: -${info.danoTotal}, vidas=${info.vidasNuevas}`);

  if (info.vidasNuevas <= 0) {
    await finalizarPartidaPorDerrota(partidaId, uid);
    return { aplicado: true, resultado: "derrota", vidasNuevas: info.vidasNuevas };
  }
  return { aplicado: true, vidasNuevas: info.vidasNuevas };
});

async function avanzarFaseColocacion(partidaId, uidQueTermina) {
  const partida = (await rtdb.ref(`partidas/${partidaId}`).once("value")).val();
  if (!partida || partida.estado !== "preparacion" || partida.esperandoJugadores) return;
  if (partida.turnoColocacion?.uidActivo !== uidQueTermina) {
    console.log(`[Preparación] Turno ya fue procesado para ${uidQueTermina}, abortando.`);
    return;
  }
  const rondaLeida = partida.ronda;

  // Esperamos a que la última bomba complete su visibilidad de 3 s.
  let bombaMasReciente = 0;
  Object.values(partida.casillas || {}).forEach((casilla) => {
    (casilla.bombas || []).forEach((bomba) => {
      if (bomba.colocadaEn > bombaMasReciente) bombaMasReciente = bomba.colocadaEn;
    });
  });
  const tiempoDesdeUltimaBomba = Date.now() - bombaMasReciente;
  if (bombaMasReciente > 0 && tiempoDesdeUltimaBomba < TIEMPO_VISIBLE_BOMBA_MS) {
    await esperar(TIEMPO_VISIBLE_BOMBA_MS - tiempoDesdeUltimaBomba);
  }

  const { aplicado, info } = await transaccionPartida(partidaId, (p) => {
    // Si otra llamada ya cerró este turno, no se vuelve a cerrar.
    if (
      p.estado !== "preparacion" ||
      p.ronda !== rondaLeida ||
      p.esperandoJugadores ||
      p.turnoColocacion?.uidActivo !== uidQueTermina
    ) {
      return undefined;
    }
    const uidRival = Object.keys(p.jugadores).find((id) => id !== uidQueTermina);
    p.jugadores[uidQueTermina].yaColoco = true;

    if (p.jugadores[uidRival]?.yaColoco !== true) {
      p.turnoColocacion = nuevoTurno(uidRival, DURACION_TURNO_COLOCACION_MS);
      return { tipo: "turno", uidRival };
    }

    const colocoQuienTermina = p.jugadores[uidQueTermina]?.coloco === true;
    const colocoRival = p.jugadores[uidRival]?.coloco === true;
    if (p.ronda === 1 && !colocoQuienTermina && !colocoRival) {
      p.estado = "cancelada";
      p.motivoCancelacion = "inactividad";
      delete p.turnoColocacion;
      return { tipo: "cancelada" };
    }

    const uidAzul = Object.keys(p.jugadores).find((id) => p.jugadores[id].color === "azul");
    p.estado = "en_curso";
    delete p.turnoColocacion;
    p.turnoActual = uidAzul;
    p.turnoJuego = nuevoTurno(uidAzul, duracionTurnoJuego(p.ronda));
    return { tipo: "en_curso" };
  });

  if (!aplicado) {
    console.log(`[Preparación] Turno de ${uidQueTermina} ya procesado por otra llamada.`);
  } else if (info.tipo === "turno") {
    console.log(`[Preparación] Turno de ${uidQueTermina} terminado, pasa a ${info.uidRival}`);
  } else if (info.tipo === "cancelada") {
    console.log(`[Preparación] Partida ${partidaId} cancelada: nadie colocó bombas`);
  } else {
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

  const partida = (await rtdb.ref(`partidas/${partidaId}`).once("value")).val();
  if (!partida) {
    throw new HttpsError("not-found", "La partida no existe.");
  }
  if (partida.turnoColocacion?.uidActivo !== uid) {
    throw new HttpsError("failed-precondition", "No es tu turno.");
  }

  await avanzarFaseColocacion(partidaId, uid);
  return { exito: true };
});

// Puede llamarla cualquiera de los dos jugadores; la decisión usa el reloj
// del servidor, no el del cliente.
exports.verificarTimeoutColocacion = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
  }

  const { partidaId } = request.data || {};
  if (!partidaId) {
    throw new HttpsError("invalid-argument", "Falta el ID de partida.");
  }

  const partida = (await rtdb.ref(`partidas/${partidaId}`).once("value")).val();
  if (!partida || partida.estado !== "preparacion" || partida.esperandoJugadores) {
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

  let bombaMasReciente = 0;
  Object.values(partida.casillas || {}).forEach((casilla) => {
    (casilla.bombas || []).forEach((bomba) => {
      if (bomba.colocadaEn > bombaMasReciente) bombaMasReciente = bomba.colocadaEn;
    });
  });
  if (bombaMasReciente > 0 && ahoraServidor - bombaMasReciente < TIEMPO_VISIBLE_BOMBA_MS) {
    // Todavía hay una bomba visible; no avanzamos todavía.
    return { expirado: false, esperandoOcultamiento: true };
  }

  await avanzarFaseColocacion(partidaId, partida.turnoColocacion.uidActivo);
  return { expirado: true };
});

function siguienteInicioColocacion(tipoFin, uidQueActivo, uidRival) {
  // Detonación: quien hizo explotar la bomba inicia la siguiente ronda
  if (tipoFin === "detonacion") return uidQueActivo;
  // Limpieza de tablero: quien NO tuvo el último turno inicia
  return uidRival;
}

const DURACION_SONIDO_DETONACION_MS = { minibomba: 2400, bomba: 2200, bombota: 3700 };

function duracionSonidoDetonacion(bombas) {
  return Math.max(2200, ...bombas.map((b) => DURACION_SONIDO_DETONACION_MS[b.tipo] || 2200));
}

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Prepara la siguiente ronda sobre el objeto `partida` (dentro de una
 * transacción). Devuelve false si ya se jugaron las 10 rondas (RQNF-GAM-10).
 */
function prepararNuevaRonda(partida, uidInicial) {
  const nuevaRonda = partida.ronda + 1;
  if (nuevaRonda > 10) return false;

  const esVenenosas = partida.modalidad === "venenosas";
  partida.ronda = nuevaRonda;
  partida.casillas = generarCasillas(partida.tablero, nuevaRonda);
  partida.estado = "preparacion";
  delete partida.turnoJuego;
  delete partida.detonacion;
  partida.turnoColocacion = nuevoTurno(uidInicial, DURACION_TURNO_COLOCACION_MS);

  for (const id of Object.keys(partida.jugadores)) {
    const jugador = partida.jugadores[id];
    jugador.bombasDisponibles = esVenenosas
      ? obtenerCantidadBombasVenenosas(nuevaRonda)
      : obtenerCantidadBombas(jugador.clase, nuevaRonda);
    jugador.yaColoco = false;
    jugador.coloco = false;
    jugador.cargasVeneno = [];
  }
  return true;
}

// Cambia de ronda solo si la partida sigue en la ronda `rondaEsperada`;
// así una llamada repetida no se salta rondas.
async function iniciarNuevaRonda(partidaId, uidInicial, rondaEsperada) {
  let limiteAlcanzado = false;
  const { aplicado, partida } = await transaccionPartida(partidaId, (p) => {
    limiteAlcanzado = false;
    if (p.estado !== "en_curso" || p.ronda !== rondaEsperada) return undefined;
    if (!prepararNuevaRonda(p, uidInicial)) {
      limiteAlcanzado = true;
      return undefined;
    }
    return true;
  });

  if (limiteAlcanzado) {
    await resolverDesempatePorRondas(partidaId);
  } else if (aplicado) {
    console.log(`[Ronda] Nueva ronda ${partida.ronda} para partida ${partidaId}, inicia ${uidInicial}`);
  }
}

// Termina la partida una sola vez y solo entonces aplica Elo y estadísticas.
async function terminarPartida(partidaId, decidir) {
  const { aplicado, info, partida } = await transaccionPartida(partidaId, (p) => {
    if (p.estado === "finalizada" || p.estado === "cancelada") return undefined;
    const resultado = decidir(p);
    p.estado = "finalizada";
    delete p.turnoJuego;
    delete p.turnoColocacion;
    if (resultado.empate) {
      p.resultado = "empate";
      delete p.ganador;
    } else {
      p.resultado = "victoria";
      p.ganador = resultado.ganador;
    }
    return resultado;
  });
  if (!aplicado) return;

  console.log(`[Partida] ${partidaId} finalizada: ${info.empate ? "empate" : `gana ${info.ganador}`}`);
  await aplicarResultadoCompetitivo(
    partidaId,
    partida,
    info.empate ? { tipo: "empate" } : { tipo: "victoria", ganador: info.ganador }
  );
}

// RQNF-GAM-10: límite de rondas alcanzado, se decide por vidas restantes.
async function resolverDesempatePorRondas(partidaId) {
  await terminarPartida(partidaId, (p) => {
    const [uidA, uidB] = Object.keys(p.jugadores);
    const vidasA = p.jugadores[uidA].vidas;
    const vidasB = p.jugadores[uidB].vidas;
    if (vidasA === vidasB) return { empate: true };
    return { ganador: vidasA > vidasB ? uidA : uidB };
  });
}

async function finalizarPartidaPorDerrota(partidaId, uidPerdedor) {
  await terminarPartida(partidaId, (p) => ({
    ganador: Object.keys(p.jugadores).find((id) => id !== uidPerdedor),
  }));
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

  const { info } = await transaccionPartida(partidaId, (partida) => {
    if (partida.estado !== "en_curso") {
      throw new HttpsError("failed-precondition", "La partida no está en curso.");
    }
    if (partida.turnoJuego?.uidActivo !== uid) {
      throw new HttpsError("failed-precondition", "No es tu turno.");
    }
    const finalizaEn = partida.turnoJuego.finalizaEn;
    if (finalizaEn && Date.now() > finalizaEn + GRACIA_TURNO_MS) {
      throw new HttpsError("failed-precondition", "Se acabó el tiempo de tu turno.");
    }

    const casilla = partida.casillas?.[casillaClave];
    if (!casilla) throw new HttpsError("invalid-argument", "Casilla inválida.");
    if (casilla.segura === true) {
      throw new HttpsError("failed-precondition", "Esa casilla ya está bloqueada.");
    }
    if (casilla.detonada === true) {
      throw new HttpsError("failed-precondition", "Esa casilla ya fue detonada.");
    }

    const uidRival = Object.keys(partida.jugadores).find((id) => id !== uid);
    const jugador = partida.jugadores[uid];
    const bombas = casilla.bombas || [];
    const ronda = partida.ronda;

    if (bombas.length > 0 && partida.modalidad === "venenosas") {
      // Venenosas: aplica cargas de veneno, NO termina la ronda.
      const ahora = Date.now();
      const cantidadCargas = bombas.length;
      casilla.detonada = true;
      jugador.vidas = Math.max(0, jugador.vidas - cantidadCargas * 0.25);
      jugador.cargasVeneno = [
        ...(jugador.cargasVeneno || []),
        ...Array.from({ length: cantidadCargas }, () => ({ creadaEn: ahora, ultimoTick: ahora })),
      ];
      partida.turnoJuego = nuevoTurno(uidRival, duracionTurnoJuego(ronda));
      return { tipo: "veneno", cantidadCargas, vidasNuevas: jugador.vidas };
    }

    if (bombas.length > 0) {
      // Estándar: detonación. El turno se congela mientras suena la explosión.
      const danoTotal = bombas.reduce((sum, b) => sum + (b.dano || 0), 0);
      const duracionMs = duracionSonidoDetonacion(bombas);
      casilla.detonada = true;
      jugador.vidas = Math.max(0, jugador.vidas - danoTotal);
      delete partida.turnoJuego;
      partida.detonacion = { casilla: casillaClave, uid, en: Date.now(), duracionMs };
      return { tipo: "detonacion", danoTotal, duracionMs, vidasNuevas: jugador.vidas, ronda, uidRival };
    }

    // Casilla segura
    casilla.segura = true;
    const quedanSeguras = Object.values(partida.casillas).some(
      (c) => !(c.bombas && c.bombas.length > 0) && c.segura !== true
    );
    if (quedanSeguras) {
      partida.turnoJuego = nuevoTurno(uidRival, duracionTurnoJuego(ronda));
      return { tipo: "segura" };
    }
    // Limpieza completa: fin de ronda en la misma transacción.
    const uidInicio = siguienteInicioColocacion("limpieza", uid, uidRival);
    if (!prepararNuevaRonda(partida, uidInicio)) {
      delete partida.turnoJuego;
      return { tipo: "limite_rondas" };
    }
    return { tipo: "limpieza" };
  });

  if (info.tipo === "segura" || info.tipo === "limpieza" || info.tipo === "limite_rondas") {
    await registrarProgreso(uid, "casilla_segura_descubierta", 1);
  }

  switch (info.tipo) {
    case "veneno":
      console.log(`[Veneno] ${uid} detonó ${casillaClave}, cargas=${info.cantidadCargas}, vidas=${info.vidasNuevas}`);
      if (info.vidasNuevas <= 0) {
        await finalizarPartidaPorDerrota(partidaId, uid);
        return { resultado: "derrota", vidasNuevas: info.vidasNuevas };
      }
      return { resultado: "veneno_aplicado", cargas: info.cantidadCargas, vidasNuevas: info.vidasNuevas };

    case "detonacion": {
      console.log(`[Juego] ${uid} detonó ${casillaClave}, daño=${info.danoTotal}, vidas restantes=${info.vidasNuevas}`);
      await esperar(info.duracionMs);
      if (info.vidasNuevas <= 0) {
        await finalizarPartidaPorDerrota(partidaId, uid);
        return { resultado: "derrota", vidasNuevas: info.vidasNuevas };
      }
      const uidInicio = siguienteInicioColocacion("detonacion", uid, info.uidRival);
      await iniciarNuevaRonda(partidaId, uidInicio, info.ronda);
      return { resultado: "detonacion", vidasNuevas: info.vidasNuevas };
    }

    case "limite_rondas":
      await resolverDesempatePorRondas(partidaId);
      return { resultado: "limpieza_completa" };

    case "limpieza":
      return { resultado: "limpieza_completa" };

    default:
      return { resultado: "segura" };
  }
});

exports.verificarTimeoutJuego = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Debes iniciar sesión.");

  const { partidaId } = request.data || {};
  if (!partidaId) throw new HttpsError("invalid-argument", "Falta el ID de partida.");

  const { info } = await transaccionPartida(partidaId, (partida) => {
    if (partida.estado !== "en_curso") return undefined;
    if (!partida.jugadores?.[uid]) {
      throw new HttpsError("permission-denied", "No perteneces a esta partida.");
    }
    const turno = partida.turnoJuego;
    // Con gracia: una jugada hecha a tiempo pero lenta todavía puede llegar.
    if (!turno?.finalizaEn || Date.now() < turno.finalizaEn + GRACIA_TURNO_MS) return undefined;

    const uidActivo = turno.uidActivo;
    const uidRival = Object.keys(partida.jugadores).find((id) => id !== uidActivo);
    const jugador = partida.jugadores[uidActivo];
    jugador.vidas = Math.max(0, jugador.vidas - 1); // RQF-GAM-09: pierde 1 vida

    if (jugador.vidas <= 0) {
      delete partida.turnoJuego;
      return { tipo: "derrota", uidActivo, vidasNuevas: 0 };
    }
    if (partida.modalidad === "venenosas") {
      // En Venenosas el timeout solo pasa el turno; la ronda avanza al
      // limpiar todas las casillas seguras (RQF-MOD-01/02).
      partida.turnoJuego = nuevoTurno(uidRival, duracionTurnoJuego(partida.ronda));
      return { tipo: "pasa_turno", uidActivo, vidasNuevas: jugador.vidas };
    }
    // Estándar: termina la ronda.
    const uidInicio = siguienteInicioColocacion("detonacion", uidActivo, uidRival);
    if (!prepararNuevaRonda(partida, uidInicio)) {
      delete partida.turnoJuego;
      return { tipo: "limite_rondas", uidActivo, vidasNuevas: jugador.vidas };
    }
    return { tipo: "nueva_ronda", uidActivo, vidasNuevas: jugador.vidas };
  });

  if (!info) return { expirado: false };
  console.log(`[Juego] Timeout de ${info.uidActivo}, pierde 1 vida, restantes=${info.vidasNuevas}`);

  if (info.tipo === "derrota") {
    await finalizarPartidaPorDerrota(partidaId, info.uidActivo);
    return { expirado: true, resultado: "derrota" };
  }
  if (info.tipo === "limite_rondas") {
    await resolverDesempatePorRondas(partidaId);
  }
  return { expirado: true, resultado: info.tipo === "pasa_turno" ? "timeout_pasa_turno" : "timeout" };
});

exports.rotarMisionesDiarias = require("./misiones").rotarMisionesDiarias;
exports.asignarMisionesNuevoUsuario = require("./misiones").asignarMisionesNuevoUsuario;

async function avanzarTurnoElemental(partidaId, uidPropuesto) {
  const partidaSnap = await rtdb.ref(`partidas/${partidaId}`).once("value");
  const partida = partidaSnap.val();
  if (!partida || partida.estado !== "en_curso") return;

  // Si un jugador ya no puede jugar nada y el rival aún puede expandirse,
  // el rival se queda con todas las casillas que alcanzaría y se acaba.
  const uidRelleno = detectarRellenoAutomatico(partida);
  if (uidRelleno) {
    const actualizacionesRelleno = rellenarCasillasPara(uidRelleno, partida);
    const clavesRelleno = Object.keys(actualizacionesRelleno)
      .filter((k) => k.endsWith("/marcadaPor"))
      .map((k) => k.split("/")[1]);
    // Los clientes animan el relleno casilla por casilla; la partida sigue en
    // curso (sin turno) hasta que termina y entonces se muestra el resultado.
    const pasoMs = Math.max(40, Math.min(140, Math.floor(3200 / Math.max(1, clavesRelleno.length))));
    const duracionMs = clavesRelleno.length * pasoMs + 1200;
    await rtdb.ref(`partidas/${partidaId}`).update({
      ...actualizacionesRelleno,
      turnoActual: null,
      relleno: { uid: uidRelleno, casillas: clavesRelleno, pasoMs, duracionMs, en: Date.now() },
    });
    console.log(`[Elementales] Relleno automático para ${uidRelleno} en partida ${partidaId} (${clavesRelleno.length} casillas).`);
    await esperar(duracionMs);
    const partidaRellena = (await rtdb.ref(`partidas/${partidaId}`).once("value")).val();
    await finalizarPartidaElemental(partidaId, partidaRellena);
    return;
  }

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
  // Transacción: si dos llamadas terminan la partida a la vez, el resultado
  // (Elo, estadísticas) se aplica una sola vez.
  const { aplicado } = await transaccionPartida(partidaId, (p) => {
    if (p.estado === "finalizada") return undefined;
    p.estado = "finalizada";
    delete p.turnoActual;
    p.resultado = resultado.empate ? "empate" : "victoria";
    if (resultado.empate) delete p.ganador;
    else p.ganador = resultado.ganador;
    return true;
  });
  if (!aplicado) return;
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

  const { partidaId, casillaClave, numeroTurno, enviadoEn } = request.data || {};
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
  if (partida.esperandoJugadores) {
    throw new HttpsError("failed-precondition", "Esperando a que tu rival entre a la partida.");
  }
  if (partida.turnoActual?.uidActivo !== uid) {
    throw new HttpsError("failed-precondition", "No es tu turno.");
  }
  if (!partida.jugadores?.[uid]) {
    throw new HttpsError("permission-denied", "No perteneces a esta partida.");
  }

  validarAccionEnTiempoElemental(partida, { numeroTurno, enviadoEn });

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

  const { partidaId, tipoBomba, casillaObjetivo, casillasBloqueo, numeroTurno, enviadoEn } = request.data || {};
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
  if (partida.esperandoJugadores) {
    throw new HttpsError("failed-precondition", "Esperando a que tu rival entre a la partida.");
  }
  if (partida.turnoActual?.uidActivo !== uid) {
    throw new HttpsError("failed-precondition", "No es tu turno.");
  }
  const jugador = partida.jugadores?.[uid];
  if (!jugador) throw new HttpsError("permission-denied", "No perteneces a esta partida.");
  if (!jugador.bombas?.[tipoBomba]) {
    throw new HttpsError("failed-precondition", "Ya usaste esa bomba.");
  }
  validarAccionEnTiempoElemental(partida, { numeroTurno, enviadoEn });

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

  // Los clientes usan `ultimaBomba` para reproducir la animación y el sonido
  actualizaciones.ultimaBomba = { tipo: tipoBomba, uid, casilla: casillaObjetivo, en: Date.now() };
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
  // Con gracia: da tiempo a que llegue una jugada hecha a tiempo pero lenta.
  if (!finalizaEn || Date.now() < finalizaEn + GRACIA_TURNO_ELEMENTAL_MS) return { expirado: false };

  const uidActivo = partida.turnoActual.uidActivo;
  // Se le acabó el tiempo: pierde el turno sin marcar nada (confirmado).
  await avanzarTurnoElemental(partidaId, otroJugadorElemental(uidActivo, partida));

  return { expirado: true, resultado: "turno_perdido" };
});