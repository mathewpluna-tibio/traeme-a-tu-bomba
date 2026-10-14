const crypto = require("crypto");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const { getDatabase } = require("firebase-admin/database");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { CATALOGO_TIENDA } = require("./tienda");
const { TIPOS_EVENTO, invalidarCacheEventos } = require("./eventos");

/**
 * Vista Admin (RQF-ADM-01..04).
 *
 * El rol de administrador es un custom claim `admin: true` en Firebase
 * Authentication (se asigna con functions/scripts/asignarAdmin.js). Cada
 * función de este archivo lo valida en el servidor: ocultar el panel en el
 * frontend NO es seguridad, esto sí.
 */
function exigirAdmin(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
  }
  if (request.auth.token?.admin !== true) {
    throw new HttpsError("permission-denied", "Acceso restringido a administradores.");
  }
  return request.auth.uid;
}

const txt = (v, min, max, campo) => {
  if (typeof v !== "string" || v.trim().length < min || v.trim().length > max) {
    throw new HttpsError("invalid-argument", `${campo} debe tener entre ${min} y ${max} caracteres.`);
  }
  return v.trim();
};

const entero = (v, min, max, campo) => {
  if (!Number.isInteger(v) || v < min || v > max) {
    throw new HttpsError("invalid-argument", `${campo} debe ser un entero entre ${min} y ${max}.`);
  }
  return v;
};

function validarCosmetico(c) {
  if (!c) return null;
  const { tipo, id } = c;
  if (!["marco", "banner", "titulo"].includes(tipo)) {
    throw new HttpsError("invalid-argument", "Tipo de cosmético inválido.");
  }
  const valor = txt(id, 2, 40, "El cosmético");
  if (tipo !== "titulo" && valor === "Default") {
    throw new HttpsError("invalid-argument", "El cosmético Default no puede ser recompensa.");
  }
  // RQNF-MIS-03: lo que da un evento no puede conseguirse por otro medio,
  // así que no puede ser algo que ya se vende en la Tienda.
  if (CATALOGO_TIENDA.some((i) => i.tipo === tipo && i.id === valor)) {
    throw new HttpsError("invalid-argument", `"${valor}" ya se vende en la Tienda; no puede ser exclusivo de un evento.`);
  }
  return { tipo, id: valor };
}

function validarMision(m, i) {
  if (!m || typeof m !== "object") throw new HttpsError("invalid-argument", `Misión ${i + 1} inválida.`);
  if (!TIPOS_EVENTO.includes(m.tipo)) {
    throw new HttpsError("invalid-argument", `Misión ${i + 1}: tipo de objetivo inválido.`);
  }
  const recompensa = m.recompensa || {};
  const coronas = entero(recompensa.coronas ?? 0, 0, 5000, `Misión ${i + 1}: coronas`);
  const cosmetico = validarCosmetico(recompensa.cosmetico);
  return {
    id: typeof m.id === "string" && /^[A-Za-z0-9]{4,20}$/.test(m.id) ? m.id : crypto.randomBytes(4).toString("hex"),
    descripcion: txt(m.descripcion, 3, 120, `Misión ${i + 1}: descripción`),
    tipo: m.tipo,
    objetivo: entero(m.objetivo, 1, 100000, `Misión ${i + 1}: objetivo`),
    recompensa: cosmetico ? { coronas, cosmetico } : { coronas },
  };
}

// RQF-ADM-02 · crear / editar evento
const guardarEvento = onCall(async (request) => {
  const adminUid = exigirAdmin(request);
  const { id, evento } = request.data || {};
  if (!evento || typeof evento !== "object") {
    throw new HttpsError("invalid-argument", "Faltan los datos del evento.");
  }

  const inicioMs = Date.parse(evento.inicio);
  const finMs = Date.parse(evento.fin);
  if (Number.isNaN(inicioMs) || Number.isNaN(finMs)) {
    throw new HttpsError("invalid-argument", "Fechas inválidas.");
  }
  if (finMs <= inicioMs) {
    throw new HttpsError("invalid-argument", "La fecha de fin debe ser posterior a la de inicio.");
  }
  if (!Array.isArray(evento.misiones) || evento.misiones.length < 1 || evento.misiones.length > 8) {
    throw new HttpsError("invalid-argument", "El evento debe tener entre 1 y 8 misiones.");
  }

  const firestore = getFirestore();

  // Un solo evento a la vez: así el panel "Evento especial" es inequívoco.
  const posibles = await firestore.collection("eventos").where("fin", ">", Timestamp.fromMillis(inicioMs)).get();
  const choque = posibles.docs.find((d) => d.id !== id && d.data().inicio.toMillis() < finMs);
  if (choque) {
    throw new HttpsError("failed-precondition", `Las fechas se empalman con el evento "${choque.data().nombre}".`);
  }

  const datos = {
    nombre: txt(evento.nombre, 3, 60, "El nombre"),
    descripcion: typeof evento.descripcion === "string" ? evento.descripcion.trim().slice(0, 300) : "",
    inicio: Timestamp.fromMillis(inicioMs),
    fin: Timestamp.fromMillis(finMs),
    misiones: evento.misiones.map(validarMision),
    concluido: finMs <= Date.now(),
    recompensasDisponibles: finMs > Date.now(),
    actualizadoPor: adminUid,
    actualizadoEn: FieldValue.serverTimestamp(),
  };

  let ref;
  if (id) {
    ref = firestore.collection("eventos").doc(id);
    if (!(await ref.get()).exists) throw new HttpsError("not-found", "El evento no existe.");
    await ref.set(datos, { merge: true });
  } else {
    ref = firestore.collection("eventos").doc();
    await ref.set({ ...datos, creadoPor: adminUid, creadoEn: FieldValue.serverTimestamp() });
  }

  invalidarCacheEventos();
  console.log(`[Admin] ${adminUid} guardó el evento ${ref.id} ("${datos.nombre}").`);
  return { exito: true, id: ref.id };
});

