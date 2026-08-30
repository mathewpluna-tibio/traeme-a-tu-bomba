// src/hooks/useSesionUnica.js
import { useEffect } from "react";
import { ref, onDisconnect, set, onValue } from "firebase/database";
import { rtdb } from "../firebase/config";
import { useAuth } from "../context/AuthContext";

export function useSesionUnica() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const sesionId = crypto.randomUUID();
    const sesionRef = ref(rtdb, `sesionActiva/${user.uid}`);

    set(sesionRef, sesionId);
    onDisconnect(sesionRef).remove();

    const unsubscribe = onValue(sesionRef, (snapshot) => {
      if (snapshot.val() !== sesionId) {
        alert("Se detectó otra sesión activa con esta cuenta. Esta pestaña se cerrará.");
        window.location.href = "/"; // o cualquier redirección/limpieza que prefieras
      }
    });

    return unsubscribe;
  }, [user]);
}