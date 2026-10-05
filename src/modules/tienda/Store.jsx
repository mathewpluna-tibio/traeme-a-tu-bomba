import { useMemo, useState } from "react";
import "./StoreReact.css";

const RARITY_LABEL = {
  comun: "Común",
  raro: "Raro",
  epico: "Épico",
  legendario: "Legendario",
};

const CATEGORIES = [
  { id: "marco", label: "Marcos" },
  { id: "banner", label: "Banners" },
  { id: "titulo", label: "Títulos" },
];

// Imagen del ítem o emoji de respaldo si no hay imagen / no carga
function ItemVisual({ item }) {
  if (item.category === "titulo") {
    return <span className="st-title-chip">{item.name}</span>;
  }
  if (item.image) {
    return (
      <div
        className="st-card-img"
        role="img"
        aria-label={item.name}
        style={{ backgroundImage: `url(${item.image})` }}
      />
    );
  }
  return null;
}

function ItemCard({ item, onOpen, busy }) {
  return (
    <button
      className={`st-card st-card--${item.rarity}`}
      style={{ "--rarity-color": `var(--r-${item.rarity})` }}
      onClick={() => onOpen(item)}
    >
      <span className="st-rarity-tag">{RARITY_LABEL[item.rarity] || item.rarity}</span>
      <div className={`st-card-visual st-card-visual--${item.category}`}>
        <ItemVisual item={item} />
      </div>
      <span className="st-card-name">{item.name}</span>
      <div className="st-card-footer">
        {item.equipped ? (
          <span className="st-equipped-pill">✓ Equipado</span>
        ) : item.owned ? (
          <span className="st-owned-pill">Equipar</span>
        ) : (
          <span className="st-price-pill">{busy ? "Comprando..." : (<><span className="st-coin-dot" />{item.price}</>)}</span>
        )}
      </div>
    </button>
  );
}

// Mini mockup de perfil donde se previsualiza el cosmético (RQF-PERS-03)
function PreviewMockup({ item, avatar, username }) {
  if (item.category === "marco") {
    return (
      <>
        <div className="st-preview-avatar-wrap">
          {item.image && <div className="st-preview-frame" style={{ backgroundImage: `url(${item.image})` }} />}
          <img
            className="st-preview-avatar"
            src={avatar}
            alt="Avatar"
            style={item.holeRatio ? { width: `${Math.round(item.holeRatio * 118)}%`, height: `${Math.round(item.holeRatio * 118)}%` } : undefined}
          />
        </div>
        <span className="st-preview-username">{username}</span>
      </>
    );
  }
  if (item.category === "banner") {
    return (
      <>
        {item.image && <div className="st-preview-banner" style={{ backgroundImage: `url(${item.image})` }} />}
        <span className="st-preview-username">{username}</span>
      </>
    );
  }
  return (
    <>
      <span className="st-preview-username">{username}</span>
      <span className="st-preview-title-chip">{item.name}</span>
    </>
  );
}

/**
 * Store
 *
 * Tienda de cosméticos, SOLO frontend (no cobra Coronas ni equipa nada
 * de verdad). Cubre:
 *  - RQF-PERS-02: filtrar por categoría (Marcos, Banners, Títulos).
 *  - RQF-PERS-03 / RQNF-PERS-03: vista previa sobre un mini-perfil antes
 *    de confirmar — nada se aplica hasta que el jugador confirma.
 *  - RQF-PERS-04: catálogo con precio en Coronas.
 *  - RQF-PERS-05: el botón cambia a "Equipar" / "Equipado" si ya se posee.
 *
 * Nota: el documento dice tanto "ocultar los ítems ya poseídos" como
 * "indicar como obtenido cualquier cosmético ya poseído en la tienda".
 * Este componente no decide por ti: solo pinta lo que traiga `items`.
 * Si quieres ocultarlos, no los incluyas en el arreglo que pasas.
 *
 * 🔧 CÓMO CONECTARLO A TU BACKEND:
 *
 *   <Store
 *     coins={72}
 *     items={[
 *       { id: "marco-metal", category: "marco", name: "Metal",
 *         rarity: "raro", image: "img/marco-metal.png",
 *         price: 100, owned: false, equipped: false },
 *       { id: "titulo-novato", category: "titulo", name: "Bombardero Novato",
 *         rarity: "comun", price: 50, owned: true, equipped: true },
 *     ]}
 *     onBuy={(item) => comprarCosmetico(item.id)}
 *     onEquip={(item) => equiparCosmetico(item.id)}
 *     onBack={() => navigate(-1)}
 *   />
 */
