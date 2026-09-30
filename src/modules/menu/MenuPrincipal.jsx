import { useState, useEffect } from "react";
import { useMachine } from "@xstate/react";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "../../firebase/config";
import { useAuth } from "../../context/AuthContext";
import { useUserProfile } from "../../hooks/useUserProfile";
import { unirseACola, salirDeCola, refrescarEnCola } from "./matchmaking";
import { useNotificacionPartida } from "../../hooks/useNotificacionPartida";
import { menuMachine } from "./menuMachine";
import SeleccionModalidad from "./SeleccionModalidad";
import SeleccionClase from "./SeleccionClase";
import PartidaScreen from "../gameplay/PartidaScreen";
import RankingsPage from "../rankings/RankingsPage";
import PerfilPage from "../perfil/PerfilPage";
import MisionesPage from "../misiones/MisionesPage";
import LogrosPage from "../logros/LogrosPage";
import logo from "../../assets/Logo_TATomba.png";
import UserBomb from "../../assets/UserBomb.png"
import "./MenuPrincipal.css";
import "./GameMenu.css";

const NAV_ITEMS = [
  { id: "buscar", label: "Jugar", icon: "🎮" },
  { id: "tienda", label: "Tienda", icon: "🛒" },
  { id: "inventario", label: "Inventario", icon: "📦" },
  { id: "ranking", label: "Ranking", icon: "🏆" },
  { id: "logros", label: "Logros", icon: "🎖️" },
  { id: "evento", label: "Evento", icon: "📅" },
];

