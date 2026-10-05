import { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../../firebase/config";
import { useAuth } from "../../context/AuthContext";
import { useUserProfile } from "../../hooks/useUserProfile";
import { MARCOS, BANNERS, TITULOS, obtenerMarco, obtenerBanner } from "../../data/cosmeticos";
import UserBomb from "../../assets/UserBomb.png";
import Store from "./Store";

const comprarCosmeticoCallable = httpsCallable(functions, "comprarCosmetico");

const CATEGORIAS = [
  { id: "marco", label: "Marcos" },
  { id: "banner", label: "Banners" },
  { id: "titulo", label: "Títulos" },
];

// Solo los que tienen precio se venden en la Tienda ("Default" ya lo
// tiene todo mundo, "007" es exclusivo de Logros — ver cosmeticos.js).
const enVenta = (catalogo, categoria) =>
  Object.values(catalogo)
    .filter((c) => c.precio != null)
    .map((c) => ({
      id: c.id,
      category: categoria,
      name: c.nombre,
      rarity: c.rareza || "comun",
      image: c.imagen,
      holeRatio: c.holeRatio,
      price: c.precio,
    }));

const MARCOS_VENTA = enVenta(MARCOS, "marco");
const BANNERS_VENTA = enVenta(BANNERS, "banner");
const TITULOS_VENTA = TITULOS.map((t) => ({
  id: t.id, category: "titulo", name: t.id, rarity: t.rareza, price: t.precio,
}));

export default function TiendaPage({ onVolver }) {
  const { user } = useAuth();
  const { profile, loading } = useUserProfile();
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  if (loading) return <p>Cargando...</p>;
  if (!profile) return <p>No se encontró tu perfil.</p>;

  const marcosPropios = new Set(profile.marcosComprados || []);
  const bannersPropios = new Set(profile.bannersComprados || []);
  const titulosPropios = new Set(profile.titulosObtenidos || []);
  const marcoActivoId = obtenerMarco(profile.marcoActivo).id;
  const bannerActivoId = obtenerBanner(profile.bannerActivo).id;

  const items = [
    ...MARCOS_VENTA.map((i) => ({ ...i, owned: marcosPropios.has(i.id), equipped: marcoActivoId === i.id })),
    ...BANNERS_VENTA.map((i) => ({ ...i, owned: bannersPropios.has(i.id), equipped: bannerActivoId === i.id })),
    ...TITULOS_VENTA.map((i) => ({ ...i, owned: titulosPropios.has(i.id), equipped: (profile.tituloActivo || "") === i.id })),
  ];

  const comprar = async (item) => {
    if (busyId) return;
    setBusyId(item.id);
    setError("");
    try {
      await comprarCosmeticoCallable({ tipo: item.category, id: item.id });
    } catch (err) {
      console.error("Error al comprar cosmético:", err);
      setError(
        err.code === "functions/failed-precondition"
          ? "No tienes suficientes coronas."
          : err.code === "functions/already-exists"
          ? "Ya tienes este cosmético."
          : "No se pudo completar la compra. Intenta de nuevo."
      );
    } finally {
      setBusyId(null);
    }
  };

  const equipar = async (item) => {
    if (busyId) return;
    setBusyId(item.id);
    setError("");
    try {
      const campo = item.category === "marco" ? "marcoActivo" : item.category === "banner" ? "bannerActivo" : "tituloActivo";
      await updateDoc(doc(db, "usuarios", user.uid), { [campo]: item.id });
    } catch (err) {
      console.error("Error al equipar cosmético:", err);
      setError("No se pudo guardar el cambio. Intenta de nuevo.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Store
      coins={profile.coronas || 0}
      items={items}
      categories={CATEGORIAS}
      avatar={profile.fotoPerfil || UserBomb}
      username={profile.username || "Tú"}
      error={error}
      busyId={busyId}
      onBuy={comprar}
      onEquip={equipar}
      onBack={onVolver}
    />
  );
}