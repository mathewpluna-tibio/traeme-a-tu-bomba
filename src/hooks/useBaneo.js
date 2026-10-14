import { useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";

/** RQF-ADM-03: si el administrador banea la cuenta mientras está conectada,
 * se cierra la sesión de inmediato. */
export function useBaneo() {
  const { user, isAdmin, cerrarSesion } = useAuth();

  useEffect(() => {
    if (!user || isAdmin) return;
    return onSnapshot(
      doc(db, "usuarios", user.uid),
      (snap) => {
        if (snap.exists() && snap.data().baneado === true) {
          alert("Tu cuenta fue suspendida por un administrador.");
          cerrarSesion();
        }
      },
      () => {}
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAdmin]);
}