import './avatar.css'

export default function ProfileHeader({ profile }) {
  return (
    <div
      className="profile-header"
      style={{ backgroundImage: `url(${profile.bannerActivo || ""})` }}
    >
      <div className="avatar-container">
        {/* El marco rodea la imagen; por ahora usamos el id como clase CSS */}
        <div className={`marco ${profile.marcoActivo}`}>
          <img
            src={profile.fotoPerfil || "/default_avatar.png"}
            alt="Avatar"
            className="avatar-img"
          />
        </div>
      </div>

      <h2>{profile.username}</h2>

      {/* RQF-PER-04: título activo debajo del nombre */}
      {profile.tituloActivo && (
        <p className="titulo-jugador">{profile.tituloActivo}</p>
      )}
    </div>
  );
}