const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { MISIONES_DIARIAS, LOGROS } = require("./misionesCatalogo");

async function registrarProgreso(uid, tipoEvento, cantidad = 1) {
  const firestore = getFirestore();
  const perfilRef = firestore.collection("usuarios").doc(uid);
  const perfilSnap = await perfilRef.get();
  if (!perfilSnap.exists) return;

  const datos = perfilSnap.data();
  const misionesActivas = datos.misionesDiarias?.lista || [];
  const progresoLogros = datos.progresoLogros || {};

  const actualizaciones = {};
  let coronasGanadas = 0;
  const titulosNuevos = [];
  const marcosNuevos = [];
  const bannersNuevos = [];

  // --- Misiones diarias ---
  const misionesActualizadas = misionesActivas.map((m) => {
    if (m.completada || m.tipo !== tipoEvento) return m;
    const nuevoProgreso = Math.min(m.objetivo, m.progreso + cantidad);
    const completadaAhora = nuevoProgreso >= m.objetivo;
    if (completadaAhora) coronasGanadas += m.recompensaCoronas;
    return { ...m, progreso: nuevoProgreso, completada: completadaAhora };
  });
  if (JSON.stringify(misionesActualizadas) !== JSON.stringify(misionesActivas)) {
    actualizaciones["misionesDiarias.lista"] = misionesActualizadas;
  }

  // --- Logros permanentes ---
  // OJO: antes era `LOGROS.find(...)`, que solo dejaba avanzar al PRIMER
  // logro de ese `tipo` en el arreglo. En cuanto hay más de un logro que
  // comparte el mismo `tipo` (p. ej. varios que cuentan "victoria"), los
  // demás dejaban de recibir progreso para siempre en cuanto el primero
  // se desbloqueaba, sin ningún error visible. Con 13 logros varios van a
  // compartir `tipo`, así que ahora se recorren TODOS los que apliquen.
  const logrosRelevantes = LOGROS.filter((l) => l.tipo === tipoEvento);

  for (const logro of logrosRelevantes) {
    const yaDesbloqueado = progresoLogros[logro.id]?.desbloqueado === true;
    if (yaDesbloqueado) continue;

    const progresoActual = progresoLogros[logro.id]?.progreso || 0;
    const nuevoProgreso = Math.min(logro.objetivo, progresoActual + cantidad);
    const desbloqueadoAhora = nuevoProgreso >= logro.objetivo;

    actualizaciones[`progresoLogros.${logro.id}`] = {
      progreso: nuevoProgreso,
      desbloqueado: desbloqueadoAhora,
    };

    if (desbloqueadoAhora) {
      if (logro.recompensaCoronas) coronasGanadas += logro.recompensaCoronas;
      if (logro.tituloDesbloqueado) titulosNuevos.push(logro.tituloDesbloqueado);
      if (logro.marcoDesbloqueado) marcosNuevos.push(logro.marcoDesbloqueado);
      if (logro.bannerDesbloqueado) bannersNuevos.push(logro.bannerDesbloqueado);
    }
  }

  if (coronasGanadas > 0) {
    actualizaciones.coronas = FieldValue.increment(coronasGanadas);
  }
  if (titulosNuevos.length > 0) {
    actualizaciones.titulosObtenidos = FieldValue.arrayUnion(...titulosNuevos);
  }
  if (marcosNuevos.length > 0) {
    actualizaciones.marcosComprados = FieldValue.arrayUnion(...marcosNuevos);
  }
  if (bannersNuevos.length > 0) {
    actualizaciones.bannersComprados = FieldValue.arrayUnion(...bannersNuevos);
  }

  if (Object.keys(actualizaciones).length > 0) {
    await perfilRef.update(actualizaciones);
    console.log(`[Misiones] Progreso registrado para ${uid}: ${tipoEvento} +${cantidad}`);
  }
}

const { onSchedule } = require("firebase-functions/v2/scheduler");

const rotarMisionesDiarias = onSchedule(
  {
    schedule: "every day 00:00",
    timeZone: "America/Mexico_City",
  },
  async () => {
    const firestore = getFirestore();
    const usuariosSnap = await firestore.collection("usuarios").get();
    const hoy = new Date().toISOString().split("T")[0];

    const batch = firestore.batch();
    let contador = 0;

    usuariosSnap.forEach((doc) => {
      const datos = doc.data();
      if (datos.misionesDiarias?.fecha === hoy) return;

      const misionesElegidas = [...MISIONES_DIARIAS]
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map((m) => ({ ...m, progreso: 0, completada: false }));

      batch.update(doc.ref, {
        misionesDiarias: { fecha: hoy, lista: misionesElegidas },
      });
      contador++;
    });

    await batch.commit();
    console.log(`[Misiones] Rotación diaria completada para ${contador} usuarios.`);
  }
);

module.exports = { registrarProgreso, rotarMisionesDiarias };