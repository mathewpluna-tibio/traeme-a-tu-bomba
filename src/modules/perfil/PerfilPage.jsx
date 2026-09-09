import { useState } from "react";
import { useUserProfile } from "../../hooks/useUserProfile";
import ProfileHeader from "./ProfileHeader";
import StatsPanel from "./StatsPanel";

const MODALIDADES = [
  { key: "general", label: "Vista General" },
  { key: "estandar", label: "Modo Estándar" },
  { key: "venenosas", label: "Bombas Venenosas" },
  { key: "elementales", label: "Bombas Elementales" },
];

export default function PerfilPage({ onVolver }) {
  const { profile, loading } = useUserProfile();
  const [modalidad, setModalidad] = useState("general");

  if (loading) return <p>Cargando perfil...</p>;
  if (!profile) return <p>No se encontró tu perfil.</p>;

  return (
    <div className="perfil-page">
      <button onClick={onVolver} style={{ margin: "12px" }}>← Volver al menú</button>
     
      <ProfileHeader profile={profile} />

      {/* Selector de modalidad (RQF-PER-05) */}
      <div className="modalidad-selector">
        {MODALIDADES.map((m) => (
          <button
            key={m.key}
            className={modalidad === m.key ? "activo" : ""}
            onClick={() => setModalidad(m.key)}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Cambia sin recargar la página (RQNF-PER-04) porque solo
          actualiza el estado local `modalidad` */}
      <StatsPanel profile={profile} modalidad={modalidad} />
    </div>
  );
}