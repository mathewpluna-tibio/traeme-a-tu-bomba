const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");

/**
 * Amistades (RQF-SOC-03 / RQF-SOC-04).
 *
 * Modelo en Firestore (se escribe SOLO desde aquí con el Admin SDK):
 *   solicitudesAmistad/{de}_{para}  -> { de, para, deUsername, creadaEn }
 *   usuarios/{uid}/amigos/{amigoUid} -> { desde }   (una por cada lado)
 */

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
  const uidDestino = request.data?.uidDestino;

  if (!uidDestino || typeof uidDestino !== "string") {
    throw new HttpsError("invalid-argument", "Falta el jugador destino.");
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

module.exports = { enviarSolicitudAmistad, responderSolicitudAmistad, eliminarAmigo };