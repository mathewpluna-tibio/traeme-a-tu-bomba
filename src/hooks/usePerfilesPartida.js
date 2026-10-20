import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/config";

// Lee una sola vez el perfil público (nombre, foto, marco, título) de cada
// jugador de la partida para mostrarlo en el HUD. Los invitados no tienen
// documento: se muestran como "Invitado".
export function usePerfilesPartida(uids = []) {
  const [perfiles, setPerfiles] = useState({});
  const clave = [...uids].sort().join(",");

  useEffect(() => {
    if (!clave) return;
    let cancelado = false;
    Promise.all(
      clave.split(",").map(async (uid) => {
        try {
          const snap = await getDoc(doc(db, "usuarios", uid));
          return [uid, snap.exists() ? snap.data() : null];
        } catch (err) {
          console.error("No se pudo leer el perfil del jugador:", err);
          return [uid, null];
        }
      })
    ).then((pares) => {
      if (!cancelado) setPerfiles(Object.fromEntries(pares));
    });
    return () => {
      cancelado = true;
    };
  }, [clave]);

  return perfiles;
}