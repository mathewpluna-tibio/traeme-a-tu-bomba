const { getFirestore } = require("firebase-admin/firestore");
const { getDatabase } = require("firebase-admin/database");
const { getAuth } = require("firebase-admin/auth");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { obtenerCantidadBombas, obtenerCantidadBombasVenenosas } = require("./bombas");
const {
  generarCasillasElementales,
  ANCHO_TABLERO,
  ALTO_TABLERO,
} = require("./elementales");

/**
 * Lobby privado y retos (RQF-MEN-05/06, RQF-SOC-02).
 *
 * RTDB (se escribe SOLO desde aquí con el Admin SDK):
 *   lobbies/{lobbyId}        -> { creador, creadorUsername, modalidad, clase?, uidRetado?,
 *                                 estado: "esperando" | "iniciada" | "cancelada", creadaEn }
 *   lobbyActivo/{uid}        -> lobbyId (el lobby abierto de ese jugador, máx. uno)
 *   invitaciones/{uid}/{lobbyId} -> { de, deUsername, modalidad, creadaEn }   (retos)
 *
 * El "enlace de invitación irrepetible" es la URL con ?lobby=<lobbyId>: el id
 * es una llave push de RTDB (no adivinable) y deja de servir en cuanto el
 * lobby pasa a "iniciada" o "cancelada" (RQNF-MEN-05).
 */

const MODALIDADES = ["estandar", "venenosas", "elementales"];
const CLASES = ["minibomba", "bomba", "bombota", "aleatoria"];
const DURACION_TURNO_ELEMENTAL_MS = 7000;

function resolverClase(clase) {
  if (clase !== "aleatoria") return clase;
  const clasesReales = ["minibomba", "bomba", "bombota"];
  return clasesReales[Math.floor(Math.random() * clasesReales.length)];
}

function validarModalidadYClase(modalidad, clase) {
  if (!MODALIDADES.includes(modalidad)) {
    throw new HttpsError("invalid-argument", "Modalidad inválida.");
  }
  // RQF-MEN-03: la clase solo se elige en Estándar
  if (modalidad === "estandar") {
    if (!CLASES.includes(clase)) {
      throw new HttpsError("invalid-argument", "Debes elegir una clase de bomba.");
    }
    return clase;
  }
  return null;
}

async function nombreDe(uid) {
  const snap = await getFirestore().collection("usuarios").doc(uid).get();
  return snap.exists ? snap.data().username || "Jugador" : "Invitado";
}

async function esCuentaInvitada(uid) {
  try {
    const usuario = await getAuth().getUser(uid);
    return usuario.providerData.length === 0;
  } catch {
    return false;
  }
}

async function cerrarLobby(rtdb, lobbyId, lobby) {
  const updates = {
    [`lobbies/${lobbyId}/estado`]: "cancelada",
    [`lobbyActivo/${lobby.creador}`]: null,
  };
  if (lobby.uidRetado) {
    updates[`invitaciones/${lobby.uidRetado}/${lobbyId}`] = null;
  }
  await rtdb.ref().update(updates);
}

