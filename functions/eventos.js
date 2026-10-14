const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");

/**
 * Eventos temporales (RQF-MIS-03 / RQF-MIS-04).
 *
 * Firestore: eventos/{id} = {
 *   nombre, descripcion, inicio: Timestamp, fin: Timestamp,
 *   misiones: [{ id, descripcion, tipo, objetivo,
 *                recompensa: { coronas, cosmetico?: { tipo, id } } }],
 *   concluido: bool, recompensasDisponibles: bool
 * }
 * Progreso del jugador: usuarios/{uid}.progresoEventos.{eventoId}.misiones.{misionId}
 *   = { progreso, completada }
 *
 * Los `tipo` de misión son los mismos eventos que ya alimentan a las
 * misiones diarias y logros (registrarProgreso en misiones.js).
 */
const TIPOS_EVENTO = [
  "victoria",
  "partida_jugada_estandar",
  "partida_jugada_venenosas",
  "partida_jugada_elementales",
  "victoria_elementales",
  "victoria_sin_perder_vida",
  "bomba_colocada",
  "casilla_segura_descubierta",
  "casilla_marcada_elemental",
  "bomba_hielo_usada",
  "bomba_elemental_usada",
  "partida_con_bombota",
];

// Caché corto: registrarProgreso se llama muchas veces por partida y no
// hace falta consultar Firestore en cada una.
let cache = { hasta: 0, eventos: [] };
const TTL_MS = 10 * 1000;

/** Eventos que están en curso AHORA (inicio <= ahora < fin). */
async function obtenerEventosActivos() {
  const ahora = Date.now();
  if (ahora < cache.hasta) return cache.eventos;

  const snap = await getFirestore()
    .collection("eventos")
    .where("fin", ">", Timestamp.fromMillis(ahora))
    .get();

  const eventos = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((e) => e.inicio.toMillis() <= ahora);

  cache = { hasta: ahora + TTL_MS, eventos };
  return eventos;
}

function invalidarCacheEventos() {
  cache = { hasta: 0, eventos: [] };
}

/** RQNF-MIS-03: al terminar el evento sus recompensas quedan marcadas como
 * no disponibles. (Además el progreso solo se cuenta mientras está activo
 * y las recompensas de evento nunca se venden en la Tienda.) */
const cerrarEventosVencidos = onSchedule(
  { schedule: "every 15 minutes", timeZone: "America/Mexico_City" },
  async () => {
    const firestore = getFirestore();
    const snap = await firestore
      .collection("eventos")
      .where("fin", "<=", Timestamp.now())
      .get();

    const batch = firestore.batch();
    let n = 0;
    snap.forEach((d) => {
      if (d.data().concluido) return;
      batch.update(d.ref, { concluido: true, recompensasDisponibles: false });
      n++;
    });
    if (n > 0) await batch.commit();
    console.log(`[Eventos] ${n} evento(s) marcados como concluidos.`);
  }
);

module.exports = { TIPOS_EVENTO, obtenerEventosActivos, invalidarCacheEventos, cerrarEventosVencidos };