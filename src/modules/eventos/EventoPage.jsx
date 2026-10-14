import { useEventos } from "../../hooks/useEventos";
import { useUserProfile } from "../../hooks/useUserProfile";
import { MARCOS, BANNERS } from "../../data/cosmeticos";
import { ETIQUETA_COSMETICO, formatoFecha, formatoRestante, nombreCosmetico } from "./eventosConfig";
import "./Evento.css";

function Recompensa({ recompensa }) {
  const c = recompensa?.cosmetico;
  const imagen = c && c.tipo === "marco" ? MARCOS[c.id]?.imagen : c && c.tipo === "banner" ? BANNERS[c.id]?.imagen : null;
  return (
    <div className="ev-rewards">
      {recompensa?.coronas > 0 && (
        <span className="ev-reward ev-reward--coronas">
          <span className="ev-coin" />
          {recompensa.coronas} coronas
        </span>
      )}
      {c && (
        <span className="ev-reward ev-reward--cosmetico">
          {imagen && <span className="ev-reward-img" style={{ backgroundImage: `url(${imagen})` }} />}
          <span>
            <small>{ETIQUETA_COSMETICO[c.tipo]} exclusivo</small>
            {nombreCosmetico(c)}
          </span>
        </span>
      )}
    </div>
  );
}

export default function EventoPage({ onVolver }) {
  const { cargando, ahora, activo, proximo } = useEventos();
  const { profile } = useUserProfile();

  const progreso = (evento, mision) =>
    profile?.progresoEventos?.[evento.id]?.misiones?.[mision.id] || { progreso: 0, completada: false };

  return (
    <div className="ev-page">
      <div className="ev-container">
        {onVolver && (
          <button type="button" className="ev-back" onClick={onVolver}>
            ← Volver al menú
          </button>
        )}

        {cargando && <p className="ev-muted">Cargando evento...</p>}

        {!cargando && !activo && (
          <div className="ev-empty">
            <h2 className="ev-title">No existe un evento activo</h2>
            <p className="ev-muted">¡Vuelve más tarde para unirte al caos de las bombas!</p>
            {proximo && (
              <div className="ev-next">
                <span className="ev-badge ev-badge--prog">Próximo evento</span>
                <strong>{proximo.nombre}</strong>
                <span className="ev-muted">
                  Comienza el {formatoFecha(proximo.inicio)} (en {formatoRestante(proximo.inicio - ahora)})
                </span>
              </div>
            )}
          </div>
        )}

        {activo && (
          <>
            <header className="ev-header">
              <div>
                <span className="ev-badge ev-badge--activo">Evento activo</span>
                <h2 className="ev-title">{activo.nombre}</h2>
                {activo.descripcion && <p className="ev-muted">{activo.descripcion}</p>}
              </div>
              <div className="ev-time">
                <small>Termina en</small>
                <strong>{formatoRestante(activo.fin - ahora)}</strong>
                <small>{formatoFecha(activo.fin)}</small>
              </div>
            </header>

            <p className="ev-warning">
              Las recompensas de este evento son exclusivas: no podrás conseguirlas cuando termine.
            </p>

            <div className="ev-missions">
              {activo.misiones.map((m) => {
                const p = progreso(activo, m);
                const pct = Math.min(100, Math.round((p.progreso / m.objetivo) * 100));
                return (
                  <article key={m.id} className={"ev-mission" + (p.completada ? " ev-mission--done" : "")}>
                    <div className="ev-mission-top">
                      <h3 className="ev-mission-title">{m.descripcion}</h3>
                      {p.completada && <span className="ev-badge ev-badge--done">Completada</span>}
                    </div>
                    <div className="ev-bar" role="progressbar" aria-valuenow={p.progreso} aria-valuemin={0} aria-valuemax={m.objetivo}>
                      <div className="ev-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="ev-mission-bottom">
                      <span className="ev-muted">
                        {p.progreso} / {m.objetivo}
                      </span>
                      <Recompensa recompensa={m.recompensa} />
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}