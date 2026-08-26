import { ref, set } from "firebase/database";
import { doc, setDoc } from "firebase/firestore";
import { rtdb, db } from "../../firebase/config";

export async function unirseACola(modalidad, uid, clase) {
  await set(ref(rtdb, `colaEspera/${modalidad}/${uid}`), {
    elo: 0,
    clase: clase || "sin_clase",
    timestamp: Date.now(),
  });

  if (clase) {
    await setDoc(
      doc(db, "preferencias", uid),
      { ultimaModalidad: modalidad, ultimaClase: clase },
      { merge: true }
    );
  }
}