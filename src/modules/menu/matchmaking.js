import { ref, set } from "firebase/database";
import { rtdb } from "../../firebase/config";

export async function unirseACola(modalidad, uid, clase) {
  await set(ref(rtdb, `colaEspera/${modalidad}/${uid}`), {
    elo: 0, // TODO: Elo real
    clase: clase || "sin_clase", // Venenosas/Caos no eligen clase todavía
    timestamp: Date.now(),
  });
}