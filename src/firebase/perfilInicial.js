import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./config";

/**
 * Estructura base de estadísticas para un usuario nuevo, compartida entre
 * el registro por correo (RegisterForm) y el alta automática por Google
 * (AuthContext.signInWithGoogle), para que ambos caminos generen el mismo
 * documento en `usuarios/{uid}`.
 */
export function estadisticasIniciales() {
  return {
    estandar: {
      elo: 0,
      rango: "Cadetes Bomberos",
      victorias: 0,
      derrotas: 0,
      vidasPerdidas: 0,
      partidasSinPerderVida: 0,
    },
    venenosas: {
      elo: 0,
      rango: "Cadetes Bomberos",
      victorias: 0,
      derrotas: 0,
      vidasPerdidas: 0,
      partidasSinPerderVida: 0,
    },
    elementales: {
      elo: 0,
      rango: "Cadetes Bomberos",
      victorias: 0,
      derrotas: 0,
      empates: 0,
      casillasMarcadas: 0,
      bombasHieloUsadas: 0,
    },
  };
}

/**
 * Crea el documento de perfil en Firestore únicamente si todavía no existe
 * (uid no encontrado en `usuarios`). Se usa en el alta manual (correo) y en
 * el primer ingreso con Google, donde no pasamos por validarUsername.
 */
export async function crearPerfilSiNoExiste(uid, { username, email, fotoPerfil = "" }) {
  const ref = doc(db, "usuarios", uid);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    return false;
  }

  await setDoc(ref, {
    username: username.trim(),
    email: (email || "").trim(),
    createdAt: new Date().toISOString(),
    coronas: 0,
    fotoPerfil,
    marcoActivo: "marco_cadete",
    bannerActivo: "banner_default",
    tituloActivo: "",
    estadisticas: estadisticasIniciales(),
  });

  return true;
}