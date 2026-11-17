const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");

const CATALOGO_TIENDA = [
  // Marcos
  { tipo: "marco", id: "Metal", precio: 75 },
  { tipo: "marco", id: "Nat", precio: 50 },
  { tipo: "marco", id: "Electro", precio: 100 },
  { tipo: "marco", id: "Dino", precio: 100 },
  // Banners
  { tipo: "banner", id: "Metal", precio: 75 },
  { tipo: "banner", id: "Nat", precio: 50 },
  { tipo: "banner", id: "Electro", precio: 100 },
  { tipo: "banner", id: "Dino", precio: 100 },
  // Títulos (el id es el texto del título). Espejo: TITULOS en src/data/cosmeticos.js
  { tipo: "titulo", id: "Agente Doble", precio: 100 },
  { tipo: "titulo", id: "Licencia para Ganar", precio: 100 },
  { tipo: "titulo", id: "As Bajo la Manga", precio: 100 },
  { tipo: "titulo", id: "Rey del Jurásico", precio: 75 },
  { tipo: "titulo", id: "Depredador Alfa", precio: 75 },
  { tipo: "titulo", id: "Fósil Viviente", precio: 75 },
  { tipo: "titulo", id: "Sobrecarga", precio: 75 },
  { tipo: "titulo", id: "Circuito Maestro", precio: 75 },
  { tipo: "titulo", id: "Alto Voltaje", precio: 75 },
  { tipo: "titulo", id: "Riesgo Nuclear", precio: 50 },
  { tipo: "titulo", id: "Guardián del Bosque", precio: 25 },
  { tipo: "titulo", id: "Espíritu Silvestre", precio: 25 },
];

const CAMPO_POR_TIPO = {
  marco: "marcosComprados",
  banner: "bannersComprados",
  titulo: "titulosObtenidos",
};

const comprarCosmetico = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
  }

  const { tipo, id } = request.data || {};
  if (!id || !CAMPO_POR_TIPO[tipo]) {
    throw new HttpsError("invalid-argument", "Cosmético inválido.");
  }

  const item = CATALOGO_TIENDA.find((c) => c.tipo === tipo && c.id === id);
  if (!item) {
    throw new HttpsError("not-found", "Ese cosmético no está disponible en la Tienda.");
  }

  const firestore = getFirestore();
  const perfilRef = firestore.collection("usuarios").doc(uid);
  const campoLista = CAMPO_POR_TIPO[tipo];

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

// RQNF-PERS-04 / RQNF-TIE-01: la Tienda pide el catálogo y sus precios al
// servidor cada vez que se abre, así siempre muestra los precios vigentes
// (los mismos con los que cobra comprarCosmetico).
const obtenerCatalogoTienda = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
  }
  return { catalogo: CATALOGO_TIENDA };
});

module.exports = { comprarCosmetico, obtenerCatalogoTienda, CATALOGO_TIENDA };