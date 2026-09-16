import { useEffect, useState } from "react";
import { ref, onValue } from "firebase/database";
import { rtdb } from "../firebase/config";

export function useServerTimeOffset() {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const offsetRef = ref(rtdb, ".info/serverTimeOffset");
    const unsubscribe = onValue(offsetRef, (snapshot) => {
      setOffset(snapshot.val() || 0);
    });
    return unsubscribe;
  }, []);

  return offset;
}