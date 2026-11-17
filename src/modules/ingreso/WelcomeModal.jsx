import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import LoginForm from "./LoginForm";
import RegisterForm from "./RegisterForm";
import logo from "../../assets/Logo_TATomba.png";
import "./WelcomeModal.css";

export default function WelcomeModal({ onClose = () => {} }) {
  const { playAsGuest } = useAuth();

  const [authView, setAuthView] = useState("welcome"); // 'welcome' | 'login' | 'register'
  const [guestLoading, setGuestLoading] = useState(false);

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
      <div className="ingreso-content gm-login-open">
        <img className="gm-game-logo" src={logo} alt="Traeme a tu bomba" />

        <div className="gm-login-card">
          {authView === "welcome" && (
            <div className="gm-auth-view">
              <h2 className="gm-login-title">¡Bienvenido!</h2>
              <p className="gm-login-subtitle">Elige cómo quieres continuar</p>

              <button
                className="gm-login-btn gm-login-btn--guest"
                onClick={handleGuest}
                disabled={guestLoading}
              >
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
      </div>
    </div>
  );
}