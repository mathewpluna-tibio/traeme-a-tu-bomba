const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { MISIONES_DIARIAS, LOGROS } = require("./misionesCatalogo");

/** Acumula en `totales` la recompensa de un logro que se acaba de
 * desbloquear. Compartido por los 3 mecanismos de progreso (aditivo,
 * racha, multi-tipo) para no repetir esta lógica tres veces. */
function acumularRecompensas(logro, totales) {
  if (logro.recompensaCoronas) totales.coronas += logro.recompensaCoronas;
  if (logro.tituloDesbloqueado) totales.titulos.push(logro.tituloDesbloqueado);
  if (logro.marcoDesbloqueado) totales.marcos.push(logro.marcoDesbloqueado);
  if (logro.bannerDesbloqueado) totales.banners.push(logro.bannerDesbloqueado);
}

function aplicarTotalesAActualizaciones(totales, actualizaciones) {
  if (totales.coronas > 0) {
    actualizaciones.coronas = FieldValue.increment(totales.coronas);
  }
  if (totales.titulos.length > 0) {
    actualizaciones.titulosObtenidos = FieldValue.arrayUnion(...totales.titulos);
  }
  if (totales.marcos.length > 0) {
    actualizaciones.marcosComprados = FieldValue.arrayUnion(...totales.marcos);
  }
  if (totales.banners.length > 0) {
    actualizaciones.bannersComprados = FieldValue.arrayUnion(...totales.banners);
  }
}

/** Progreso normal (aditivo): misiones diarias y la mayoría de los
 * logros permanentes, que suman `cantidad` hacia un `objetivo` fijo. */
async function registrarProgreso(uid, tipoEvento, cantidad = 1) {
  const firestore = getFirestore();
  const perfilRef = firestore.collection("usuarios").doc(uid);
  const perfilSnap = await perfilRef.get();
  if (!perfilSnap.exists) return;

  const datos = perfilSnap.data();
  const misionesActivas = datos.misionesDiarias?.lista || [];
  const progresoLogros = datos.progresoLogros || {};

  const actualizaciones = {};
  const totales = { coronas: 0, titulos: [], marcos: [], banners: [] };

  // --- Misiones diarias ---
  const misionesActualizadas = misionesActivas.map((m) => {
    if (m.completada || m.tipo !== tipoEvento) return m;
    const nuevoProgreso = Math.min(m.objetivo, m.progreso + cantidad);
    const completadaAhora = nuevoProgreso >= m.objetivo;
    if (completadaAhora) totales.coronas += m.recompensaCoronas;
    return { ...m, progreso: nuevoProgreso, completada: completadaAhora };
  });
  if (JSON.stringify(misionesActualizadas) !== JSON.stringify(misionesActivas)) {
    actualizaciones["misionesDiarias.lista"] = misionesActualizadas;
  }

  // --- Logros permanentes: progreso aditivo normal ---
  // OJO: antes era `LOGROS.find(...)`, que solo dejaba avanzar al PRIMER
  // logro de ese `tipo` en el arreglo. En cuanto hay más de un logro que
  // comparte el mismo `tipo` (p. ej. varios que cuentan "victoria"), los
  // demás dejaban de recibir progreso para siempre en cuanto el primero
  // se desbloqueaba, sin ningún error visible. Con 13 logros varios
  // comparten `tipo`, así que ahora se recorren TODOS los que apliquen.
  const logrosRelevantes = LOGROS.filter((l) => l.tipo === tipoEvento && !l.esRacha);

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

    if (desbloqueadoAhora) acumularRecompensas(logro, totales);
  }

  // --- Logros permanentes: "al menos una vez en varias modalidades"
  // (p. ej. Todoterreno: jugar Estándar + Venenosas + Elementales). Estos
  // se definen con `tipoMultiple: [tipoA, tipoB, tipoC]` en vez de
  // `tipo`/`objetivo`. Cada tipo distinto que llega cuenta como "una
  // casilla marcada" del progreso, sin importar cuántas veces se repita;
  // se desbloquea cuando llegaron los 3 al menos una vez cada uno. ---
  const logrosMultiples = LOGROS.filter(
    (l) => Array.isArray(l.tipoMultiple) && l.tipoMultiple.includes(tipoEvento)
  );

  for (const logro of logrosMultiples) {
    const yaDesbloqueado = progresoLogros[logro.id]?.desbloqueado === true;
    if (yaDesbloqueado) continue;

    const completadosActuales = progresoLogros[logro.id]?.tiposCompletados || {};
    if (completadosActuales[tipoEvento]) continue; // este tipo ya contaba

    const nuevosCompletados = { ...completadosActuales, [tipoEvento]: true };
    const progreso = Object.keys(nuevosCompletados).length;
    const desbloqueadoAhora = logro.tipoMultiple.every((t) => nuevosCompletados[t]);

    actualizaciones[`progresoLogros.${logro.id}`] = {
      progreso,
      objetivo: logro.tipoMultiple.length,
      tiposCompletados: nuevosCompletados,
      desbloqueado: desbloqueadoAhora,
    };

    if (desbloqueadoAhora) acumularRecompensas(logro, totales);
  }

  aplicarTotalesAActualizaciones(totales, actualizaciones);

  if (Object.keys(actualizaciones).length > 0) {
    await perfilRef.update(actualizaciones);
    console.log(`[Misiones] Progreso registrado para ${uid}: ${tipoEvento} +${cantidad}`);
  }
}

/** Progreso de "racha" (p. ej. Doble Cero / Racha Invencible: victorias
 * SEGUIDAS sin perder ninguna vida). A diferencia de `registrarProgreso`,
 * que solo suma, aquí el llamador ya calculó el valor actual de la racha
 * (contando también cuándo se rompe, volviendo a 0) y este valor
 * simplemente se FIJA como progreso — así una racha rota puede bajar de
 * nuevo a 0 sin que el modelo aditivo lo interprete como un error. Los
 * logros ya desbloqueados son permanentes y no se tocan. */
async function establecerProgresoRacha(uid, tipoEvento, valorActual) {
  const firestore = getFirestore();
  const perfilRef = firestore.collection("usuarios").doc(uid);
  const perfilSnap = await perfilRef.get();
  if (!perfilSnap.exists) return;

  const datos = perfilSnap.data();
  const progresoLogros = datos.progresoLogros || {};
  const logrosRelevantes = LOGROS.filter((l) => l.tipo === tipoEvento && l.esRacha);
  if (logrosRelevantes.length === 0) return;

  const actualizaciones = {};
  const totales = { coronas: 0, titulos: [], marcos: [], banners: [] };

  for (const logro of logrosRelevantes) {
    const yaDesbloqueado = progresoLogros[logro.id]?.desbloqueado === true;
    if (yaDesbloqueado) continue;

    const nuevoProgreso = Math.min(logro.objetivo, Math.max(0, valorActual));
    const desbloqueadoAhora = nuevoProgreso >= logro.objetivo;

    actualizaciones[`progresoLogros.${logro.id}`] = {
      progreso: nuevoProgreso,
      desbloqueado: desbloqueadoAhora,
    };

    if (desbloqueadoAhora) acumularRecompensas(logro, totales);
  }

  aplicarTotalesAActualizaciones(totales, actualizaciones);

  if (Object.keys(actualizaciones).length > 0) {
    await perfilRef.update(actualizaciones);
    console.log(`[Misiones] Racha registrada para ${uid}: ${tipoEvento}=${valorActual}`);
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

module.exports = { registrarProgreso, establecerProgresoRacha, rotarMisionesDiarias };