export default function MenuPrincipal() {
  const { user, cerrarSesion } = useAuth();
  const { profile } = useUserProfile();
  const { partidaId, limpiarNotificacion } = useNotificacionPartida();
  const [state, send] = useMachine(menuMachine);
  const [navActivo, setNavActivo] = useState("buscar");

  const [pantallaActiva, setPantallaActiva] = useState("jugar");
  const [perfilUidObjetivo, setPerfilUidObjetivo] = useState(null);

  useEffect(() => {
    if (partidaId) {
      send({ type: "PARTIDA_ENCONTRADA", partidaId });
    }
  }, [partidaId, send]);

  // Ping periódico mientras se busca partida (mantiene viva la
  // re-evaluación de tolerancia de Elo, RQF-COM-02)
  useEffect(() => {
    if (!state.matches("buscando") || state.context.tipoAccion !== "buscar") return;
    const intervalo = setInterval(() => {
      refrescarEnCola(state.context.modalidad, user.uid);
    }, 4000);
    return () => clearInterval(intervalo);
  }, [state, user.uid]);

  const iniciarFlujo = (accion) => {
    send({ type: "INICIAR_FLUJO", accion });
  };

  const onModalidadSeleccionada = async (modalidad) => {
    if (modalidad === "estandar") {
      send({ type: "SELECCIONAR_MODALIDAD_ESTANDAR" });
    } else {
      if (state.context.tipoAccion === "buscar") {
        await unirseACola(modalidad, user.uid, null, user.isAnonymous);
      }
      send({ type: "SELECCIONAR_MODALIDAD_OTRA", modalidad });
    }
  };

  const onClaseConfirmada = () => {
    send({ type: "CLASE_CONFIRMADA" });
  };

  const cancelarFlujo = () => {
    send({ type: "CANCELAR" });
  };

  const cancelarBusqueda = async () => {
    if (state.context.modalidad) {
      await salirDeCola(state.context.modalidad, user.uid);
    }
    send({ type: "CANCELAR_BUSQUEDA" });
  };

  const volverAlMenuDesdePartida = async () => {
    await limpiarNotificacion();
    send({ type: "VOLVER_AL_MENU" });
  };

  const jugarDeNuevo = async () => {
    await limpiarNotificacion();
    const prefRef = doc(db, "preferencias", user.uid);
    const prefSnap = await getDoc(prefRef);
    const ultimaModalidad = prefSnap.exists() ? prefSnap.data().ultimaModalidad : "estandar";
    const ultimaClase = prefSnap.exists() ? prefSnap.data().ultimaClase : "aleatoria";
    await unirseACola(ultimaModalidad, user.uid, ultimaClase, user.isAnonymous);
    send({ type: "JUGAR_DE_NUEVO", modalidad: ultimaModalidad });
  };

 const volverAJugar = () => {
  setPantallaActiva("jugar");
  setNavActivo("buscar");
  };

  const irAPerfilDe = (uid) => {
    setPerfilUidObjetivo(uid);
    setPantallaActiva("perfil");
  };

  const manejarNav = (id) => {
    setNavActivo(id);
    if (id === "buscar") {
      setPantallaActiva("jugar");
    } else if (id === "ranking") {
      setPantallaActiva("ranking");
    } else if (id === "logros") {
      setPantallaActiva("logros");
    }
  };

  if (state.matches("en_partida")) {
    return (
      <PartidaScreen
        partidaId={state.context.partidaId}
        onVolverAlMenu={volverAlMenuDesdePartida}
        onJugarDeNuevo={jugarDeNuevo}
      />
    );
  }

  if (state.matches("modalidad")) {
    return <SeleccionModalidad onSeleccionar={onModalidadSeleccionada} onCancelar={cancelarFlujo} />;
  }

  if (state.matches("clase")) {
    return (
      <SeleccionClase
        tipoAccion={state.context.tipoAccion}
        modalidad={state.context.modalidad}
        onConfirmar={onClaseConfirmada}
        onCancelar={cancelarFlujo}
      />
    );
  }

  if (state.matches("buscando")) {
    return (
      <div>
        <p>Buscando partida en modalidad: {state.context.modalidad}...</p>
        <button onClick={cancelarBusqueda}>Cancelar búsqueda</button>
      </div>
    );
  }

  // --- Pantalla principal (diseño de GameMenu fusionado) ---
  const misiones = (profile?.misionesDiarias?.lista || []).map((m, index) => ({
    id: m.id || index,
    icon: m.completada ? "✅" : "🎯",
    title: m.descripcion,
    progress: `${m.progreso}/${m.objetivo}`,
  }));

  return (
  <div className="gm-app">
    {/* ===================== SIDEBAR IZQUIERDA (siempre visible) ===================== */}
    <aside className="gm-sidebar gm-sidebar--left">
      <nav className="gm-nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={
              "gm-nav-item" +
              (item.id === navActivo ? " gm-nav-item--active" : "") +
              (item.id === "buscar" ? " gm-nav-item--jugar" : "")
            }
            onClick={() => manejarNav(item.id)}
          >
            <span className="gm-nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="gm-sidebar-footer">
        <div className="gm-footer-icons">
          <button className="gm-icon-btn" aria-label="Configuración">⚙️</button>
          <button className="gm-icon-btn" aria-label="Ayuda">❓</button>
        </div>

        <div
          className="gm-profile-card"
          onClick={() => { setPerfilUidObjetivo(null); setPantallaActiva("perfil"); }}
          style={{ cursor: "pointer" }}
        >
          <img
            className="gm-profile-avatar"
            src={profile?.fotoPerfil || UserBomb}
            alt={`Avatar de ${profile?.username || "jugador"}`}
          />
          <div className="gm-profile-info">
            <span className="gm-profile-name">{profile?.username || user?.email}</span>
            <span className="gm-profile-level">
              {profile?.estadisticas?.estandar?.rango || "Cadetes Bomberos"}
            </span>
          </div>
        </div>
      </div>
    </aside>

    {/* ===================== CONTENIDO CENTRAL (cambia según pantallaActiva) ===================== */}
    {pantallaActiva === "jugar" && (
      <main className="gm-main-panel">
        <div className="gm-main-content">
          <img className="gm-game-logo" src={logo} alt="Traeme a tu bomba" />

          <div className="gm-action-buttons">
            <button className="gm-btn gm-btn--primary" onClick={() => iniciarFlujo("buscar")}>
              <span className="gm-btn-icon">⚔️</span>
              Buscar partida
            </button>
            <button className="gm-btn gm-btn--secondary" onClick={() => iniciarFlujo("lobby")}>
              <span className="gm-btn-icon">🔒</span>
              Lobby privado
            </button>
          </div>

          <button onClick={cerrarSesion} style={{ marginTop: "16px", opacity: 0.7, background: "none", border: "none", color: "inherit", cursor: "pointer" }}>
            Cerrar sesión
          </button>
        </div>
      </main>
    )}

    {pantallaActiva === "ranking" && (
      <div className="gm-content-full">
        <RankingsPage onVolver={volverAJugar} onVerPerfil={irAPerfilDe} />
      </div>
    )}

    {pantallaActiva === "perfil" && (
      <div className="gm-content-full">
        <PerfilPage onVolver={volverAJugar} uidObjetivo={perfilUidObjetivo} />
      </div>
    )}

    {pantallaActiva === "misiones" && (
      <div className="gm-content-full">
        <MisionesPage onVolver={volverAJugar} />
      </div>
    )}

    {pantallaActiva === "logros" && (
      <div className="gm-content-full">
        <LogrosPage onVolver={volverAJugar} />
      </div>
    )}

    {/* ===================== SIDEBAR DERECHA (siempre visible, en toda vista) ===================== */}
    <aside className="gm-sidebar gm-sidebar--right">
      <section className="gm-panel">
        <header className="gm-panel-header">
          <h2 className="gm-panel-title">
            <span className="gm-panel-icon">🎯</span>
            Misiones diarias
          </h2>
          <span className="gm-panel-timer">🕐 --</span>
        </header>

        <ul className="gm-mission-list">
          {misiones.length === 0 && <li className="gm-mission">Sin misiones disponibles aún.</li>}
          {misiones.map((mission) => (
            <li className="gm-mission" key={mission.id}>
              <span className="gm-mission-icon">{mission.icon}</span>
              <div className="gm-mission-info">
                <span className="gm-mission-title">{mission.title}</span>
                <span className="gm-mission-subtitle">Misión Diaria</span>
              </div>
              <span className="gm-mission-progress">{mission.progress}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="gm-panel">
        <header className="gm-panel-header">
          <h2 className="gm-panel-title">
            <span className="gm-panel-icon">📅</span>
            Evento especial
          </h2>
        </header>

        <div className="gm-empty-event">
          <span className="gm-empty-event-icon">🗓️</span>
          <p className="gm-empty-event-title">No existe un evento activo</p>
          <p className="gm-empty-event-text">
            No existe un evento en este momento.
            <br />
            ¡Vuelve más tarde para unirte al caos de las bombas!
          </p>
        </div>
      </section>
    </aside>
  </div>
);
}