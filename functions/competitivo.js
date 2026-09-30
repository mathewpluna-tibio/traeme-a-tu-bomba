const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { determinarRango, calcularPuntosVictoria } = require("./elo");
const { registrarProgreso, establecerProgresoRacha } = require("./misiones");

async function aplicarResultadoCompetitivo(partidaId, partida, resultado) {
  const uids = Object.keys(partida.jugadores);
  const [uidA, uidB] = uids;
  const jugadorA = partida.jugadores[uidA];
  const jugadorB = partida.jugadores[uidB];

  const esInvitado = jugadorA.esInvitado || jugadorB.esInvitado;
  const esPrivada = partida.tipo === "privada";
  if (esInvitado || esPrivada) {
    console.log(`[Competitivo] Partida ${partidaId} no otorga Elo (invitado o privada).`);
    return;
  }

  const modalidad = partida.modalidad;
  const esElementales = modalidad === "elementales";

  const statsBaseA = esElementales
    ? {
        casillasMarcadas: jugadorA.casillasMarcadas || 0,
        bombaHieloUsada: jugadorA.bombas?.hielo === false,
      }
    : {
        vidasPerdidas: 3 - jugadorA.vidas,
        vidasConservadas: jugadorA.vidas,
        vidasQuitadas: 3 - jugadorB.vidas,
      };
  const statsBaseB = esElementales
    ? {
        casillasMarcadas: jugadorB.casillasMarcadas || 0,
        bombaHieloUsada: jugadorB.bombas?.hielo === false,
      }
    : {
        vidasPerdidas: 3 - jugadorB.vidas,
        vidasConservadas: jugadorB.vidas,
        vidasQuitadas: 3 - jugadorA.vidas,
      };

  if (resultado.tipo === "victoria") {
    const uidGanador = resultado.ganador;
    const uidPerdedor = uids.find((id) => id !== uidGanador);
    const eloGanador = partida.jugadores[uidGanador].eloInicial;
    const eloPerdedor = partida.jugadores[uidPerdedor].eloInicial;

    const puntos = calcularPuntosVictoria(eloGanador, eloPerdedor);
    const nuevoEloGanador = eloGanador + puntos;
    const nuevoEloPerdedor = Math.max(0, eloPerdedor - puntos);

    const statsGanador = uidGanador === uidA ? statsBaseA : statsBaseB;
    const statsPerdedor = uidPerdedor === uidA ? statsBaseA : statsBaseB;

    await Promise.all([
      actualizarPerfilTrasPartida(uidGanador, modalidad, {
        elo: nuevoEloGanador,
        esVictoria: true,
        coronas: 1,
        ...statsGanador,
      }),
      actualizarPerfilTrasPartida(uidPerdedor, modalidad, {
        elo: nuevoEloPerdedor,
        esVictoria: false,
        coronas: 0,
        ...statsPerdedor,
      }),
    ]);

    await registrarProgreso(uidGanador, "victoria", 1);
    await registrarProgreso(uidGanador, `partida_jugada_${modalidad}`, 1);
    await registrarProgreso(uidPerdedor, `partida_jugada_${modalidad}`, 1);

    if (esElementales) {
      await registrarProgreso(uidGanador, "victoria_elementales", 1);
    }

    if (!esElementales && (jugadorA.vidas === 3 || jugadorB.vidas === 3)) {
      const vidasFinalesGanador = partida.jugadores[uidGanador].vidas;
      if (vidasFinalesGanador === 3) {
        await registrarProgreso(uidGanador, "victoria_sin_perder_vida", 1);
      }
    }

    if (!esElementales) {
      const vidasFinalesGanador = partida.jugadores[uidGanador].vidas;
      await actualizarRachaSinPerderVida(uidGanador, vidasFinalesGanador === 3);
      await actualizarRachaSinPerderVida(uidPerdedor, false);
    }

    await actualizarRachaVictorias(uidGanador, true);
    await actualizarRachaVictorias(uidPerdedor, false);
  } else if (resultado.tipo === "empate") {
    const eloA = jugadorA.eloInicial;
    const eloB = jugadorB.eloInicial;

    let nuevoEloA, nuevoEloB;
    if (esElementales) {
      // RQF del Modo Extra: Bombas Elementales - un empate reparte 15/15
      nuevoEloA = eloA + 15;
      nuevoEloB = eloB + 15;
    } else if (eloA === eloB) {
      nuevoEloA = eloA + 10;
      nuevoEloB = eloB + 10;
    } else if (eloA > eloB) {
      nuevoEloA = eloA - 10;
      nuevoEloB = eloB + 10;
    } else {
      nuevoEloA = eloA + 10;
      nuevoEloB = eloB - 10;
    }

    await Promise.all([
      actualizarPerfilTrasPartida(uidA, modalidad, {
        elo: nuevoEloA,
        esEmpate: esElementales,
        ...statsBaseA,
      }),
      actualizarPerfilTrasPartida(uidB, modalidad, {
        elo: nuevoEloB,
        esEmpate: esElementales,
        ...statsBaseB,
      }),
    ]);

    await registrarProgreso(uidA, `partida_jugada_${modalidad}`, 1);
    await registrarProgreso(uidB, `partida_jugada_${modalidad}`, 1);

    if (!esElementales) {
      await actualizarRachaSinPerderVida(uidA, false);
      await actualizarRachaSinPerderVida(uidB, false);
    }

    await actualizarRachaVictorias(uidA, false);
    await actualizarRachaVictorias(uidB, false);
  }
}

