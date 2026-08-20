import { useEffect, useState } from "react";
import { ref, onValue } from "firebase/database";
import { rtdb } from "../firebase/config";

export function usePartida(partidaId) {
  const [partida, setPartida] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!partidaId) return;

    const partidaRef = ref(rtdb, `partidas/${partidaId}`);
    const unsubscribe = onValue(partidaRef, (snapshot) => {
      setPartida(snapshot.val());
      setLoading(false);
    });

    return unsubscribe;
  }, [partidaId]);

  return { partida, loading };
}