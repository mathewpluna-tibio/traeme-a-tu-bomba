import { useEffect, useState } from "react";
import { ref, onValue } from "firebase/database";
import { rtdb } from "../firebase/config";

export function useEstaEnLinea(uid) {
  const [enLinea, setEnLinea] = useState(false);

  useEffect(() => {
    if (!uid) {
      setEnLinea(false);
      return;
    }

    const unsubscribe = onValue(ref(rtdb, `sesionActiva/${uid}`), (snap) => {
      setEnLinea(snap.exists());
    });

    return unsubscribe;
  }, [uid]);

  return enLinea;
}