async function actualizarRachaSinPerderVida(uid, siguioLaRacha) {
  const firestore = getFirestore();
  const perfilRef = firestore.collection("usuarios").doc(uid);
  const perfilSnap = await perfilRef.get();
  if (!perfilSnap.exists) return;

  const rachaActual = perfilSnap.data().rachaVictoriasSinPerderVida || 0;
  const nuevaRacha = siguioLaRacha ? rachaActual + 1 : 0;

  await perfilRef.update({ rachaVictoriasSinPerderVida: nuevaRacha });
  await establecerProgresoRacha(uid, "racha_victoria_sin_perder_vida", nuevaRacha);
}

async function actualizarRachaVictorias(uid, gano) {
  const firestore = getFirestore();
  const perfilRef = firestore.collection("usuarios").doc(uid);
  const perfilSnap = await perfilRef.get();
  if (!perfilSnap.exists) return;

  const rachaActual = perfilSnap.data().rachaVictorias || 0;
  const nuevaRacha = gano ? rachaActual + 1 : 0;

  await perfilRef.update({ rachaVictorias: nuevaRacha });
  await establecerProgresoRacha(uid, "racha_victorias", nuevaRacha);
}

async function actualizarPerfilTrasPartida(uid, modalidad, datos) {
  const firestore = getFirestore();
  const perfilRef = firestore.collection("usuarios").doc(uid);
  const perfilSnap = await perfilRef.get();
  if (!perfilSnap.exists) return;

  const nuevoRango = determinarRango(datos.elo);
  const esElementales = modalidad === "elementales";

  const actualizaciones = {
    [`estadisticas.${modalidad}.elo`]: datos.elo,
    [`estadisticas.${modalidad}.rango`]: nuevoRango,
  };

  if (esElementales) {
    actualizaciones[`estadisticas.${modalidad}.casillasMarcadas`] = FieldValue.increment(
      datos.casillasMarcadas || 0
    );
    if (datos.bombaHieloUsada) {
      actualizaciones[`estadisticas.${modalidad}.bombasHieloUsadas`] = FieldValue.increment(1);
    }
    if (datos.esEmpate) {
      actualizaciones[`estadisticas.${modalidad}.empates`] = FieldValue.increment(1);
    }
  } else {
    actualizaciones[`estadisticas.${modalidad}.vidasPerdidas`] = FieldValue.increment(datos.vidasPerdidas || 0);
    actualizaciones[`estadisticas.${modalidad}.vidasQuitadas`] = FieldValue.increment(datos.vidasQuitadas || 0);
    actualizaciones[`estadisticas.${modalidad}.vidasConservadas`] = FieldValue.increment(datos.vidasConservadas || 0);
  }

  if (datos.esVictoria !== undefined) {
    actualizaciones[`estadisticas.${modalidad}.victorias`] = FieldValue.increment(
      datos.esVictoria ? 1 : 0
    );
    actualizaciones[`estadisticas.${modalidad}.derrotas`] = FieldValue.increment(
      datos.esVictoria ? 0 : 1
    );
    if (!esElementales && datos.esVictoria && datos.vidasPerdidas === 0) {
      actualizaciones[`estadisticas.${modalidad}.partidasSinPerderVida`] = FieldValue.increment(1);
    }
    actualizaciones.coronas = FieldValue.increment(datos.coronas || 0);
  }

  await perfilRef.update(actualizaciones);
  console.log(`[Competitivo] Perfil ${uid} actualizado: elo=${datos.elo}, rango=${nuevoRango}`);
}

module.exports = { aplicarResultadoCompetitivo };