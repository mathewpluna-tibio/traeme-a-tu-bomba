import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../firebase/config";

export default function LoginForm({ onBack, onSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      onSuccess();
    } catch (err) {
      // Firebase agrupa "correo no existe" y "contraseña incorrecta" bajo
      // el mismo código por seguridad (para no revelar qué correos existen)
      if (
        err.code === "auth/invalid-credential" ||
        err.code === "auth/wrong-password" ||
        err.code === "auth/user-not-found"
      ) {
        setError("Correo o contraseña incorrectos.");
      } else if (err.code === "auth/invalid-email") {
        setError("El correo electrónico no es válido.");
      } else if (err.code === "auth/too-many-requests") {
        setError("Demasiados intentos. Espera un momento e inténtalo de nuevo.");
      } else {
        setError("Ocurrió un error al iniciar sesión.");
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
      <h2 className="gm-login-title">Iniciar sesión</h2>

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
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && <p className="gm-auth-error">{error}</p>}

        <button type="submit" className="gm-login-btn gm-login-btn--email" disabled={loading}>
          {loading ? "Ingresando..." : "Iniciar sesión"}
        </button>
      </form>
    </div>
  );
}