import { useEffect, useState } from "react";
import { ref, onValue, remove } from "firebase/database";
import { rtdb } from "../firebase/config";
import { useAuth } from "../context/AuthContext";

export function useNotificacionPartida() {
  const { user } = useAuth();
  const [partidaId, setPartidaId] = useState(null);

  useEffect(() => {
    if (!user) return;

    const notifRef = ref(rtdb, `notificacionesPartida/${user.uid}`);
    const unsubscribe = onValue(notifRef, (snapshot) => {
      if (snapshot.exists()) {
        setPartidaId(snapshot.val());
      }
    });

    return unsubscribe;
  }, [user]);

  // Llamar esto una vez que ya navegaste a la partida, para no
  // quedarte "atorado" viendo la misma notificación otra vez
  const limpiarNotificacion = async () => {
    if (!user) return;
    await remove(ref(rtdb, `notificacionesPartida/${user.uid}`));
    setPartidaId(null);
  };

  return { partidaId, limpiarNotificacion };
}