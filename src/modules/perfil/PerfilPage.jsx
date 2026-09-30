import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useUserProfile } from "../../hooks/useUserProfile";
import { useEstaEnLinea } from "../../hooks/Useestaenlinea";
import ProfileHeader from "./ProfileHeader";
import StatsPanel from "./StatsPanel";

const MODALIDADES = [
  { key: "general", label: "Vista General" },
  { key: "estandar", label: "Modo Estándar" },
  { key: "venenosas", label: "Bombas Venenosas" },
  { key: "elementales", label: "Bombas Elementales" },
];

export default function PerfilPage({ onVolver, uidObjetivo }) {
  const { user } = useAuth();
  const { profile, loading } = useUserProfile(uidObjetivo);
  const [modalidad, setModalidad] = useState("general");

  // Perfil propio si no se pasó uidObjetivo, o si coincide con el uid actual
  const isOwnProfile = !uidObjetivo || uidObjetivo === user?.uid;
  const targetUid = uidObjetivo || user?.uid;

  // RQNF-SOC-02: solo importa para el perfil de otro jugador
  const isOnline = useEstaEnLinea(!isOwnProfile ? targetUid : null);

  if (loading) return <p>Cargando perfil...</p>;
  if (!profile) return <p>No se encontró tu perfil.</p>;

  return (
    <div className="pf-page">
      <button className="pf-back" onClick={onVolver}>← Volver al menú</button>

      <ProfileHeader
        profile={profile}
        uid={targetUid}
        isOwnProfile={isOwnProfile}
        isOnline={isOnline}
      />

      {/* Selector de modalidad (RQF-PER-05) */}
      <div className="pf-mode-tabs">
        {MODALIDADES.map((m) => (
          <button
            key={m.key}
            className={"pf-mode-tab" + (modalidad === m.key ? " pf-mode-tab--active" : "")}
            onClick={() => setModalidad(m.key)}
          >
            {m.label}
          </button>
        ))}
      </div>

      <StatsPanel profile={profile} modalidad={modalidad} />
    </div>
  );
}