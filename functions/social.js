const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");


const ALFABETO_ID_AMIGO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function generarIdAmigo() {
  let id = "";
  for (let i = 0; i < 8; i++) {
    id += ALFABETO_ID_AMIGO[Math.floor(Math.random() * ALFABETO_ID_AMIGO.length)];
  }
  return `${id.slice(0, 4)}-${id.slice(4)}`;
}

function normalizarIdAmigo(texto) {
  const limpio = String(texto || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (limpio.length !== 8) return null;
  return `${limpio.slice(0, 4)}-${limpio.slice(4)}`;
}

/** Devuelve el ID de amigo del jugador; si aún no tiene, le crea uno único. */
async function asignarIdAmigo(uid) {
  const firestore = getFirestore();
  const usuarioRef = firestore.collection("usuarios").doc(uid);
  for (let intento = 0; intento < 5; intento++) {
    const candidato = generarIdAmigo();
    const idRef = firestore.collection("idsAmigo").doc(candidato);
    const resultado = await firestore.runTransaction(async (tx) => {
      const [usuario, ocupado] = await Promise.all([tx.get(usuarioRef), tx.get(idRef)]);
      if (!usuario.exists) return { sinPerfil: true };
      if (usuario.data().idAmigo) return { idAmigo: usuario.data().idAmigo };
      if (ocupado.exists) return null; // otro jugador ya lo tiene: se prueba otro
      tx.create(idRef, { uid });
      tx.update(usuarioRef, { idAmigo: candidato });
      return { idAmigo: candidato };
    });
    if (resultado?.sinPerfil) return null;
    if (resultado) return resultado.idAmigo;
  }
  throw new HttpsError("internal", "No se pudo generar el ID de amigo. Intenta de nuevo.");
}

/** uid del jugador dueño de un ID de amigo, o null si no existe. */
async function uidPorIdAmigo(idAmigo) {
  const snap = await getFirestore().collection("idsAmigo").doc(idAmigo).get();
  return snap.exists ? snap.data().uid : null;
}

// Cada cuenta nueva recibe su ID de amigo al crearse el perfil.
const asignarIdAmigoNuevoUsuario = onDocumentCreated("usuarios/{uid}", async (event) => {
  if (!event.data || event.data.data()?.idAmigo) return;
  const idAmigo = await asignarIdAmigo(event.params.uid);
  console.log(`[Amistades] ID de amigo ${idAmigo} asignado a ${event.params.uid}.`);
});

// Para cuentas creadas antes de existir el ID de amigo: el perfil lo pide
// al abrirse y se crea en ese momento.
const obtenerIdAmigo = onCall(async (request) => {
  const uid = exigirCuentaRegistrada(request);
  const idAmigo = await asignarIdAmigo(uid);
  if (!idAmigo) throw new HttpsError("not-found", "No se encontró tu perfil.");
  return { idAmigo };
});

function exigirCuentaRegistrada(request) {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
  }
  if (request.auth.token?.firebase?.sign_in_provider === "anonymous") {
    throw new HttpsError(
      "failed-precondition",
      "Los invitados no pueden usar amistades. Crea una cuenta para hacerlo."
    );
  }
  return uid;
}

