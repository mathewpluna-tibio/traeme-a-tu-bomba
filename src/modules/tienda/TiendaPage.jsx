import { useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../firebase/config";
import { useUserProfile } from "../../hooks/useUserProfile";
import { MARCOS, BANNERS } from "../../data/cosmeticos";
import "./TiendaPage.css";

const comprarCosmeticoCallable = httpsCallable(functions, "comprarCosmetico");

const PESTANAS = [
  { id: "marcos", label: "Marcos" },
  { id: "banners", label: "Banners" },
];

// Solo los que tienen precio se venden en la Tienda ("Default" ya lo
// tiene todo mundo, "007" es exclusivo de Logros — ver cosmeticos.js).
const marcosEnVenta = Object.values(MARCOS).filter((m) => m.precio != null);
const bannersEnVenta = Object.values(BANNERS).filter((b) => b.precio != null);

export default function TiendaPage({ onVolver }) {
  const { profile, loading } = useUserProfile();
  const [pestana, setPestana] = useState("marcos");
  const [comprandoId, setComprandoId] = useState(null);
  const [error, setError] = useState("");

  if (loading) return <p>Cargando...</p>;
  if (!profile) return <p>No se encontró tu perfil.</p>;

  const coronas = profile.coronas || 0;
  const marcosPropios = new Set(profile.marcosComprados || []);
  const bannersPropios = new Set(profile.bannersComprados || []);

  const comprar = async (tipo, item) => {
    if (comprandoId) return;
    setComprandoId(item.id);
    setError("");
    try {
      await comprarCosmeticoCallable({ tipo, id: item.id });
    } catch (err) {
      console.error("Error al comprar cosmético:", err);
      const mensaje =
        err.code === "functions/failed-precondition"
          ? "No tienes suficientes coronas."
          : err.code === "functions/already-exists"
          ? "Ya tienes este cosmético."
          : "No se pudo completar la compra. Intenta de nuevo.";
      setError(mensaje);
    } finally {
      setComprandoId(null);
    }
  };

  const itemsActuales = pestana === "marcos" ? marcosEnVenta : bannersEnVenta;
  const propios = pestana === "marcos" ? marcosPropios : bannersPropios;
  const tipoActual = pestana === "marcos" ? "marco" : "banner";
  const previewClase = pestana === "marcos" ? "tienda-marco-preview" : "tienda-banner-preview";

  return (
    <div className="tienda-page">
      {onVolver && (
        <button className="tienda-volver" onClick={onVolver}>
          ← Volver al menú
        </button>
      )}

      <div className="tienda-encabezado">
        <h2>Tienda</h2>
        <div className="tienda-coronas">🪙 {coronas}</div>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="tienda-pestanas">
        {PESTANAS.map((p) => (
          <button
            key={p.id}
            className={`tienda-pestana ${pestana === p.id ? "activa" : ""}`}
            onClick={() => setPestana(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="tienda-grid">
        {itemsActuales.map((item) => {
          const yaComprado = propios.has(item.id);
          const alcanza = coronas >= item.precio;
          const comprandoEste = comprandoId === item.id;

          return (
            <div key={item.id} className={`tienda-item ${yaComprado ? "tienda-item-poseido" : ""}`}>
              {pestana === "marcos" ? (
                <img src={item.imagen} alt={item.nombre} className={previewClase} />
              ) : (
                <div className={previewClase} style={{ backgroundImage: `url(${item.imagen})` }} />
              )}
              <p className="tienda-item-nombre">{item.nombre}</p>

              {yaComprado ? (
                <span className="tienda-item-poseido-texto">Ya lo tienes</span>
              ) : (
                <button
                  className="tienda-item-comprar"
                  onClick={() => comprar(tipoActual, item)}
                  disabled={!alcanza || comprandoEste}
                >
                  {comprandoEste ? "Comprando..." : `🪙 ${item.precio}`}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}