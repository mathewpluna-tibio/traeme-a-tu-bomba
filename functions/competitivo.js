const { FieldValue } = require("firebase-admin/firestore");
const { getFirestore } = require("firebase-admin/firestore");
const { determinarRango, calcularPuntosVictoria } = require("./elo");

// Ya NO llamamos getFirestore() aquí arriba

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

  if (resultado.tipo === "victoria") {
    const uidGanador = resultado.ganador;
    const uidPerdedor = uids.find((id) => id !== uidGanador);
    const eloGanador = partida.jugadores[uidGanador].eloInicial;
    const eloPerdedor = partida.jugadores[uidPerdedor].eloInicial;

    const puntos = calcularPuntosVictoria(eloGanador, eloPerdedor);
    const nuevoEloGanador = eloGanador + puntos;
    const nuevoEloPerdedor = Math.max(0, eloPerdedor - puntos);

    const vidasFinalesGanador = partida.jugadores[uidGanador].vidas;
    const vidasPerdidasGanador = 3 - vidasFinalesGanador;
    const vidasPerdidasPerdedor = 3;

    await Promise.all([
      actualizarPerfilTrasPartida(uidGanador, modalidad, {
        elo: nuevoEloGanador,
        esVictoria: true,
        vidasPerdidas: vidasPerdidasGanador,
        coronas: 1,
      }),
      actualizarPerfilTrasPartida(uidPerdedor, modalidad, {
        elo: nuevoEloPerdedor,
        esVictoria: false,
        vidasPerdidas: vidasPerdidasPerdedor,
        coronas: 0,
      }),
    ]);
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
      actualizarPerfilTrasPartida(uidA, modalidad, { elo: nuevoEloA, esEmpate: true }),
      actualizarPerfilTrasPartida(uidB, modalidad, { elo: nuevoEloB, esEmpate: true }),
    ]);
  }
}

async function actualizarPerfilTrasPartida(uid, modalidad, datos) {
  const firestore = getFirestore(); // <-- AHORA se llama aquí, cuando ya existe la app
  const perfilRef = firestore.collection("usuarios").doc(uid);
  const perfilSnap = await perfilRef.get();
  if (!perfilSnap.exists) return;

  const nuevoRango = determinarRango(datos.elo);

  const actualizaciones = {
    [`estadisticas.${modalidad}.elo`]: datos.elo,
    [`estadisticas.${modalidad}.rango`]: nuevoRango,
  };

  if (datos.esVictoria !== undefined) {
    actualizaciones[`estadisticas.${modalidad}.victorias`] = FieldValue.increment(
      datos.esVictoria ? 1 : 0
    );
    actualizaciones[`estadisticas.${modalidad}.derrotas`] = FieldValue.increment(
      datos.esVictoria ? 0 : 1
    );
    actualizaciones[`estadisticas.${modalidad}.vidasPerdidas`] = FieldValue.increment(
      datos.vidasPerdidas || 0
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