export default function Store({
  coins = 0,
  items = [],
  categories = CATEGORIES,
  avatar = "",
  username = "Tú",
  error = "",
  busyId = null,
  onBuy = (item) => console.log("Comprar:", item.id),
  onEquip = (item) => console.log("Equipar:", item.id),
  onBack = () => window.history.back(),
}) {
  const [category, setCategory] = useState(categories[0]?.id || "marco");
  const [previewItem, setPreviewItem] = useState(null);

  const visibleItems = useMemo(() => items.filter((i) => i.category === category), [items, category]);

  const handleConfirm = async () => {
    if (!previewItem || busyId) return;
    const item = previewItem;
    // RQNF-PERS-03: nada se aplicó hasta este momento — recién aquí avisamos al backend
    setPreviewItem(null);
    if (item.owned) await onEquip(item);
    else await onBuy(item);
  };

  const confirmLabel = !previewItem
    ? ""
    : previewItem.equipped
    ? "Equipado"
    : previewItem.owned
    ? "Equipar"
    : `Comprar por ${previewItem.price} coronas`;

  const confirmDisabled =
    !!busyId || !!previewItem?.equipped || (!previewItem?.owned && coins < (previewItem?.price ?? 0));

  return (
    <div className="st-page">
      <div className="st-glow st-glow--1" />
      <div className="st-glow st-glow--2" />

      <div className="st-container">
        <button type="button" className="st-back" onClick={onBack}>
          ← Volver al menú
        </button>

        <header className="st-header">
          <div>
            <h1 className="st-title">Tienda</h1>
            <p className="st-subtitle">Personaliza tu perfil con marcos, banners y títulos</p>
          </div>
          <div className="st-coins">
            <span className="st-coin-dot" />
            <span className="st-coin-amount">{coins}</span>
          </div>
        </header>

        <nav className="st-tabs">
          {categories.map((c) => (
            <button
              key={c.id}
              className={"st-tab" + (category === c.id ? " st-tab--active" : "")}
              onClick={() => setCategory(c.id)}
            >
              {c.label}
            </button>
          ))}
        </nav>

        {error && <p className="st-error">{error}</p>}

        {visibleItems.length === 0 ? (
          <p className="st-empty">Aún no hay cosméticos en esta categoría.</p>
        ) : (
          <div className="st-grid">
            {visibleItems.map((item) => (
              <ItemCard key={item.id} item={item} onOpen={setPreviewItem} busy={busyId === item.id} />
            ))}
          </div>
        )}
      </div>

      {/* ===================== MODAL DE VISTA PREVIA (RQF-PERS-03) ===================== */}
      {previewItem && (
        <div className="st-modal-backdrop" onClick={(e) => e.target === e.currentTarget && setPreviewItem(null)}>
          <div className="st-modal">
            <button className="st-modal-close" onClick={() => setPreviewItem(null)} aria-label="Cerrar">
              ✕
            </button>
            <h2 className="st-modal-title">Vista previa</h2>

            <div className="st-preview">
              <PreviewMockup item={previewItem} avatar={avatar} username={username} />
            </div>

            <div className="st-modal-info">
              <span className="st-modal-name">{previewItem.name}</span>
              <span className="st-rarity-badge">{RARITY_LABEL[previewItem.rarity] || previewItem.rarity}</span>
            </div>

            <div className="st-modal-actions">
              <button className="st-btn st-btn--secondary" onClick={() => setPreviewItem(null)}>
                Cancelar
              </button>
              <button className="st-btn st-btn--primary" onClick={handleConfirm} disabled={confirmDisabled}>
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}