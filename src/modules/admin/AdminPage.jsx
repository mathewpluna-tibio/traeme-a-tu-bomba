import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import AdminEventos from "./AdminEventos";
import AdminJugadores from "./AdminJugadores";
import "./Admin.css";

const PESTANAS = [
  { id: "eventos", label: "Eventos" },
  { id: "jugadores", label: "Jugadores" },
];

/** Panel de administración (RQF-ADM-01..04). Solo se muestra a cuentas con
 * el rol `admin`; las funciones del servidor lo validan por su cuenta. */
export default function AdminPage() {
  const { user, cerrarSesion } = useAuth();
  const [pestana, setPestana] = useState("eventos");

  return (
    <div className="ad-page">
      <header className="ad-topbar">
        <div>
          <h1 className="ad-brand">Panel de administración</h1>
          <span className="ad-muted">{user?.email}</span>
        </div>
        <button type="button" className="ad-btn ad-btn--ghost" onClick={cerrarSesion}>
          Cerrar sesión
        </button>
      </header>

      <nav className="ad-tabs">
        {PESTANAS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={"ad-tab" + (pestana === p.id ? " ad-tab--active" : "")}
            onClick={() => setPestana(p.id)}
          >
            {p.label}
          </button>
        ))}
      </nav>

      <main className="ad-content">
        {pestana === "eventos" && <AdminEventos />}
        {pestana === "jugadores" && <AdminJugadores />}
      </main>
    </div>
  );
}