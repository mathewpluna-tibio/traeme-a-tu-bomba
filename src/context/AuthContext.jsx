import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signInAnonymously, signOut } from "firebase/auth";
import { auth } from "../firebase/config";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Firebase persiste la sesión automáticamente (RQF-ING-05)
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      // RQNF-ADM-01: el rol de administrador es un custom claim de Firebase
      // Authentication (el servidor lo vuelve a validar en cada función admin).
      let admin = false;
      if (currentUser) {
        try {
          const token = await currentUser.getIdTokenResult();
          admin = token.claims.admin === true;
        } catch {
          admin = false;
        }
      }
      setIsAdmin(admin);
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
    await signOut(auth);
  };

  const value = { user, isAdmin, loading, playAsGuest, cerrarSesion };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}