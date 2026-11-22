import { useUserProfile } from "../../hooks/useUserProfile";

export default function MisionesPage() {
  const { profile, loading } = useUserProfile();

  if (loading) return <p>Cargando...</p>;
  if (!profile) return <p>No se encontró tu perfil.</p>;

  const misiones = profile.misionesDiarias?.lista || [];

  return (
    <div style={{ padding: "20px" }}>
      <h2>Misiones Diarias</h2>
      {misiones.length === 0 && <p>Aún no tienes misiones asignadas hoy.</p>}
      {misiones.map((m) => (
        <div key={m.id} style={{ marginBottom: "12px", opacity: m.completada ? 0.6 : 1 }}>
          <p>{m.descripcion}{m.completada && " (completada)"}</p>
          <progress value={m.progreso} max={m.objetivo} style={{ width: "100%" }} />
          <small>{m.progreso} / {m.objetivo} — recompensa: <i className="fa-solid fa-crown" aria-hidden="true" style={{ color: "#ffd166" }} /> {m.recompensaCoronas}</small>
        </div>
      ))}
    </div>
  );
}