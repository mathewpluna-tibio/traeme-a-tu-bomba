const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");

/**
 * Catálogo de precios de la Tienda. Esta es la fuente de verdad: el precio
 * que paga cada jugador SIEMPRE se calcula aquí, nunca con lo que mande el
 * cliente, precisamente porque las reglas de Firestore dejan que cualquier
 * cliente autenticado escriba su propio documento — si confiáramos en un
 * precio enviado desde el navegador, bastaría con editar la petición para
 * "comprar" cualquier cosmético por 0 coronas.
 *
 * "Default" no aparece aquí porque ya lo tiene todo mundo desde que se crea
 * el perfil (ver perfilInicial.js). "007" tampoco aparece: es exclusivo del
 * logro "Maestro del Territorio", no se vende.
 *
 * Mantener estos ids/precios sincronizados con el espejo de frontend en
 * src/data/cosmeticos.js (el mismo patrón que ya existe entre
 * misionesCatalogo.js y logrosCatalogo.js).
 */
const CATALOGO_TIENDA = [
  { tipo: "marco", id: "Metal", precio: 100 },
  { tipo: "marco", id: "Nat", precio: 100 },
  { tipo: "marco", id: "Electro", precio: 100 },
  { tipo: "marco", id: "Dino", precio: 100 },
  { tipo: "banner", id: "Metal", precio: 100 },
  { tipo: "banner", id: "Nat", precio: 100 },
  { tipo: "banner", id: "Electro", precio: 100 },
  { tipo: "banner", id: "Dino", precio: 100 },
];

const comprarCosmetico = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
  }

  const { tipo, id } = request.data || {};
  if (!id || (tipo !== "marco" && tipo !== "banner")) {
    throw new HttpsError("invalid-argument", "Cosmético inválido.");
  }

  const item = CATALOGO_TIENDA.find((c) => c.tipo === tipo && c.id === id);
  if (!item) {
    throw new HttpsError("not-found", "Ese cosmético no está disponible en la Tienda.");
  }

  const firestore = getFirestore();
  const perfilRef = firestore.collection("usuarios").doc(uid);
  const campoLista = tipo === "marco" ? "marcosComprados" : "bannersComprados";

  // Transacción: así dos clics rápidos (o dos pestañas) no pueden gastar
  // las mismas coronas dos veces ni comprar el mismo item dos veces.
  await firestore.runTransaction(async (tx) => {
    const perfilSnap = await tx.get(perfilRef);
    if (!perfilSnap.exists) {
      throw new HttpsError("not-found", "No se encontró tu perfil.");
    }

    const datos = perfilSnap.data();
    const yaComprado = (datos[campoLista] || []).includes(id);
    if (yaComprado) {
      throw new HttpsError("already-exists", "Ya tienes este cosmético.");
    }

    const coronas = datos.coronas || 0;
    if (coronas < item.precio) {
      throw new HttpsError("failed-precondition", "No tienes suficientes coronas.");
    }

    tx.update(perfilRef, {
      coronas: FieldValue.increment(-item.precio),
      [campoLista]: FieldValue.arrayUnion(id),
    });
  });

  console.log(`[Tienda] ${uid} compró ${tipo} "${id}" por ${item.precio} coronas.`);
  return { exito: true };
});

module.exports = { comprarCosmetico, CATALOGO_TIENDA };