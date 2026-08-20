import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import LoginForm from "./LoginForm.jsx";
import RegisterForm from "./RegisterForm";

export default function WelcomeModal({ onClose }) {
  const [view, setView] = useState("options"); // "options" | "login" | "register"
  const { playAsGuest } = useAuth();
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
    <div className="modal-overlay">
      <div className="modal-content">
        {view === "options" && (
          <>
            <h2>Bienvenido a Traeme a tu bomba</h2>
            <button onClick={handleGuest} disabled={guestLoading}>
              {guestLoading ? "Entrando..." : "Jugar como Invitado"}
            </button>
            <button onClick={() => setView("register")}>Crear Cuenta</button>
            <button onClick={() => setView("login")}>Iniciar Sesión</button>
          </>
        )}

        {view === "login" && (
          <LoginForm onBack={() => setView("options")} onSuccess={onClose} />
        )}

        {view === "register" && (
          <RegisterForm onBack={() => setView("options")} onSuccess={onClose} />
        )}
      </div>
    </div>
  );
}