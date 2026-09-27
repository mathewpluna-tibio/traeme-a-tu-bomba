import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../firebase/config";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../firebase/config";
import { crearPerfilSiNoExiste } from "../../firebase/perfilInicial";

const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;

const validarUsername = httpsCallable(functions, "validarUsername");

export default function RegisterForm({ onBack, onSuccess }) {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const validatePassword = (pwd) => PASSWORD_REGEX.test(pwd);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Validación de contraseña (RQNF-ING-03)
    if (!validatePassword(password)) {
      setError(
        "La contraseña debe tener mínimo 8 caracteres, una mayúscula y un carácter especial."
      );
      return;
    }

    setLoading(true);
    try {
      // 1. Verificar username (groserías + unicidad, todo en el servidor)
      const resultado = await validarUsername({ username: username.trim() });

      if (!resultado.data.valido) {
        if (resultado.data.motivo === "ofensivo") {
          setError("El nombre de usuario contiene palabras no permitidas.");
        } else if (resultado.data.motivo === "en_uso") {
          setError("Ese nombre de usuario ya está en uso.");
        } else {
          setError("El nombre de usuario no es válido.");
        }
        setLoading(false);
        return;
      }

      // 2. Crear cuenta en Firebase Auth (aquí se valida correo duplicado automáticamente)
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      const uid = credential.user.uid;

      // 3. Guardar perfil en Firestore (username, ID único, estadísticas base)
      await crearPerfilSiNoExiste(uid, {
        username: username.trim(),
        email: email.trim(),
      });

      onSuccess();
    } catch (err) {
      // Traducción de errores comunes de Firebase a mensajes claros
      if (err.code === "auth/email-already-in-use") {
        setError("Ese correo ya está registrado.");
      } else if (err.code === "auth/invalid-email") {
        setError("El correo electrónico no es válido.");
      } else {
        setError("Ocurrió un error al registrar la cuenta.");
        console.error(err);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="gm-auth-view">
      <button className="gm-auth-back" onClick={onBack} aria-label="Volver">
        ←
      </button>
      <h2 className="gm-login-title">Crear cuenta</h2>

      <form className="gm-auth-form" onSubmit={handleSubmit}>
        <input
          className="gm-auth-input"
          type="email"
          placeholder="Correo electrónico"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="gm-auth-input"
          type="text"
          placeholder="Nombre de usuario"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <input
          className="gm-auth-input"
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <p className="gm-auth-hint">
          Mínimo 8 caracteres, una mayúscula y un carácter especial.
        </p>

        {error && <p className="gm-auth-error">{error}</p>}

        <button type="submit" className="gm-login-btn gm-login-btn--email" disabled={loading}>
          {loading ? "Creando cuenta..." : "Crear cuenta"}
        </button>
      </form>
    </div>
  );
}