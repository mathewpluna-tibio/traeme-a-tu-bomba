import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signInAnonymously,signOut} from "firebase/auth";
import { auth, rtdb } from "../firebase/config";
import { ref, remove } from "firebase/database";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Firebase persiste la sesión automáticamente (RQF-ING-05)
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const playAsGuest = async () => {
    const result = await signInAnonymously(auth);
    return result.user;
  };

  const cerrarSesion = async () => {
    if (auth.currentUser) {
      await remove(ref(rtdb, `sesionActiva/${auth.currentUser.uid}`));
    }
    await signOut(auth);
  };

  const value = { user, loading, playAsGuest, cerrarSesion };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}