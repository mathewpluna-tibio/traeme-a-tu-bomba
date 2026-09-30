import "./LogrosPage.css";
import { useUserProfile } from "../../hooks/useUserProfile";
import { LOGROS, CATEGORIAS, describirRecompensa } from "./logrosCatalogo";

export default function LogrosPage({ onVolver }) {
  const { profile, loading } = useUserProfile();

  if (loading) return <p>Cargando...</p>;
  if (!profile) return <p>No se encontró tu perfil.</p>;

  const progresoLogros = profile.progresoLogros || {};

  const desbloqueados = LOGROS.filter((l) => progresoLogros[l.id]?.desbloqueado).length;

  return (
    <div className="logros-page">
      {onVolver && (
        <button className="logros-volver" onClick={onVolver}>
          ← Volver al menú
        </button>
      )}

      <h2>Logros</h2>
      <p className="logros-resumen">
        {desbloqueados} / {LOGROS.length} desbloqueados
      </p>

      {CATEGORIAS.map((categoria) => {
        const logrosDeCategoria = LOGROS.filter((l) => l.categoria === categoria.id);
        if (logrosDeCategoria.length === 0) return null;

        return (
          <section key={categoria.id} className="logros-seccion">
            <h3 className="logros-seccion-titulo">{categoria.titulo}</h3>
            <div className="logros-lista">
              {logrosDeCategoria.map((logro) => {
                const propio = progresoLogros[logro.id];
                const desbloqueado = propio?.desbloqueado === true;
                const objetivo = propio?.objetivo ?? logro.objetivo;
                const progreso = Math.min(objetivo, propio?.progreso || 0);
                const porcentaje = objetivo > 0 ? Math.round((progreso / objetivo) * 100) : 0;

                return (
                  <div
                    key={logro.id}
                    className={`logro-card ${desbloqueado ? "logro-desbloqueado" : "logro-bloqueado"}`}
                  >
                    <div className="logro-icono">{desbloqueado ? "🏆" : "🔒"}</div>
                    <div className="logro-info">
                      <p className="logro-descripcion">{logro.descripcion}</p>
                      <div className="logro-barra-fondo">
                        <div className="logro-barra-relleno" style={{ width: `${porcentaje}%` }} />
                      </div>
                      <div className="logro-detalle">
                        <span>{progreso} / {objetivo}</span>
                        <span className="logro-recompensa">{describirRecompensa(logro)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}