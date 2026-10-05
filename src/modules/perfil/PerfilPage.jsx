import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../../firebase/config";
import { useAuth } from "../../context/AuthContext";
import { useUserProfile } from "../../hooks/useUserProfile";
import { useEstaEnLinea } from "../../hooks/Useestaenlinea";
import ProfileHeader from "./ProfileHeader";
import StatsPanel from "./StatsPanel";

const enviarSolicitudCallable = httpsCallable(functions, "enviarSolicitudAmistad");

const MODALIDADES = [
  { key: "general", label: "Vista General" },
  { key: "estandar", label: "Modo Estándar" },
  { key: "venenosas", label: "Bombas Venenosas" },
  { key: "elementales", label: "Bombas Elementales" },
];

export default function PerfilPage({ onVolver, uidObjetivo, onRetar }) {
  const { user } = useAuth();
  const { profile, loading } = useUserProfile(uidObjetivo);
  const [modalidad, setModalidad] = useState("general");
  const [esAmigo, setEsAmigo] = useState(false);
  const [solicitudEnviada, setSolicitudEnviada] = useState(false);
  const [mensaje, setMensaje] = useState("");

  // Perfil propio si no se pasó uidObjetivo, o si coincide con el uid actual
  const isOwnProfile = !uidObjetivo || uidObjetivo === user?.uid;
  const targetUid = uidObjetivo || user?.uid;

  // RQNF-SOC-02: solo importa para el perfil de otro jugador
  const isOnline = useEstaEnLinea(!isOwnProfile ? targetUid : null);

  // Relación con el jugador que se está viendo (amigo / solicitud enviada)
  useEffect(() => {
    if (!user || isOwnProfile || !targetUid) return;
    const desAmigo = onSnapshot(
      doc(db, "usuarios", user.uid, "amigos", targetUid),
      (snap) => setEsAmigo(snap.exists()),
      () => {}
    );
    const desSolicitud = onSnapshot(
      doc(db, "solicitudesAmistad", `${user.uid}_${targetUid}`),
      (snap) => setSolicitudEnviada(snap.exists()),
      () => {}
    );
    return () => {
      desAmigo();
      desSolicitud();
    };
  }, [user, isOwnProfile, targetUid]);

  const agregarAmigo = async (uidDestino) => {
    setMensaje("");
    try {
      await enviarSolicitudCallable({ uidDestino });
    } catch (err) {
      console.error("Error al enviar solicitud:", err);
      setMensaje(err.message || "No se pudo enviar la solicitud.");
    }
  };

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
        esAmigo={esAmigo}
        solicitudEnviada={solicitudEnviada}
        onAddFriend={agregarAmigo}
        onChallenge={(id) => onRetar && onRetar(id)}
      />
      {mensaje && <p className="error-text">{mensaje}</p>}

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