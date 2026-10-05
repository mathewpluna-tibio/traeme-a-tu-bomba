import { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase/config";
import { useAuth } from "../../context/AuthContext";
import { useUserProfile } from "../../hooks/useUserProfile";
import { obtenerMarco, obtenerBanner, TITULOS, tituloVisible } from "../../data/cosmeticos";
import UserBomb from "../../assets/UserBomb.png";
import Inventory, { NINGUNO } from "./Inventory";

// "Default" lo tiene todo mundo. Los marcos/banners comprados o ganados
// (p. ej. "007" por logro) vienen en marcosComprados / bannersComprados.
const ID_BASE = "Default";

export default function InventarioPage({ onVolver, onIrATienda }) {
  const { user } = useAuth();
  const { profile, loading } = useUserProfile();
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  if (loading) return <p>Cargando...</p>;
  if (!profile) return <p>No se encontró tu perfil.</p>;

  // El valor guardado puede ser el id real del catálogo o el histórico
  // ("marco_cadete"/"banner_default"): se normaliza con obtenerMarco/Banner.
  const marcoActivoId = obtenerMarco(profile.marcoActivo).id;
  const bannerActivoId = obtenerBanner(profile.bannerActivo).id;
  const tituloActivo = profile.tituloActivo || "";

  const marcos = [ID_BASE, ...new Set(profile.marcosComprados || [])].map((id) => {
    const m = obtenerMarco(id);
    return { id: m.id, category: "marco", name: m.nombre, rarity: m.rareza || "comun", image: m.imagen, holeRatio: m.holeRatio, equipped: marcoActivoId === m.id };
  });
  const banners = [ID_BASE, ...new Set(profile.bannersComprados || [])].map((id) => {
    const b = obtenerBanner(id);
    return { id: b.id, category: "banner", name: b.nombre, rarity: b.rareza || "comun", image: b.imagen, equipped: bannerActivoId === b.id };
  });
  // Título por defecto = rango actual (cambia solo al subir de rango)
  const rareza = (t) => TITULOS.find((x) => x.id === t)?.rareza || "comun";
  const titulos = [
    { id: NINGUNO, category: "titulo", name: tituloVisible({ estadisticas: profile.estadisticas }), tag: "Rango", rarity: "comun", valor: "", equipped: tituloActivo === "" },
    ...[...new Set(profile.titulosObtenidos || [])].map((t) => ({
      id: t, category: "titulo", name: t, rarity: rareza(t), valor: t, equipped: tituloActivo === t,
    })),
  ];

  const equipar = async (item) => {
    if (guardando) return;
    setGuardando(true);
    setError("");
    try {
      const campo = item.category === "marco" ? "marcoActivo" : item.category === "banner" ? "bannerActivo" : "tituloActivo";
      await updateDoc(doc(db, "usuarios", user.uid), { [campo]: item.valor ?? item.id });
    } catch (err) {
      console.error("Error al equipar cosmético:", err);
      setError("No se pudo guardar el cambio. Intenta de nuevo.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Inventory
      items={[...marcos, ...banners, ...titulos]}
      avatar={profile.fotoPerfil || UserBomb}
      username={profile.username || "Tú"}
      error={error}
      guardando={guardando}
      onEquip={equipar}
      onBack={onVolver}
      onGoToStore={onIrATienda}
    />
  );
}