import { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase/config";
import { useAuth } from "../../context/AuthContext";
import { useUserProfile } from "../../hooks/useUserProfile";
import { obtenerMarco, obtenerBanner } from "../../data/cosmeticos";
import "./InventarioPage.css";

const PESTANAS = [
  { id: "marcos", label: "Marcos" },
  { id: "banners", label: "Banners" },
  { id: "titulos", label: "Títulos" },
];

// Todavía no existe Tienda, así que el único marco/banner "de base" que
// todo mundo tiene es Default (obtenerMarco/obtenerBanner ya caen en
// Default si el id no se reconoce, incluido el valor histórico
// "marco_cadete"/"banner_default" que sigue poniendo perfilInicial.js).
// El resto (Metal, Nat, Electro, Dino) son de Tienda y todavía no se
// pueden tener; "007" es exclusivo de Logros.
const ID_MARCO_BASE = "Default";
const ID_BANNER_BASE = "Default";

export default function InventarioPage({ onVolver }) {
  const { user } = useAuth();
  const { profile, loading } = useUserProfile();
  const [pestana, setPestana] = useState("marcos");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  if (loading) return <p>Cargando...</p>;
  if (!profile) return <p>No se encontró tu perfil.</p>;

  const marcosPropios = [ID_MARCO_BASE, ...new Set(profile.marcosComprados || [])];
  const bannersPropios = [ID_BANNER_BASE, ...new Set(profile.bannersComprados || [])];
  const titulosPropios = ["", ...new Set(profile.titulosObtenidos || [])];

  // El valor guardado puede ser el id real del catálogo ("Default", "007")
  // o el valor histórico ("marco_cadete"/"banner_default") de cuentas
  // creadas antes de que existiera data/cosmeticos.js — para saber cuál
  // está equipado hay que normalizar ambos lados con la misma función.
  const marcoActivoId = obtenerMarco(profile.marcoActivo).id;
  const bannerActivoId = obtenerBanner(profile.bannerActivo).id;

  const equipar = async (campo, valor) => {
    if (guardando) return;
    setGuardando(true);
    setError("");
    try {
      await updateDoc(doc(db, "usuarios", user.uid), { [campo]: valor });
    } catch (err) {
      console.error("Error al equipar cosmético:", err);
      setError("No se pudo guardar el cambio. Intenta de nuevo.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="inventario-page">
      {onVolver && (
        <button className="inventario-volver" onClick={onVolver}>
          ← Volver al menú
        </button>
      )}

      <h2>Inventario</h2>
      {error && <p className="error-text">{error}</p>}

      <div className="inventario-pestanas">
        {PESTANAS.map((p) => (
          <button
            key={p.id}
            className={`inventario-pestana ${pestana === p.id ? "activa" : ""}`}
            onClick={() => setPestana(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {pestana === "marcos" && (
        <div className="inventario-grid">
          {marcosPropios.map((id) => {
            const marco = obtenerMarco(id);
            const activo = marcoActivoId === marco.id;
            return (
              <div key={id} className={`inventario-item ${activo ? "inventario-item-activo" : ""}`}>
                <img src={marco.imagen} alt={marco.nombre} className="inventario-marco-preview" />
                <p className="inventario-item-nombre">{marco.nombre}</p>
                <button onClick={() => equipar("marcoActivo", marco.id)} disabled={activo || guardando}>
                  {activo ? "Equipado ✓" : "Equipar"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {pestana === "banners" && (
        <div className="inventario-grid">
          {bannersPropios.map((id) => {
            const banner = obtenerBanner(id);
            const activo = bannerActivoId === banner.id;
            return (
              <div key={id} className={`inventario-item ${activo ? "inventario-item-activo" : ""}`}>
                <div
                  className="inventario-banner-preview"
                  style={{ backgroundImage: `url(${banner.imagen})` }}
                />
                <p className="inventario-item-nombre">{banner.nombre}</p>
                <button onClick={() => equipar("bannerActivo", banner.id)} disabled={activo || guardando}>
                  {activo ? "Equipado ✓" : "Equipar"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {pestana === "titulos" && (
        <div className="inventario-grid">
          {titulosPropios.map((titulo) => {
            const activo = (profile.tituloActivo || "") === titulo;
            return (
              <div key={titulo || "ninguno"} className={`inventario-item ${activo ? "inventario-item-activo" : ""}`}>
                <p className="inventario-titulo-preview">{titulo || "Ninguno"}</p>
                <button onClick={() => equipar("tituloActivo", titulo)} disabled={activo || guardando}>
                  {activo ? "Equipado ✓" : "Equipar"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}