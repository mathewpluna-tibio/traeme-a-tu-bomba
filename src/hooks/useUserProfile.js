import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";

export function useUserProfile(uidObjetivo) {
  const { user } = useAuth();
  const uid = uidObjetivo || user?.uid;
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(doc(db, "usuarios", uid), (docSnap) => {
      setProfile(docSnap.exists() ? docSnap.data() : null);
      setLoading(false);
    });

    return unsubscribe;
  }, [uid]);

  return { profile, loading };
}