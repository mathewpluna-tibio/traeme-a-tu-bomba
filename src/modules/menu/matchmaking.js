import { ref, set, remove, update } from "firebase/database";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { rtdb, db } from "../../firebase/config";

export async function unirseACola(modalidad, uid, clase, esInvitado) {
  await remove(ref(rtdb, `notificacionesPartida/${uid}`));

  let elo = 0;
  if (!esInvitado) {
    // RQNF-COM: invitados siempre juegan con Elo congelado en 0 (Cadetes Bomberos)
    const perfilSnap = await getDoc(doc(db, "usuarios", uid));
    if (perfilSnap.exists()) {
      elo = perfilSnap.data()?.estadisticas?.[modalidad]?.elo ?? 0;
    }
  }

  await set(ref(rtdb, `colaEspera/${modalidad}/${uid}`), {
    elo,
    esInvitado: !!esInvitado,
    clase: clase || "sin_clase",
    timestamp: Date.now(),
  });

  if (clase && !esInvitado) {
    await setDoc(
      doc(db, "preferencias", uid),
      { ultimaModalidad: modalidad, ultimaClase: clase },
      { merge: true }
    );
  }
}

export async function salirDeCola(modalidad, uid) {
  await remove(ref(rtdb, `colaEspera/${modalidad}/${uid}`));
}

export async function refrescarEnCola(modalidad, uid) {
  await update(ref(rtdb, `colaEspera/${modalidad}/${uid}`), { ultimoPing: Date.now() });
}