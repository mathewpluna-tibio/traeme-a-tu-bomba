import "./avatar.css";
import UserBomb from "../../assets/UserBomb.png";
import { marcoDelPerfil, obtenerBanner, tituloVisible } from "../../data/cosmeticos";
import MarcoPerfil from "./MarcoPerfil";

const FRAME_SIZE = 140; 
const FACTOR_RELLENO = 1.18;

export default function ProfileHeader({
  profile,
  uid,
  isOwnProfile = true,
  isOnline = false,
  esAmigo = false,
  solicitudEnviada = false,
  onAddFriend = (id) => console.log("Enviar solicitud de amistad a:", id),
  onChallenge = (id) => console.log("Retar a partida privada a:", id),
}) {
  
  const marco = marcoDelPerfil(profile);
  const banner = obtenerBanner(profile.bannerActivo);

  const avatarSize = Math.round(FRAME_SIZE * marco.holeRatio * FACTOR_RELLENO);

  return (
    <div className="pf-card" style={{ backgroundImage: `url(${banner.imagen})` }}>
      <div className="pf-card-overlay" />

      <div className="pf-avatar-frame">
        <img
          src={profile.fotoPerfil || UserBomb}
          alt={`Avatar de ${profile.username}`}
          className="pf-avatar"
          style={{ width: avatarSize, height: avatarSize }}
        />
        <MarcoPerfil className="pf-marco" marco={marco} />
        {!isOwnProfile && isOnline && <span className="pf-online-dot" />}
      </div>

      <div className="pf-identity">
        <h1 className="pf-username">{profile.username}</h1>

        <span className="pf-title-banner">{tituloVisible(profile)}</span>
        {/* ID de amigo: con él se busca y se agrega a un jugador (RQF-SOC-01).
            El ID interno de la base de datos ya no se muestra. */}
        {profile.idAmigo && (
          <button
            className="pf-id"
            title="Copiar ID de amigo"
            onClick={() => navigator.clipboard?.writeText(profile.idAmigo)}
          >
            ID de amigo: {profile.idAmigo}
          </button>
        )}
      </div>

      {!isOwnProfile && (
        <div className="pf-actions">
          <button
            className="pf-btn pf-btn--secondary"
            disabled={esAmigo || solicitudEnviada || !profile.idAmigo}
            onClick={() => onAddFriend(profile.idAmigo)}
          >
            {esAmigo ? "✓ Amigos" : solicitudEnviada ? "Solicitud enviada ✓" : "Agregar amigo"}
          </button>
          <button
            className="pf-btn pf-btn--primary"
            disabled={!isOnline}
            onClick={() => onChallenge(uid)}
            title={!isOnline ? "El jugador debe estar en línea para retarlo" : undefined}
          >
            Retar a partida privada
          </button>
        </div>
      )}
    </div>
  );
}