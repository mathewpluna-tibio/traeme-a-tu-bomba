import { useMemo, useState } from "react";
import "./InventoryReact.css";

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

export const NINGUNO = "__ninguno__";

function ItemVisual({ item }) {
  if (item.category === "titulo") {
    return <span className="iv-title-chip">{item.name}</span>;
  }
  if (item.image) {
    return (
      <div
        className="iv-card-img"
        role="img"
        aria-label={item.name}
        style={{ backgroundImage: `url(${item.image})` }}
      />
    );
  }
  return null;
}

function ItemCard({ item, onOpen }) {
  return (
    <button
      className={`iv-card iv-card--${item.rarity}` + (item.equipped ? " iv-card--equipped" : "")}
      style={{ "--rarity-color": `var(--r-${item.rarity})` }}
      onClick={() => onOpen(item)}
    >
      <span className="iv-rarity-tag">{item.tag || RARITY_LABEL[item.rarity] || item.rarity}</span>
      <div className={`iv-card-visual iv-card-visual--${item.category}`}>
        <ItemVisual item={item} />
      </div>
      <span className="iv-card-name">{item.name}</span>
      <div className="iv-card-footer">
        {item.equipped ? (
          <span className="iv-equipped-pill">✓ Equipado</span>
        ) : (
          <span className="iv-equip-pill">Equipar</span>
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
        <div className="iv-preview-avatar-wrap">
          {item.image && <div className="iv-preview-frame" style={{ backgroundImage: `url(${item.image})` }} />}
          <img
            className="iv-preview-avatar"
            src={avatar}
            alt="Avatar"
            style={item.holeRatio ? { width: `${Math.round(item.holeRatio * 118)}%`, height: `${Math.round(item.holeRatio * 118)}%` } : undefined}
          />
        </div>
        <span className="iv-preview-username">{username}</span>
      </>
    );
  }
  if (item.category === "banner") {
    return (
      <>
        {item.image && <div className="iv-preview-banner" style={{ backgroundImage: `url(${item.image})` }} />}
        <span className="iv-preview-username">{username}</span>
      </>
    );
  }
  return (
    <>
      <span className="iv-preview-username">{username}</span>
      <span className="iv-preview-title-chip">{item.name}</span>
    </>
  );
}

/**
 * Inventory
 *
 * Inventario de cosméticos YA poseídos, SOLO frontend (no equipa nada
 * de verdad). Hermano de <Store /> — misma identidad visual, sin precios.
 * Cubre:
 *  - RQF-PERS-01: inventario privado del jugador (manda solo lo que ya tiene).
 *  - RQF-PERS-02: filtrar por categoría (Marcos, Banners, Títulos).
 *  - RQF-PERS-03 / RQNF-PERS-03: vista previa antes de confirmar el equipado.
 *
 * 🔧 CÓMO CONECTARLO A TU BACKEND:
 *
 *   <Inventory
 *     items={[
 *       { id: "marco-naturaleza", category: "marco", name: "Naturaleza",
 *         rarity: "comun", image: "img/marco-naturaleza.png", equipped: true },
 *       { id: "titulo-novato", category: "titulo", name: "Bombardero Novato",
 *         rarity: "comun", equipped: false },
 *     ]}
 *     onEquip={(item) => equiparCosmetico(item.id)}
 *     onBack={() => navigate(-1)}
 *     onGoToStore={() => navigate("/tienda")}
 *   />
 *
 * Si tu backend permite un equipado por categoría, al equipar uno nuevo
 * desequipa el anterior ahí mismo; este componente solo refleja lo que
 * le pases en `items`.
 */
export default function Inventory({
  items = [],
  avatar = "",
  username = "Tú",
  error = "",
  guardando = false,
  onEquip = (item) => console.log("Equipar:", item.id),
  onBack = () => window.history.back(),
  onGoToStore,
}) {
  const [category, setCategory] = useState("marco");
  const [previewItem, setPreviewItem] = useState(null);

  const visibleItems = useMemo(() => items.filter((i) => i.category === category), [items, category]);

  const handleConfirm = async () => {
    if (!previewItem || previewItem.equipped || guardando) return;
    const item = previewItem;
    // RQNF-PERS-03: nada se aplicó hasta este momento — recién aquí avisamos al backend
    setPreviewItem(null);
    await onEquip(item);
  };

  return (
    <div className="iv-page">
      <div className="iv-glow iv-glow--1" />
      <div className="iv-glow iv-glow--2" />

      <div className="iv-container">
        <button type="button" className="iv-back" onClick={onBack}>
          ← Volver al menú
        </button>

        <header className="iv-header">
          <h1 className="iv-title">Inventario</h1>
          <p className="iv-subtitle">Equipa los cosméticos que ya conseguiste</p>
        </header>

        <nav className="iv-tabs">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              className={"iv-tab" + (category === c.id ? " iv-tab--active" : "")}
              onClick={() => setCategory(c.id)}
            >
              {c.label}
            </button>
          ))}
        </nav>

        {error && <p className="iv-error">{error}</p>}

        {visibleItems.length === 0 ? (
          <div className="iv-empty">
            <p className="iv-empty-title">Aún no tienes nada aquí</p>
            <p className="iv-empty-text">
              Consigue cosméticos en la Tienda o completando misiones y eventos.
            </p>
            {onGoToStore && (
              <button type="button" className="iv-btn iv-btn--primary" onClick={onGoToStore}>
                Ir a la Tienda
              </button>
            )}
          </div>
        ) : (
          <div className="iv-grid">
            {visibleItems.map((item) => (
              <ItemCard key={item.id} item={item} onOpen={setPreviewItem} />
            ))}
          </div>
        )}
      </div>

      {/* ===================== MODAL DE VISTA PREVIA (RQF-PERS-03) ===================== */}
      {previewItem && (
        <div className="iv-modal-backdrop" onClick={(e) => e.target === e.currentTarget && setPreviewItem(null)}>
          <div className="iv-modal">
            <button className="iv-modal-close" onClick={() => setPreviewItem(null)} aria-label="Cerrar">
              ✕
            </button>
            <h2 className="iv-modal-title">Vista previa</h2>

            <div className="iv-preview">
              <PreviewMockup item={previewItem} avatar={avatar} username={username} />
            </div>

            <div className="iv-modal-info">
              <span className="iv-modal-name">{previewItem.name}</span>
              <span className="iv-rarity-badge">{previewItem.tag || RARITY_LABEL[previewItem.rarity] || previewItem.rarity}</span>
            </div>

            <div className="iv-modal-actions">
              <button className="iv-btn iv-btn--secondary" onClick={() => setPreviewItem(null)}>
                Cancelar
              </button>
              <button className="iv-btn iv-btn--primary" onClick={handleConfirm} disabled={previewItem.equipped || guardando}>
                {previewItem.equipped ? "Equipado" : "Equipar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}