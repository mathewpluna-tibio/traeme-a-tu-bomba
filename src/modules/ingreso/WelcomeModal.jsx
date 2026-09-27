import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import LoginForm from "./LoginForm";
import RegisterForm from "./RegisterForm";
import logo from "../../assets/Logo_TATomba.png";
import "./WelcomeModal.css";

/**
 * Pantalla de ingreso (RQF-ING-01/02/05). Se muestra en lugar de
 * MenuPrincipal mientras no hay sesión iniciada (ver App.jsx), así que
 * ningún botón de juego queda accesible hasta iniciar sesión o entrar
 * como invitado.
 *
 * Estructura visual adaptada del GameMenu.jsx del equipo: logo + enlace
 * "Iniciar sesión" que abre una tarjeta con 3 vistas (welcome/login/register).
 */
export default function WelcomeModal({ onClose = () => {} }) {
  const { playAsGuest } = useAuth();

  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [authView, setAuthView] = useState("welcome"); // 'welcome' | 'login' | 'register'
  const [guestLoading, setGuestLoading] = useState(false);

  const openAuth = () => {
    setAuthView("welcome");
    setIsLoginOpen(true);
  };

  const closeAuth = () => setIsLoginOpen(false);

  const handleGuest = async () => {
    setGuestLoading(true);
    try {
      await playAsGuest();
      onClose();
    } catch (err) {
      console.error("Error entrando como invitado:", err);
      setGuestLoading(false);
    }
  };

  return (
    <div className="ingreso-panel">
      <div className={"ingreso-content" + (isLoginOpen ? " gm-login-open" : "")}>
        <img className="gm-game-logo" src={logo} alt="Traeme a tu bomba" />

        {!isLoginOpen && (
          <button className="gm-login-trigger" onClick={openAuth}>
            Iniciar sesión
          </button>
        )}

        {isLoginOpen && (
          <div className="gm-login-card">
            <button className="gm-login-close" onClick={closeAuth} aria-label="Cerrar">
              ✕
            </button>

            {authView === "welcome" && (
              <div className="gm-auth-view">
                <h2 className="gm-login-title">¡Bienvenido!</h2>
                <p className="gm-login-subtitle">Elige cómo quieres continuar</p>

                <button
                  className="gm-login-btn gm-login-btn--guest"
                  onClick={handleGuest}
                  disabled={guestLoading}
                >
                  <span className="gm-login-btn-icon">🎮</span>
                  {guestLoading ? "Entrando..." : "Jugar como Invitado"}
                </button>

                <button
                  className="gm-login-btn gm-login-btn--secondary"
                  onClick={() => setAuthView("register")}
                >
                  Crear cuenta
                </button>

                <button
                  className="gm-login-btn gm-login-btn--secondary"
                  onClick={() => setAuthView("login")}
                >
                  Iniciar sesión
                </button>
              </div>
            )}

            {authView === "login" && (
              <LoginForm onBack={() => setAuthView("welcome")} onSuccess={onClose} />
            )}

            {authView === "register" && (
              <RegisterForm onBack={() => setAuthView("welcome")} onSuccess={onClose} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}