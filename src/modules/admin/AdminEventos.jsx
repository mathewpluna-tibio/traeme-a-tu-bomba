import { useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../firebase/config";
import { useEventos } from "../../hooks/useEventos";
import {
  TIPOS_EVENTO,
  ETIQUETA_COSMETICO,
  cosmeticosDeEvento,
  estadoEvento,
  etiquetaTipo,
  formatoFecha,
  nombreCosmetico,
} from "../eventos/eventosConfig";

const guardarEventoCallable = httpsCallable(functions, "guardarEvento");
const eliminarEventoCallable = httpsCallable(functions, "eliminarEvento");

const MAX_MISIONES = 8;

const nuevaMision = () => ({ id: null, tipo: "victoria", objetivo: 5, descripcion: "", coronas: 20, cosTipo: "", cosId: "" });

const aInputLocal = (ms) => {
  const d = new Date(ms);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

function desdeEvento(e) {
  return {
    id: e.id,
    nombre: e.nombre,
    descripcion: e.descripcion || "",
    inicio: aInputLocal(e.inicio),
    fin: aInputLocal(e.fin),
    misiones: e.misiones.map((m) => ({
      id: m.id,
      tipo: m.tipo,
      objetivo: m.objetivo,
      descripcion: m.descripcion,
      coronas: m.recompensa?.coronas || 0,
      cosTipo: m.recompensa?.cosmetico?.tipo || "",
      cosId: m.recompensa?.cosmetico?.id || "",
    })),
  };
}

function haciaServidor(f) {
  return {
    nombre: f.nombre,
    descripcion: f.descripcion,
    inicio: new Date(f.inicio).toISOString(),
    fin: new Date(f.fin).toISOString(),
    misiones: f.misiones.map((m) => ({
      id: m.id || undefined,
      tipo: m.tipo,
      objetivo: Number(m.objetivo),
      descripcion: m.descripcion.trim() || `${etiquetaTipo(m.tipo)}: ${m.objetivo}`,
      recompensa: {
        coronas: Number(m.coronas) || 0,
        ...(m.cosTipo && m.cosId.trim() ? { cosmetico: { tipo: m.cosTipo, id: m.cosId.trim() } } : {}),
      },
    })),
  };
}

const ETIQUETA_ESTADO = { programado: "Programado", activo: "Activo", concluido: "Concluido" };

function FormularioEvento({ inicial, onCancelar, onGuardado }) {
  const [f, setF] = useState(inicial);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const set = (campo, valor) => setF((p) => ({ ...p, [campo]: valor }));
  const setMision = (i, campo, valor) =>
    setF((p) => ({ ...p, misiones: p.misiones.map((m, j) => (j === i ? { ...m, [campo]: valor } : m)) }));

  const guardar = async (e) => {
    e.preventDefault();
    setError("");
    if (!f.inicio || !f.fin) {
      setError("Indica la fecha y hora de inicio y de fin.");
      return;
    }
    setGuardando(true);
    try {
      await guardarEventoCallable({ id: f.id || undefined, evento: haciaServidor(f) });
      onGuardado();
    } catch (err) {
      console.error(err);
      setError(err.message || "No se pudo guardar el evento.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <form className="ad-card ad-form" onSubmit={guardar}>
      <h2 className="ad-h2">{f.id ? "Editar evento" : "Nuevo evento"}</h2>

      <label className="ad-field">
        <span>Nombre</span>
        <input className="ad-input" value={f.nombre} maxLength={60} onChange={(e) => set("nombre", e.target.value)} required />
      </label>
      <label className="ad-field">
        <span>Descripción (opcional)</span>
        <textarea className="ad-input" rows={2} maxLength={300} value={f.descripcion} onChange={(e) => set("descripcion", e.target.value)} />
      </label>
      <div className="ad-row">
        <label className="ad-field">
          <span>Inicio</span>
          <input className="ad-input" type="datetime-local" value={f.inicio} onChange={(e) => set("inicio", e.target.value)} required />
        </label>
        <label className="ad-field">
          <span>Fin</span>
          <input className="ad-input" type="datetime-local" value={f.fin} onChange={(e) => set("fin", e.target.value)} required />
        </label>
      </div>

      <h3 className="ad-h3">Misiones y recompensas</h3>
      {f.misiones.map((m, i) => {
        const opciones = m.cosTipo && m.cosTipo !== "titulo" ? cosmeticosDeEvento(m.cosTipo) : [];
        return (
          <div key={i} className="ad-mision">
            <div className="ad-row">
              <label className="ad-field ad-field--grow">
                <span>Objetivo</span>
                <select className="ad-input" value={m.tipo} onChange={(e) => setMision(i, "tipo", e.target.value)}>
                  {TIPOS_EVENTO.map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              </label>
              <label className="ad-field ad-field--num">
                <span>Cantidad</span>
                <input className="ad-input" type="number" min={1} max={100000} value={m.objetivo} onChange={(e) => setMision(i, "objetivo", e.target.value)} required />
              </label>
              <label className="ad-field ad-field--num">
                <span>Coronas</span>
                <input className="ad-input" type="number" min={0} max={5000} value={m.coronas} onChange={(e) => setMision(i, "coronas", e.target.value)} />
              </label>
            </div>
            <label className="ad-field">
              <span>Texto que verá el jugador (si lo dejas vacío se genera solo)</span>
              <input className="ad-input" maxLength={120} placeholder={`${etiquetaTipo(m.tipo)}: ${m.objetivo}`} value={m.descripcion} onChange={(e) => setMision(i, "descripcion", e.target.value)} />
            </label>
            <div className="ad-row">
              <label className="ad-field ad-field--grow">
                <span>Cosmético exclusivo</span>
                <select
                  className="ad-input"
                  value={m.cosTipo}
                  onChange={(e) => setF((p) => ({ ...p, misiones: p.misiones.map((x, j) => (j === i ? { ...x, cosTipo: e.target.value, cosId: "" } : x)) }))}
                >
                  <option value="">Ninguno</option>
                  <option value="marco">Marco</option>
                  <option value="banner">Banner</option>
                  <option value="titulo">Título</option>
                </select>
              </label>
              {m.cosTipo === "titulo" && (
                <label className="ad-field ad-field--grow">
                  <span>Texto del título</span>
                  <input className="ad-input" maxLength={40} value={m.cosId} onChange={(e) => setMision(i, "cosId", e.target.value)} required />
                </label>
              )}
              {m.cosTipo && m.cosTipo !== "titulo" && (
                <label className="ad-field ad-field--grow">
                  <span>{ETIQUETA_COSMETICO[m.cosTipo]}</span>
                  <select className="ad-input" value={m.cosId} onChange={(e) => setMision(i, "cosId", e.target.value)} required>
                    <option value="">Elige uno…</option>
                    {opciones.map((c) => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            {m.cosTipo && m.cosTipo !== "titulo" && opciones.length === 0 && (
              <p className="ad-hint">
                No hay {m.cosTipo === "marco" ? "marcos" : "banners"} exclusivos registrados. Agrégalos en
                src/data/cosmeticos.js con <code>precio: null</code> y aparecerán aquí.
              </p>
            )}
            {f.misiones.length > 1 && (
              <button type="button" className="ad-btn ad-btn--danger ad-btn--sm" onClick={() => setF((p) => ({ ...p, misiones: p.misiones.filter((_, j) => j !== i) }))}>
                Quitar misión
              </button>
            )}
          </div>
        );
      })}

      {f.misiones.length < MAX_MISIONES && (
        <button type="button" className="ad-btn ad-btn--ghost" onClick={() => setF((p) => ({ ...p, misiones: [...p.misiones, nuevaMision()] }))}>
          + Agregar misión
        </button>
      )}

      {error && <p className="ad-error">{error}</p>}

      <div className="ad-actions">
        <button type="button" className="ad-btn ad-btn--ghost" onClick={onCancelar} disabled={guardando}>Cancelar</button>
        <button type="submit" className="ad-btn ad-btn--primary" disabled={guardando}>
          {guardando ? "Guardando..." : "Guardar evento"}
        </button>
      </div>
    </form>
  );
}

export default function AdminEventos() {
  const { eventos, cargando, ahora } = useEventos();
  const [editando, setEditando] = useState(null); // null | "nuevo" | evento
  const [error, setError] = useState("");

  const eliminar = async (e) => {
    if (!window.confirm(`¿Eliminar el evento "${e.nombre}"? Los jugadores dejarán de verlo.`)) return;
    setError("");
    try {
      await eliminarEventoCallable({ id: e.id });
    } catch (err) {
      console.error(err);
      setError(err.message || "No se pudo eliminar el evento.");
    }
  };

  if (editando) {
    return (
      <FormularioEvento
        inicial={editando === "nuevo" ? { id: null, nombre: "", descripcion: "", inicio: "", fin: "", misiones: [nuevaMision()] } : desdeEvento(editando)}
        onCancelar={() => setEditando(null)}
        onGuardado={() => setEditando(null)}
      />
    );
  }

  return (
    <section>
      <div className="ad-section-head">
        <h2 className="ad-h2">Eventos temporales</h2>
        <button type="button" className="ad-btn ad-btn--primary" onClick={() => setEditando("nuevo")}>
          + Nuevo evento
        </button>
      </div>

      {error && <p className="ad-error">{error}</p>}
      {cargando && <p className="ad-muted">Cargando...</p>}
      {!cargando && eventos.length === 0 && <p className="ad-muted">Aún no hay eventos. Crea el primero.</p>}

      <div className="ad-list">
        {eventos.map((e) => {
          const estado = estadoEvento(e, ahora);
          return (
            <article key={e.id} className="ad-card">
              <div className="ad-card-top">
                <div>
                  <h3 className="ad-h3">{e.nombre}</h3>
                  <span className="ad-muted">
                    {formatoFecha(e.inicio)} → {formatoFecha(e.fin)}
                  </span>
                </div>
                <span className={`ad-badge ad-badge--${estado}`}>{ETIQUETA_ESTADO[estado]}</span>
              </div>
              <ul className="ad-misiones-lista">
                {e.misiones.map((m) => (
                  <li key={m.id}>
                    {m.descripcion}
                    <span className="ad-muted">
                      {" "}— {m.recompensa?.coronas || 0} coronas
                      {m.recompensa?.cosmetico && ` + ${ETIQUETA_COSMETICO[m.recompensa.cosmetico.tipo]}: ${nombreCosmetico(m.recompensa.cosmetico)}`}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="ad-actions">
                <button type="button" className="ad-btn ad-btn--ghost ad-btn--sm" onClick={() => setEditando(e)}>Editar</button>
                <button type="button" className="ad-btn ad-btn--danger ad-btn--sm" onClick={() => eliminar(e)}>Eliminar</button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}