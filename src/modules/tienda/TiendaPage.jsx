import { useCallback, useEffect, useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../../firebase/config";
import { useAuth } from "../../context/AuthContext";
import { useUserProfile } from "../../hooks/useUserProfile";
import { MARCOS, BANNERS, TITULOS, obtenerMarco, obtenerBanner } from "../../data/cosmeticos";
import UserBomb from "../../assets/UserBomb.png";
import Store from "./Store";

const comprarCosmeticoCallable = httpsCallable(functions, "comprarCosmetico");
const obtenerCatalogoCallable = httpsCallable(functions, "obtenerCatalogoTienda");

const CATEGORIAS = [
  { id: "marco", label: "Marcos" },
  { id: "banner", label: "Banners" },
  { id: "titulo", label: "Títulos" },
];

const ESTILO_ESTADO = { padding: 32, textAlign: "center", color: "#9a9aab", fontWeight: 700 };

function aItemDeTienda({ tipo, id, precio }) {
  if (tipo === "marco" || tipo === "banner") {
    const c = (tipo === "marco" ? MARCOS : BANNERS)[id];
    if (!c) return null;
    return { id, category: tipo, name: c.nombre, rarity: c.rareza || "comun", image: c.imagen, holeRatio: c.holeRatio, price: precio };
  }
  if (tipo === "titulo") {
    const t = TITULOS.find((x) => x.id === id);
    return { id, category: "titulo", name: id, rarity: t?.rareza || "comun", price: precio };
  }
  return null;
}

export default function TiendaPage({ onVolver }) {
  const { user } = useAuth();
  const { profile, loading } = useUserProfile();
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [catalogo, setCatalogo] = useState(null); // null = cargando
  const [errorCatalogo, setErrorCatalogo] = useState("");

  const pedirCatalogo = useCallback(
    () =>
      obtenerCatalogoCallable()
        .then((res) => {
          setCatalogo((res.data?.catalogo || []).map(aItemDeTienda).filter(Boolean));
          setErrorCatalogo("");
        })
        .catch((err) => {
          console.error("Error al cargar el catálogo de la tienda:", err);
          setErrorCatalogo("No se pudo cargar la tienda. Revisa tu conexión.");
        }),
    []
  );

  // Se pide cada vez que se abre la tienda.
  useEffect(() => {
    pedirCatalogo();
  }, [pedirCatalogo]);

  const reintentar = () => {
    setErrorCatalogo("");
    setCatalogo(null);
    pedirCatalogo();
  };

  if (loading) return <p>Cargando...</p>;
  if (!profile) return <p>No se encontró tu perfil.</p>;
  if (errorCatalogo) {
    return (
      <div style={ESTILO_ESTADO}>
        <p>{errorCatalogo}</p>
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          <button type="button" onClick={reintentar}>Reintentar</button>
          <button type="button" onClick={onVolver}>Volver</button>
        </div>
      </div>
    );
  }
  if (!catalogo) return <p style={ESTILO_ESTADO}>Cargando tienda...</p>;

  const marcosPropios = new Set(profile.marcosComprados || []);
  const bannersPropios = new Set(profile.bannersComprados || []);
  const titulosPropios = new Set(profile.titulosObtenidos || []);
  const marcoActivoId = obtenerMarco(profile.marcoActivo).id;
  const bannerActivoId = obtenerBanner(profile.bannerActivo).id;

  const propios = { marco: marcosPropios, banner: bannersPropios, titulo: titulosPropios };
  const activo = { marco: marcoActivoId, banner: bannerActivoId, titulo: profile.tituloActivo || "" };
  const items = catalogo.map((i) => ({
    ...i,
    owned: propios[i.category].has(i.id),
    equipped: activo[i.category] === i.id,
  }));

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