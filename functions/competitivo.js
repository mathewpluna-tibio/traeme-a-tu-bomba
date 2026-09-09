const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { determinarRango, calcularPuntosVictoria } = require("./elo");
const { registrarProgreso } = require("./misiones");

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

  // RQF-COM-04: vidas perdidas/quitadas/conservadas se calculan SIEMPRE,
  // sin importar si el resultado fue victoria o empate.
  const vidasA = jugadorA.vidas;
  const vidasB = jugadorB.vidas;
  const vidasPerdidasA = 3 - vidasA;
  const vidasPerdidasB = 3 - vidasB;

  const statsBaseA = {
    vidasPerdidas: vidasPerdidasA,
    vidasConservadas: vidasA,
    vidasQuitadas: vidasPerdidasB,
  };
  const statsBaseB = {
    vidasPerdidas: vidasPerdidasB,
    vidasConservadas: vidasB,
    vidasQuitadas: vidasPerdidasA,
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
    if (modalidad === "estandar") {
      await registrarProgreso(uidGanador, "partida_jugada_estandar", 1);
      await registrarProgreso(uidPerdedor, "partida_jugada_estandar", 1);
    }
    if (jugadorA.vidas === 3 || jugadorB.vidas === 3) {
      const vidasFinalesGanador = partida.jugadores[uidGanador].vidas;
      if (vidasFinalesGanador === 3) {
        await registrarProgreso(uidGanador, "victoria_sin_perder_vida", 1);
      }
    }

  } else if (resultado.tipo === "empate") {
    const eloA = jugadorA.eloInicial;
    const eloB = jugadorB.eloInicial;

    let nuevoEloA, nuevoEloB;
    if (eloA === eloB) {
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
      actualizarPerfilTrasPartida(uidA, modalidad, { elo: nuevoEloA, ...statsBaseA }),
      actualizarPerfilTrasPartida(uidB, modalidad, { elo: nuevoEloB, ...statsBaseB }),
    ]);
  }
}

async function actualizarPerfilTrasPartida(uid, modalidad, datos) {
  const firestore = getFirestore();
  const perfilRef = firestore.collection("usuarios").doc(uid);
  const perfilSnap = await perfilRef.get();
  if (!perfilSnap.exists) return;

  const nuevoRango = determinarRango(datos.elo);

  const actualizaciones = {
    [`estadisticas.${modalidad}.elo`]: datos.elo,
    [`estadisticas.${modalidad}.rango`]: nuevoRango,
    [`estadisticas.${modalidad}.vidasPerdidas`]: FieldValue.increment(datos.vidasPerdidas || 0),
    [`estadisticas.${modalidad}.vidasQuitadas`]: FieldValue.increment(datos.vidasQuitadas || 0),
    [`estadisticas.${modalidad}.vidasConservadas`]: FieldValue.increment(datos.vidasConservadas || 0),
  };

  if (datos.esVictoria !== undefined) {
    actualizaciones[`estadisticas.${modalidad}.victorias`] = FieldValue.increment(
      datos.esVictoria ? 1 : 0
    );
    actualizaciones[`estadisticas.${modalidad}.derrotas`] = FieldValue.increment(
      datos.esVictoria ? 0 : 1
    );
    if (datos.esVictoria && datos.vidasPerdidas === 0) {
      actualizaciones[`estadisticas.${modalidad}.partidasSinPerderVida`] = FieldValue.increment(1);
    }
    actualizaciones.coronas = FieldValue.increment(datos.coronas || 0);
  }

  await perfilRef.update(actualizaciones);
  console.log(`[Competitivo] Perfil ${uid} actualizado: elo=${datos.elo}, rango=${nuevoRango}`);
}

module.exports = { aplicarResultadoCompetitivo };