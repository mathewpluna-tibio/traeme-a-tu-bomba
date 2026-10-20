import UserBomb from "../../assets/UserBomb.png";
import { obtenerBanner, obtenerMarco, tituloVisible } from "../../data/cosmeticos";

const TAM_MARCO = 54;

function Corazones({ vidas = 0 }) {
  return (
    <div className="gp-lives" title={`${vidas} ${vidas === 1 ? "vida" : "vidas"}`}>
      {[0, 1, 2].map((i) => {
        const relleno = Math.max(0, Math.min(1, vidas - i));
        return (
          <span key={i} className="gp-heart">
            <span className="gp-heart-fill" style={{ width: `${relleno * 100}%` }}>♥</span>
          </span>
        );
      })}
    </div>
  );
}

function PanelJugador({ etiqueta, jugador, alinear = "izq" }) {
  const { perfil, vidas, mostrarVidas = true, extra, enTurno, color } = jugador;
  const marco = obtenerMarco(perfil?.marcoActivo);
  const banner = obtenerBanner(perfil?.bannerActivo);
  const tamFoto = Math.round(TAM_MARCO * (marco.holeRatio || 0.75) * 1.18);
  const nombre = perfil?.username || "Invitado";

  return (
    <div
      className={
        "gp-player" +
        (alinear === "der" ? " gp-player--der" : "") +
        (enTurno ? " gp-player--turno" : "") +
        (color ? ` gp-player--${color}` : "")
      }
    >
      <div
        className="gp-player-banner"
        aria-hidden="true"
        style={{ backgroundImage: `url(${banner.imagen})` }}
      />
      <div className="gp-identity">
        <div className="gp-avatar" style={{ width: TAM_MARCO, height: TAM_MARCO }}>
          <img className="gp-avatar-foto" src={perfil?.fotoPerfil || UserBomb} alt="" style={{ width: tamFoto, height: tamFoto }} />
          <img className="gp-avatar-marco" src={marco.imagen} alt="" aria-hidden="true" />
        </div>
        <div className="gp-identity-text">
          <span className="gp-player-label">{etiqueta}</span>
          <span className="gp-player-name">{nombre}</span>
          {perfil && <span className="gp-title-banner">{tituloVisible(perfil)}</span>}
        </div>
      </div>
      {mostrarVidas && <Corazones vidas={vidas} />}
      {extra}
    </div>
  );
}

/**
 * HUD de la partida (diseño del tablero de tu compañero): jugador, bloque
 * central de ronda/tiempo y rival.
 */
export default function HudPartida({ titulo, fase, segundos, centro, yo, rival }) {
  return (
    <header className="gp-hud">
      <PanelJugador etiqueta="Tú" jugador={yo} />
      <div className="gp-round">
        <span className="gp-round-label">{titulo}</span>
        <span className="gp-phase-badge">{fase}</span>
        <div className={"gp-timer" + (segundos != null && segundos <= 3 ? " gp-timer--urgente" : "")}>
          {segundos != null ? segundos : "–"}
        </div>
        {centro}
      </div>
      <PanelJugador etiqueta="Rival" jugador={rival} alinear="der" />
    </header>
  );
}