const crearLobby = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
  }

  const { modalidad, clase, uidRetado } = request.data || {};
  const claseFinal = validarModalidadYClase(modalidad, clase);
  const rtdb = getDatabase();

  if (uidRetado) {
    if (typeof uidRetado !== "string" || uidRetado === uid) {
      throw new HttpsError("invalid-argument", "Jugador retado inválido.");
    }
    const destinoSnap = await getFirestore().collection("usuarios").doc(uidRetado).get();
    if (!destinoSnap.exists) {
      throw new HttpsError("not-found", "El jugador no existe.");
    }
    // RQNF-SOC-02: solo se puede retar a quien tenga sesión activa
    const sesionSnap = await rtdb.ref(`sesionActiva/${uidRetado}`).once("value");
    if (!sesionSnap.exists()) {
      throw new HttpsError("failed-precondition", "El jugador debe estar en línea para retarlo.");
    }
  }

  // Un jugador solo puede tener un lobby abierto: el anterior se cancela.
  const anteriorId = (await rtdb.ref(`lobbyActivo/${uid}`).once("value")).val();
  if (anteriorId) {
    const anterior = (await rtdb.ref(`lobbies/${anteriorId}`).once("value")).val();
    if (anterior && anterior.estado === "esperando") {
      await cerrarLobby(rtdb, anteriorId, anterior);
    }
  }

  const lobbyRef = rtdb.ref("lobbies").push();
  const lobbyId = lobbyRef.key;
  const ahora = Date.now();
  const creadorUsername = await nombreDe(uid);

  const lobby = {
    creador: uid,
    creadorUsername,
    modalidad,
    estado: "esperando",
    creadaEn: ahora,
  };
  if (claseFinal) lobby.clase = claseFinal;
  if (uidRetado) lobby.uidRetado = uidRetado;

  const updates = {
    [`lobbies/${lobbyId}`]: lobby,
    [`lobbyActivo/${uid}`]: lobbyId,
    [`notificacionesPartida/${uid}`]: null,
  };
  if (uidRetado) {
    updates[`invitaciones/${uidRetado}/${lobbyId}`] = {
      de: uid,
      deUsername: creadorUsername,
      modalidad,
      creadaEn: ahora,
    };
  }
  await rtdb.ref().update(updates);

  return { lobbyId };
});

const cancelarLobby = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
  }
  const lobbyId = request.data?.lobbyId;
  if (!lobbyId || typeof lobbyId !== "string") {
    throw new HttpsError("invalid-argument", "Falta el lobby.");
  }

  const rtdb = getDatabase();
  const lobby = (await rtdb.ref(`lobbies/${lobbyId}`).once("value")).val();
  if (!lobby) {
    throw new HttpsError("not-found", "El lobby no existe.");
  }
  if (lobby.creador !== uid) {
    throw new HttpsError("permission-denied", "Este lobby no es tuyo.");
  }
  if (lobby.estado === "esperando") {
    await cerrarLobby(rtdb, lobbyId, lobby);
  }
  return { exito: true };
});

// El retado rechaza el reto: se cierra el lobby y al creador le avisa el
// cambio de estado a "cancelada".
const rechazarReto = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
  }
  const lobbyId = request.data?.lobbyId;
  if (!lobbyId || typeof lobbyId !== "string") {
    throw new HttpsError("invalid-argument", "Falta el lobby.");
  }

  const rtdb = getDatabase();
  const lobby = (await rtdb.ref(`lobbies/${lobbyId}`).once("value")).val();
  if (!lobby || lobby.uidRetado !== uid) {
    throw new HttpsError("permission-denied", "Este reto no es para ti.");
  }
  if (lobby.estado === "esperando") {
    await cerrarLobby(rtdb, lobbyId, lobby);
  } else {
    await rtdb.ref(`invitaciones/${uid}/${lobbyId}`).remove();
  }
  return { exito: true };
});

