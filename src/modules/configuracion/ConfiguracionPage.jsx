import { useState } from "react";
import { getAuth, EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";
import { usePreferencias } from "../../hooks/usePreferencias";
import "./Configuracion.css";

// RQNF-ING-03: mínimo 8 caracteres, una mayúscula y un carácter especial.
function validarContrasena(c) {
  if (c.length < 8) return "La nueva contraseña debe tener al menos 8 caracteres.";
  if (!/[A-Z]/.test(c)) return "La nueva contraseña debe incluir al menos una mayúscula.";
  if (!/[^A-Za-z0-9]/.test(c)) return "La nueva contraseña debe incluir al menos un carácter especial.";
  return "";
}

function mensajeError(err) {
  switch (err?.code) {
    case "auth/wrong-password":
    case "auth/invalid-credential":
    case "auth/invalid-login-credentials":
      return "La contraseña actual no es correcta.";
    case "auth/too-many-requests":
      return "Demasiados intentos. Espera un momento e inténtalo de nuevo.";
    case "auth/requires-recent-login":
      return "Por seguridad, cierra sesión, vuelve a entrar e inténtalo otra vez.";
    case "auth/network-request-failed":
      return "Sin conexión. Revisa tu internet e inténtalo de nuevo.";
    default:
      return "No se pudo cambiar la contraseña.";
  }
}

function Interruptor({ activo, onChange, etiqueta, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={etiqueta}
      disabled={disabled}
      className={"cf-switch" + (activo ? " cf-switch--on" : "")}
      onClick={() => onChange(!activo)}
    >
      <span className="cf-switch-knob" />
    </button>
  );
}

function CambiarContrasena() {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const enviar = async (e) => {
    e.preventDefault();
    setError("");
    setOk("");
    const invalida = validarContrasena(nueva);
    if (invalida) return setError(invalida);
    if (nueva !== confirmar) return setError("La confirmación no coincide con la nueva contraseña.");
    if (nueva === actual) return setError("La nueva contraseña debe ser distinta de la actual.");
    const usuario = getAuth().currentUser;
    if (!usuario?.email) return setError("No hay una sesión activa. Vuelve a iniciar sesión.");
    setOcupado(true);
    try {
      const credencial = EmailAuthProvider.credential(usuario.email, actual);
      await reauthenticateWithCredential(usuario, credencial);
      await updatePassword(usuario, nueva);
      setOk("Contraseña actualizada correctamente.");
      setActual("");
      setNueva("");
      setConfirmar("");
    } catch (err) {
      console.error(err);
      setError(mensajeError(err));
    } finally {
      setOcupado(false);
    }
  };

  return (
    <form className="cf-form" onSubmit={enviar}>
      <label className="cf-label">
        Contraseña actual
        <input className="cf-input" type="password" autoComplete="current-password" value={actual} onChange={(e) => setActual(e.target.value)} required />
      </label>
      <label className="cf-label">
        Nueva contraseña
        <input className="cf-input" type="password" autoComplete="new-password" value={nueva} onChange={(e) => setNueva(e.target.value)} required />
      </label>
      <label className="cf-label">
        Confirmar nueva contraseña
        <input className="cf-input" type="password" autoComplete="new-password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} required />
      </label>
      <p className="cf-hint">Mínimo 8 caracteres, una mayúscula y un carácter especial.</p>
      {error && <p className="cf-error" role="alert">{error}</p>}
      {ok && <p className="cf-ok" role="status">{ok}</p>}
      <button type="submit" className="cf-btn" disabled={ocupado}>
        {ocupado ? "Guardando..." : "Cambiar contraseña"}
      </button>
    </form>
  );
}

/**
 * Configuración del jugador: cambio de contraseña (RQF-CFG-01) y
 * preferencias de efectos de sonido y música (RQF-CFG-02 / 03).
 */
export default function ConfiguracionPage({ user: userProp, onVolver, onCerrarSesion }) {
  const user = userProp || getAuth().currentUser;
  const prefs = usePreferencias();
  const [errorPref, setErrorPref] = useState("");
  const esInvitado = !!user?.isAnonymous;

  const cambiar = async (campo, valor) => {
    setErrorPref("");
    try {
      await prefs.cambiar(campo, valor);
    } catch {
      setErrorPref("No se pudo guardar la preferencia. Inténtalo de nuevo.");
    }
  };

  return (
    <div className="cf-page">
      <div className="cf-container">
        {onVolver && (
          <button type="button" className="cf-back" onClick={onVolver}>
            Volver al menú
          </button>
        )}
        <header>
          <h1 className="cf-title">Configuración</h1>
          <p className="cf-subtitle">Ajusta tu cuenta y el audio del juego</p>
        </header>

        <section className="cf-section">
          <h2 className="cf-section-title">Audio</h2>
          <div className="cf-toggle-row">
            <div>
              <span className="cf-field-label">Efectos de sonido</span>
              <span className="cf-hint">Explosiones y bombas elementales</span>
            </div>
            <Interruptor activo={prefs.efectosActivos} etiqueta="Efectos de sonido" onChange={(v) => cambiar("efectosActivos", v)} />
          </div>
          <div className="cf-toggle-row">
            <div>
              <span className="cf-field-label">Música</span>
              <span className="cf-hint">Música de fondo del juego</span>
            </div>
            <Interruptor activo={prefs.musicaActiva} etiqueta="Música" onChange={(v) => cambiar("musicaActiva", v)} />
          </div>
          {esInvitado && <p className="cf-hint">Como invitado, tus preferencias solo duran esta sesión.</p>}
          {errorPref && <p className="cf-error" role="alert">{errorPref}</p>}
        </section>

        <section className="cf-section">
          <h2 className="cf-section-title">Cuenta</h2>
          {esInvitado ? (
            <p className="cf-hint">Los invitados no tienen contraseña. Crea una cuenta para poder gestionarla.</p>
          ) : (
            <>
              <p className="cf-account">{user?.email}</p>
              <CambiarContrasena />
            </>
          )}
          {onCerrarSesion && (
            <button type="button" className="cf-btn cf-btn--ghost" onClick={onCerrarSesion}>
              Cerrar sesión
            </button>
          )}
        </section>
      </div>
    </div>
  );
}