const enviarSolicitudAmistad = onCall(async (request) => {
  const uid = exigirCuentaRegistrada(request);
  // La solicitud se manda con el ID de amigo, nunca con el uid interno.
  const idAmigo = normalizarIdAmigo(request.data?.idAmigo);
  if (!idAmigo) {
    throw new HttpsError("invalid-argument", "El ID de amigo no es válido.");
  }
  const uidDestino = await uidPorIdAmigo(idAmigo);
  if (!uidDestino) {
    throw new HttpsError("not-found", "No existe ningún jugador con ese ID de amigo.");
  }
  if (uidDestino === uid) {
    throw new HttpsError("invalid-argument", "No puedes agregarte a ti mismo.");
  }

  const firestore = getFirestore();
  const [propioSnap, destinoSnap, yaAmigosSnap, inversaSnap, directaSnap] = await Promise.all([
    firestore.collection("usuarios").doc(uid).get(),
    firestore.collection("usuarios").doc(uidDestino).get(),
    firestore.collection("usuarios").doc(uid).collection("amigos").doc(uidDestino).get(),
    firestore.collection("solicitudesAmistad").doc(`${uidDestino}_${uid}`).get(),
    firestore.collection("solicitudesAmistad").doc(`${uid}_${uidDestino}`).get(),
  ]);

  if (!propioSnap.exists) {
    throw new HttpsError("not-found", "No se encontró tu perfil.");
  }
  if (!destinoSnap.exists) {
    throw new HttpsError("not-found", "El jugador no existe.");
  }
  if (yaAmigosSnap.exists) {
    throw new HttpsError("already-exists", "Ya son amigos.");
  }
  if (directaSnap.exists) {
    throw new HttpsError("already-exists", "Ya enviaste una solicitud a este jugador.");
  }

  // Si el otro jugador ya te había mandado solicitud, mandar la tuya
  // equivale a aceptar la suya: quedan como amigos directamente.
  if (inversaSnap.exists) {
    await crearAmistad(firestore, uid, uidDestino, `${uidDestino}_${uid}`);
    return { exito: true, amigos: true };
  }

  await firestore
    .collection("solicitudesAmistad")
    .doc(`${uid}_${uidDestino}`)
    .set({
      de: uid,
      para: uidDestino,
      deUsername: propioSnap.data().username || "Jugador",
      creadaEn: FieldValue.serverTimestamp(),
    });

  return { exito: true, amigos: false };
});

async function crearAmistad(firestore, uidA, uidB, idSolicitudAEliminar) {
  const batch = firestore.batch();
  const desde = FieldValue.serverTimestamp();
  batch.set(firestore.collection("usuarios").doc(uidA).collection("amigos").doc(uidB), { desde });
  batch.set(firestore.collection("usuarios").doc(uidB).collection("amigos").doc(uidA), { desde });
  if (idSolicitudAEliminar) {
    batch.delete(firestore.collection("solicitudesAmistad").doc(idSolicitudAEliminar));
  }
  await batch.commit();
}

const responderSolicitudAmistad = onCall(async (request) => {
  const uid = exigirCuentaRegistrada(request);
  const { idSolicitud, aceptar } = request.data || {};

  if (!idSolicitud || typeof idSolicitud !== "string" || typeof aceptar !== "boolean") {
    throw new HttpsError("invalid-argument", "Datos de solicitud inválidos.");
  }

  const firestore = getFirestore();
  const ref = firestore.collection("solicitudesAmistad").doc(idSolicitud);
  const snap = await ref.get();

  if (!snap.exists) {
    throw new HttpsError("not-found", "La solicitud ya no existe.");
  }
  const solicitud = snap.data();
  if (solicitud.para !== uid) {
    throw new HttpsError("permission-denied", "Esta solicitud no es para ti.");
  }

  if (aceptar) {
    await crearAmistad(firestore, solicitud.de, solicitud.para, idSolicitud);
  } else {
    await ref.delete();
  }

  return { exito: true };
});

const eliminarAmigo = onCall(async (request) => {
  const uid = exigirCuentaRegistrada(request);
  const uidAmigo = request.data?.uidAmigo;
  if (!uidAmigo || typeof uidAmigo !== "string") {
    throw new HttpsError("invalid-argument", "Falta el amigo a eliminar.");
  }

  const firestore = getFirestore();
  const batch = firestore.batch();
  batch.delete(firestore.collection("usuarios").doc(uid).collection("amigos").doc(uidAmigo));
  batch.delete(firestore.collection("usuarios").doc(uidAmigo).collection("amigos").doc(uid));
  await batch.commit();

  return { exito: true };
});

module.exports = {
  enviarSolicitudAmistad,
  responderSolicitudAmistad,
  eliminarAmigo,
  obtenerIdAmigo,
  asignarIdAmigoNuevoUsuario,
  asignarIdAmigo,
};