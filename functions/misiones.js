const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { MISIONES_DIARIAS, LOGROS } = require("./misionesCatalogo");
const { obtenerEventosActivos } = require("./eventos");

/** Acumula en `totales` la recompensa de un logro que se acaba de
 * desbloquear. Compartido por los 3 mecanismos de progreso (aditivo,
 * racha, multi-tipo) para no repetir esta lógica tres veces. */
function acumularRecompensas(logro, totales) {
  if (logro.recompensaCoronas) totales.coronas += logro.recompensaCoronas;
  if (logro.tituloDesbloqueado) totales.titulos.push(logro.tituloDesbloqueado);
  if (logro.marcoDesbloqueado) totales.marcos.push(logro.marcoDesbloqueado);
  if (logro.bannerDesbloqueado) totales.banners.push(logro.bannerDesbloqueado);
}

/** Recompensa de una misión de evento (coronas + cosmético exclusivo). */
function acumularRecompensaEvento(recompensa, totales) {
  if (!recompensa) return;
  if (recompensa.coronas) totales.coronas += recompensa.coronas;
  const c = recompensa.cosmetico;
  if (!c) return;
  if (c.tipo === "titulo") totales.titulos.push(c.id);
  else if (c.tipo === "marco") totales.marcos.push(c.id);
  else if (c.tipo === "banner") totales.banners.push(c.id);
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
  // Los eventos activos se leen antes de la transacción (tienen su caché).
  // Un fallo aquí nunca debe romper el progreso de misiones y logros.
  let eventosActivos = [];
  try {
    eventosActivos = await obtenerEventosActivos();
  } catch (err) {
    console.error("[Misiones] Error al leer los eventos activos:", err);
  }

  // RQNF-LOGR-02: lectura y escritura en una transacción. Si dos registros
  // del mismo jugador llegan a la vez, Firestore detecta el conflicto y
  // repite la transacción con los datos ya actualizados, así un logro
  // nunca se cobra dos veces.
  await firestore.runTransaction(async (tx) => {
    const perfilSnap = await tx.get(perfilRef);
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

    // --- Eventos temporales (RQF-MIS-04) ---
    // Solo cuenta el progreso mientras el evento está activo; las recompensas
    // se entregan en el momento de completar la misión, nunca después de que
    // el evento termine (RQNF-MIS-03).
    try {
      for (const evento of eventosActivos) {
        const progresoEvento = datos.progresoEventos?.[evento.id]?.misiones || {};
        for (const m of evento.misiones || []) {
          if (m.tipo !== tipoEvento) continue;
          const previo = progresoEvento[m.id] || { progreso: 0, completada: false };
          if (previo.completada) continue;
          const nuevoProgreso = Math.min(m.objetivo, previo.progreso + cantidad);
          const completadaAhora = nuevoProgreso >= m.objetivo;
          actualizaciones[`progresoEventos.${evento.id}.misiones.${m.id}`] = {
            progreso: nuevoProgreso,
            completada: completadaAhora,
          };
          if (completadaAhora) acumularRecompensaEvento(m.recompensa, totales);
        }
      }
    } catch (err) {
      // Un fallo en eventos nunca debe romper el progreso normal.
      console.error("[Misiones] Error al registrar progreso de evento:", err);
    }

    aplicarTotalesAActualizaciones(totales, actualizaciones);

    if (Object.keys(actualizaciones).length > 0) {
      tx.update(perfilRef, actualizaciones);
      console.log(`[Misiones] Progreso registrado para ${uid}: ${tipoEvento} +${cantidad}`);
    }
  });
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
  // RQNF-LOGR-02: lectura y escritura en una transacción. Si dos registros
  // del mismo jugador llegan a la vez, Firestore detecta el conflicto y
  // repite la transacción con los datos ya actualizados, así un logro
  // nunca se cobra dos veces.
  await firestore.runTransaction(async (tx) => {
    const perfilSnap = await tx.get(perfilRef);
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
      tx.update(perfilRef, actualizaciones);
      console.log(`[Misiones] Racha registrada para ${uid}: ${tipoEvento}=${valorActual}`);
    }
  });
}

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");

const ZONA_HORARIA = "America/Mexico_City";

/** Fecha del día (AAAA-MM-DD) en la hora de México, la misma del ciclo. */
function fechaDeHoy() {
  return new Date().toLocaleDateString("en-CA", { timeZone: ZONA_HORARIA });
}

/** 3 misiones al azar del catálogo de la Tabla 1, con su progreso en 0. */
function elegirMisionesDiarias() {
  return [...MISIONES_DIARIAS]
    .sort(() => Math.random() - 0.5)
    .slice(0, 3)
    .map((m) => ({ ...m, progreso: 0, completada: false }));
}

const rotarMisionesDiarias = onSchedule(
  {
    schedule: "every day 00:00",
    timeZone: ZONA_HORARIA,
  },
  async () => {
    const firestore = getFirestore();
    const usuariosSnap = await firestore.collection("usuarios").get();
    const hoy = fechaDeHoy();

    // Un batch admite 500 escrituras: se confirma por bloques.
    let batch = firestore.batch();
    let enBatch = 0;
    let contador = 0;

    for (const doc of usuariosSnap.docs) {
      if (doc.data().misionesDiarias?.fecha === hoy) continue;
      batch.update(doc.ref, {
        misionesDiarias: { fecha: hoy, lista: elegirMisionesDiarias() },
      });
      contador++;
      enBatch++;
      if (enBatch === 450) {
        await batch.commit();
        batch = firestore.batch();
        enBatch = 0;
      }
    }
    if (enBatch > 0) await batch.commit();
    console.log(`[Misiones] Rotación diaria completada para ${contador} usuarios.`);
  }
);

// RQF-MIS-01: una cuenta nueva recibe sus 3 misiones del día en cuanto se
// crea su perfil, sin esperar a la rotación de medianoche.
const asignarMisionesNuevoUsuario = onDocumentCreated("usuarios/{uid}", async (event) => {
  const snap = event.data;
  if (!snap) return;
  if (snap.data()?.misionesDiarias?.fecha) return;
  await snap.ref.update({
    misionesDiarias: { fecha: fechaDeHoy(), lista: elegirMisionesDiarias() },
  });
  console.log(`[Misiones] Misiones iniciales asignadas a ${event.params.uid}.`);
});

module.exports = { registrarProgreso, establecerProgresoRacha, rotarMisionesDiarias, asignarMisionesNuevoUsuario };