const unirseALobby = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
  }
  const { lobbyId, clase } = request.data || {};
  if (!lobbyId || typeof lobbyId !== "string") {
    throw new HttpsError("invalid-argument", "Falta el lobby.");
  }

  const rtdb = getDatabase();
  const lobbyRef = rtdb.ref(`lobbies/${lobbyId}`);
  const lobby = (await lobbyRef.once("value")).val();

  if (!lobby || lobby.estado !== "esperando") {
    throw new HttpsError("failed-precondition", "Este enlace ya no es válido.");
  }
  if (lobby.creador === uid) {
    throw new HttpsError("failed-precondition", "No puedes unirte a tu propio lobby.");
  }
  if (lobby.uidRetado && lobby.uidRetado !== uid) {
    throw new HttpsError("permission-denied", "Este reto es para otro jugador.");
  }
  const claseInvitado = validarModalidadYClase(lobby.modalidad, clase);

  // Solo uno gana la carrera por entrar: esperando -> iniciada, una vez.
  // OJO: las transacciones de RTDB llaman primero a la función con el valor
  // en caché, que suele ser null; si en ese caso devolviéramos undefined la
  // transacción se ABORTA sin reintentar (y todos los enlaces saldrían como
  // "no válidos"). Devolver el mismo null hace que Firebase la reintente con
  // el valor real del servidor.
  const reserva = await lobbyRef.transaction((actual) => {
    if (actual === null) return actual;
    if (actual.estado !== "esperando") return undefined;
    return { ...actual, estado: "iniciada" };
  });
  if (!reserva.committed) {
    throw new HttpsError("failed-precondition", "Este enlace ya no es válido.");
  }

  const uidCreador = lobby.creador;
  const [creadorInvitado, invitadoInvitado] = await Promise.all([
    esCuentaInvitada(uidCreador),
    esCuentaInvitada(uid),
  ]);

  const partidaRef = rtdb.ref("partidas").push();
  const partidaId = partidaRef.key;
  const ahora = Date.now();
  const esVenenosas = lobby.modalidad === "venenosas";
  const esElementales = lobby.modalidad === "elementales";

  let partida;
  if (esElementales) {
    const indiceAzul = Math.floor(Math.random() * 2);
    const uidAzul = indiceAzul === 0 ? uidCreador : uid;
    const uidRojo = indiceAzul === 0 ? uid : uidCreador;
    const invitadoPorUid = { [uidCreador]: creadorInvitado, [uid]: invitadoInvitado };

    const jugadorElemental = (color, esInvitado) => ({
      color,
      esInvitado,
      eloInicial: 0,
      casillasMarcadas: 0,
      bombas: { electrica: true, lianas: true, hielo: true },
      congeladoPorTurnos: 0,
    });

    partida = {
      modalidad: lobby.modalidad,
      tipo: "privada",
      estado: "en_curso",
      anchoTablero: ANCHO_TABLERO,
      altoTablero: ALTO_TABLERO,
      casillas: generarCasillasElementales(),
      numeroTurno: 1,
      jugadores: {
        [uidAzul]: jugadorElemental("azul", invitadoPorUid[uidAzul]),
        [uidRojo]: jugadorElemental("rojo", invitadoPorUid[uidRojo]),
      },
      turnoActual: {
        uidActivo: uidAzul,
        inicioEn: ahora,
        finalizaEn: ahora + DURACION_TURNO_ELEMENTAL_MS,
      },
      creadaEn: ahora,
    };
  } else {
    // Estándar / Venenosas: igual que el matchmaking, el tablero lo genera
    // el trigger onPartidaCreada al ver estado "generando_tablero".
    const claseCreador = esVenenosas ? null : resolverClase(lobby.clase);
    const claseRival = esVenenosas ? null : resolverClase(claseInvitado);
    const bombasCreador = esVenenosas
      ? obtenerCantidadBombasVenenosas(1)
      : obtenerCantidadBombas(claseCreador, 1);
    const bombasRival = esVenenosas
      ? obtenerCantidadBombasVenenosas(1)
      : obtenerCantidadBombas(claseRival, 1);

    partida = {
      modalidad: lobby.modalidad,
      tipo: "privada",
      tablero: null,
      ronda: 1,
      estado: "generando_tablero",
      jugadores: {
        [uidCreador]: {
          vidas: 3,
          clase: claseCreador,
          listo: false,
          esInvitado: creadorInvitado,
          eloInicial: 0,
          bombasDisponibles: bombasCreador,
          cargasVeneno: [],
        },
        [uid]: {
          vidas: 3,
          clase: claseRival,
          listo: false,
          esInvitado: invitadoInvitado,
          eloInicial: 0,
          bombasDisponibles: bombasRival,
          cargasVeneno: [],
        },
      },
      creadaEn: ahora,
    };
  }

  const updates = {
    [`partidas/${partidaId}`]: partida,
    [`notificacionesPartida/${uidCreador}`]: partidaId,
    [`notificacionesPartida/${uid}`]: partidaId,
    [`lobbyActivo/${uidCreador}`]: null,
    [`invitaciones/${uid}/${lobbyId}`]: null,
  };
  await rtdb.ref().update(updates);

  console.log(`[Lobby] Partida privada ${partidaId} creada desde lobby ${lobbyId}.`);
  return { partidaId };
});

module.exports = { crearLobby, cancelarLobby, rechazarReto, unirseALobby };