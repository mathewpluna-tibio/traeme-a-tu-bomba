
const {setGlobalOptions} = require("firebase-functions");
const {onRequest} = require("firebase-functions/https");
const logger = require("firebase-functions/logger");


setGlobalOptions({ maxInstances: 10 });

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const Filter = require("bad-words");
const malasPalabras = require("./malasPalabras");
const { elegirTableroAleatorio, generarCasillas } = require("./tableros");
const { obtenerCantidadBombas, obtenerDanoBomba } = require("./bombas");

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

  const esOfensivo = esOfensivoDirecto || esOfensivoNormalizado || esOfensivoPorPrefijoSufijo;

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

async function intentarEmparejar(modalidad, uid, jugador) {
  console.log(`[Matchmaking] Iniciando para uid=${uid}, modalidad=${modalidad}`);

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

  const checkSnapshot = await rtdb.ref(`colaEspera/${modalidad}/${rival.uid}`).once("value");
  if (!checkSnapshot.exists()) {
    console.log(`[Matchmaking] El rival ya no está en la cola, saliendo.`);
    return;
  }

  const partidaRef = rtdb.ref("partidas").push();
  const partidaId = partidaRef.key;

  // --- NUEVO: resolver "aleatoria" a una clase real, y calcular bombas iniciales ---
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

  await rtdb.ref().update(updates);

  return { exito: true, bombasRestantes: jugador.bombasDisponibles - 1 };
});

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
  if (partida.estado !== "preparacion") {
    throw new HttpsError("failed-precondition", "La partida no está en preparación.");
  }
  if (partida.turnoColocacion?.uidActivo !== uid) {
    throw new HttpsError("failed-precondition", "No es tu turno.");
  }

  const uids = Object.keys(partida.jugadores);
  const uidRival = uids.find((id) => id !== uid);
  const yaJugoRival = partida.jugadores[uidRival]?.yaColoco === true;

  if (!yaJugoRival) {
    // Pasamos el turno al rival
    const DURACION_TURNO_MS = 30000;
    await rtdb.ref(`partidas/${partidaId}`).update({
      [`jugadores/${uid}/yaColoco`]: true,
      turnoColocacion: {
        uidActivo: uidRival,
        inicioEn: Date.now(),
        finalizaEn: Date.now() + DURACION_TURNO_MS,
      },
    });
    console.log(`[Preparación] Turno de ${uid} terminado, pasa a ${uidRival}`);
  } else {
    // Ambos ya jugaron su turno -> inicia la partida real
    await rtdb.ref(`partidas/${partidaId}`).update({
      [`jugadores/${uid}/yaColoco`]: true,
      estado: "en_curso",
      turnoColocacion: null,
      // El primer turno de juego (Papa Caliente) también empieza con el azul
      turnoActual: partida.jugadores[
        Object.keys(partida.jugadores).find(
          (id) => partida.jugadores[id].color === "azul"
        )
      ] ? Object.keys(partida.jugadores).find(
          (id) => partida.jugadores[id].color === "azul"
        ) : uid,
    });
    console.log(`[Preparación] Ambos jugadores listos, partida ${partidaId} inicia`);
  }

  return { exito: true };
});