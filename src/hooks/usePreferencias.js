import { useCallback, useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import { setEfectosActivos } from "../modules/gameplay/efectos/sonidos";
import { setMusicaActiva } from "../modules/gameplay/efectos/musica";

// Preferencias de audio (RQNF-CFG-02 y RQNF-CFG-03): se guardan en Firestore,
// en preferencias/{uid}, y se aplican en cuanto el jugador inicia sesión.
// Los invitados no tienen documento: sus preferencias solo viven en esta sesión.
const POR_DEFECTO = { efectosActivos: true, musicaActiva: true };

function aplicar(prefs) {
  setEfectosActivos(prefs.efectosActivos);
  setMusicaActiva(prefs.musicaActiva);
}

// No depende de que el componente reciba `user`: escucha la sesión de Firebase
// por sí mismo, así basta con llamar `usePreferencias()` en un componente que
// esté montado mientras hay sesión (por ejemplo el menú principal).
export function usePreferencias() {
  const [user, setUser] = useState(() => getAuth().currentUser);
  const [prefs, setPrefs] = useState(POR_DEFECTO);
  const [cargado, setCargado] = useState(false);

  useEffect(() => onAuthStateChanged(getAuth(), setUser), []);
  const uid = user?.uid;
  const esInvitado = !!user?.isAnonymous;

  useEffect(() => {
    if (!uid) return;
    if (esInvitado) {
      aplicar(POR_DEFECTO);
      setPrefs(POR_DEFECTO);
      setCargado(true);
      return;
    }
    let cancelado = false;
    getDoc(doc(db, "preferencias", uid))
      .then((snap) => {
        const d = snap.exists() ? snap.data() : {};
        const nuevas = {
          efectosActivos: d.efectosActivos !== false,
          musicaActiva: d.musicaActiva !== false,
        };
        if (cancelado) return;
        setPrefs(nuevas);
        aplicar(nuevas);
      })
      .catch((err) => {
        console.error("No se pudieron leer las preferencias:", err);
        if (!cancelado) aplicar(POR_DEFECTO);
      })
      .finally(() => !cancelado && setCargado(true));
    return () => {
      cancelado = true;
    };
  }, [uid, esInvitado]);

  const cambiar = useCallback(
    async (campo, valor) => {
      const nuevas = { ...prefs, [campo]: valor };
      setPrefs(nuevas);
      aplicar(nuevas); // efecto inmediato
      if (!uid || esInvitado) return;
      try {
        await setDoc(doc(db, "preferencias", uid), { [campo]: valor }, { merge: true });
      } catch (err) {
        console.error("No se pudo guardar la preferencia:", err);
        setPrefs(prefs);
        aplicar(prefs);
        throw err;
      }
    },
    [prefs, uid, esInvitado]
  );

  return { ...prefs, cargado, cambiar };
}