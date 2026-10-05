import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase/config";

// Uids de los amigos del jugador (usuarios/{uid}/amigos, solo la escriben
// las Cloud Functions).
export function useAmigos(uid) {
  const [amigos, setAmigos] = useState([]);

  useEffect(() => {
    if (!uid) {
      setAmigos([]);
      return;
    }
    return onSnapshot(
      collection(db, "usuarios", uid, "amigos"),
      (snap) => setAmigos(snap.docs.map((d) => d.id)),
      (err) => console.error("Error leyendo amigos:", err)
    );
  }, [uid]);

  return amigos;
}

// RQF-SOC-03: solicitudes de amistad recibidas pendientes de responder.
export function useSolicitudesPendientes(uid) {
  const [solicitudes, setSolicitudes] = useState([]);

  useEffect(() => {
    if (!uid) {
      setSolicitudes([]);
      return;
    }
    return onSnapshot(
      query(collection(db, "solicitudesAmistad"), where("para", "==", uid)),
      (snap) => setSolicitudes(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => console.error("Error leyendo solicitudes:", err)
    );
  }, [uid]);

  return solicitudes;
}