// RQF-ADM-02 · eliminar evento
const eliminarEvento = onCall(async (request) => {
  const adminUid = exigirAdmin(request);
  const id = request.data?.id;
  if (!id || typeof id !== "string") throw new HttpsError("invalid-argument", "Falta el evento.");
  await getFirestore().collection("eventos").doc(id).delete();
  invalidarCacheEventos();
  console.log(`[Admin] ${adminUid} eliminó el evento ${id}.`);
  return { exito: true };
});

// RQF-ADM-03 · banear / desbanear
const banearUsuario = onCall(async (request) => {
  const adminUid = exigirAdmin(request);
  const { uid, baneado, motivo } = request.data || {};
  if (!uid || typeof uid !== "string" || typeof baneado !== "boolean") {
    throw new HttpsError("invalid-argument", "Datos inválidos.");
  }
  if (uid === adminUid) throw new HttpsError("failed-precondition", "No puedes banearte a ti mismo.");

  const auth = getAuth();
  let objetivo;
  try {
    objetivo = await auth.getUser(uid);
  } catch {
    throw new HttpsError("not-found", "La cuenta no existe.");
  }
  if (objetivo.customClaims?.admin === true) {
    throw new HttpsError("failed-precondition", "No se puede banear a otro administrador.");
  }

  // Authentication: deshabilita la cuenta (no podrá volver a iniciar sesión)
  // y revoca sus tokens de refresco (se acaba la sesión abierta).
  await auth.updateUser(uid, { disabled: baneado });
  if (baneado) await auth.revokeRefreshTokens(uid);

  await getFirestore().collection("usuarios").doc(uid).set(
    baneado
      ? {
          baneado: true,
          baneadoEn: FieldValue.serverTimestamp(),
          motivoBaneo: typeof motivo === "string" ? motivo.trim().slice(0, 200) : "",
        }
      : { baneado: false, motivoBaneo: "" },
    { merge: true }
  );

  if (baneado) {
    // Lo saca de cualquier cola de espera (la sesión abierta se cierra sola:
    // el cliente escucha `baneado` y los tokens ya fueron revocados).
    const rtdb = getDatabase();
    for (const modalidad of ["estandar", "venenosas", "elementales"]) {
      await rtdb.ref(`colaEspera/${modalidad}/${uid}`).remove().catch(() => {});
    }
  }

  console.log(`[Admin] ${adminUid} ${baneado ? "baneó" : "desbaneó"} a ${uid}.`);
  return { exito: true };
});

// RQF-ADM-04 · forzar cambio de nombre
const forzarCambioNombre = onCall(async (request) => {
  const adminUid = exigirAdmin(request);
  const { uid, username } = request.data || {};
  if (!uid || typeof uid !== "string") throw new HttpsError("invalid-argument", "Falta el jugador.");
  const nuevo = txt(username, 3, 20, "El nombre de usuario");

  const firestore = getFirestore();
  const perfilRef = firestore.collection("usuarios").doc(uid);
  if (!(await perfilRef.get()).exists) throw new HttpsError("not-found", "El jugador no existe.");

  const repetido = await firestore.collection("usuarios").where("username", "==", nuevo).limit(1).get();
  if (!repetido.empty && repetido.docs[0].id !== uid) {
    throw new HttpsError("already-exists", "Ese nombre de usuario ya está en uso.");
  }

  await Promise.all([
    perfilRef.update({ username: nuevo }),
    getAuth().updateUser(uid, { displayName: nuevo }),
  ]);

  console.log(`[Admin] ${adminUid} cambió el nombre de ${uid} a "${nuevo}".`);
  return { exito: true };
});

module.exports = { guardarEvento, eliminarEvento, banearUsuario, forzarCambioNombre };