import { useState, useEffect } from "react";
import { useMachine } from "@xstate/react";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../../firebase/config";
import { useAuth } from "../../context/AuthContext";
import { useUserProfile } from "../../hooks/useUserProfile";
import { unirseACola, salirDeCola, refrescarEnCola } from "./matchmaking";
import { useNotificacionPartida } from "../../hooks/useNotificacionPartida";
import { menuMachine } from "./menuMachine";
import SeleccionModalidad from "./SeleccionModalidad";
import SeleccionClase from "./SeleccionClase";
import BuscandoPartida from "./BuscandoPartida";
import PartidaScreen from "../gameplay/PartidaScreen";
import RankingsPage from "../rankings/RankingsPage";
import PerfilPage from "../perfil/PerfilPage";
import MisionesPage from "../misiones/MisionesPage";
import LogrosPage from "../logros/LogrosPage";
import InventarioPage from "../inventario/InventarioPage";
import TiendaPage from "../tienda/TiendaPage";
import AmigosPage from "../amigos/AmigosPage";
import LobbyEspera from "../lobby/LobbyEspera";
import LobbyEntrante from "../lobby/LobbyEntrante";
import InvitacionesRetos from "../lobby/InvitacionesRetos";
import { useSolicitudesPendientes } from "../../hooks/useAmigos";
import logo from "../../assets/Logo_TATomba.png";
import UserBomb from "../../assets/UserBomb.png"
import "./MenuPrincipal.css";
import "./GameMenu.css";

const crearLobbyCallable = httpsCallable(functions, "crearLobby");

const NAV_ITEMS = [
  { id: "buscar", label: "Jugar", icon: "🎮" },
  { id: "tienda", label: "Tienda", icon: "🛒" },
  { id: "inventario", label: "Inventario", icon: "📦" },
  { id: "amigos", label: "Amigos", icon: "👥" },
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
  const solicitudes = useSolicitudesPendientes(user?.uid);

  // RQF-MEN-06: quien entra por el enlace ?lobby=<id> cae directo al lobby.
  const [lobbyEntrante, setLobbyEntrante] = useState(() =>
    new URLSearchParams(window.location.search).get("lobby")
  );
  const cerrarLobbyEntrante = () => {
    setLobbyEntrante(null);
    window.history.replaceState({}, "", window.location.pathname);
  };

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
    } else if (state.context.tipoAccion === "lobby") {
      try {
        const resultado = await crearLobbyCallable({
          modalidad,
          uidRetado: state.context.retadoUid || null,
        });
        send({ type: "SELECCIONAR_MODALIDAD_OTRA", modalidad, lobbyId: resultado.data.lobbyId });
      } catch (err) {
        console.error("Error al crear lobby:", err);
        alert(err.message || "No se pudo crear el lobby.");
        send({ type: "CANCELAR" });
      }
    } else {
      if (state.context.tipoAccion === "buscar") {
        await unirseACola(modalidad, user.uid, null, user.isAnonymous);
      }
      send({ type: "SELECCIONAR_MODALIDAD_OTRA", modalidad });
    }
  };

  const onClaseConfirmada = (claseId, lobbyId) => {
    send({ type: "CLASE_CONFIRMADA", lobbyId, clase: claseId });
  };

  // Revancha en partida privada: nuevo lobby dirigido al mismo rival
  const revancha = async (uidRival, modalidad, clase) => {
    const resultado = await crearLobbyCallable({
      modalidad,
      clase: modalidad === "estandar" ? clase : null,
      uidRetado: uidRival,
    });
    await limpiarNotificacion();
    send({ type: "REVANCHA", modalidad, clase: modalidad === "estandar" ? clase : null, lobbyId: resultado.data.lobbyId, uidRetado: uidRival });
  };

  // RQF-SOC-02: retar a otro jugador = crear un lobby privado dirigido a él
  const retarJugador = (uidRetado) => {
    send({ type: "INICIAR_FLUJO", accion: "lobby", uidRetado });
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
    send({ type: "JUGAR_DE_NUEVO", modalidad: ultimaModalidad, clase: ultimaModalidad === "estandar" ? ultimaClase : null });
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
    } else if (id === "inventario") {
      setPantallaActiva("inventario");
    } else if (id === "tienda") {
      setPantallaActiva("tienda");
    } else if (id === "amigos") {
      setPantallaActiva("amigos");
    }
  };

  if (state.matches("en_partida")) {
    return (
      <PartidaScreen
        partidaId={state.context.partidaId}
        onVolverAlMenu={volverAlMenuDesdePartida}
        onJugarDeNuevo={jugarDeNuevo}
        onRevancha={revancha}
        lobbyEntrante={lobbyEntrante}
        onAceptarReto={setLobbyEntrante}
        onCerrarLobbyEntrante={cerrarLobbyEntrante}
      />
    );
  }

  // Buscar partida / lobby ocupa toda la pantalla
  let modal = null;
  if (state.matches("modalidad")) {
    modal = <SeleccionModalidad tipoAccion={state.context.tipoAccion} onSeleccionar={onModalidadSeleccionada} onCancelar={cancelarFlujo} />;
  } else if (state.matches("clase")) {
    modal = (
      <SeleccionClase
        tipoAccion={state.context.tipoAccion}
        modalidad={state.context.modalidad}
        uidRetado={state.context.retadoUid}
        onConfirmar={onClaseConfirmada}
        onCancelar={cancelarFlujo}
        onAtras={() => send({ type: "ATRAS" })}
      />
    );
  } else if (state.matches("lobby_espera")) {
    modal = (
      <LobbyEspera
        lobbyId={state.context.lobbyId}
        esReto={!!state.context.retadoUid}
        modalidad={state.context.modalidad}
        clase={state.context.clase}
        onCancelar={() => send({ type: "CANCELAR_BUSQUEDA" })}
        onCerrado={() => {
          alert("El lobby se cerró (rechazaron el reto o fue cancelado).");
          send({ type: "CANCELAR_BUSQUEDA" });
        }}
      />
    );
  } else if (state.matches("buscando")) {
    modal = (
      <BuscandoPartida
        modalidad={state.context.modalidad}
        clase={state.context.clase}
        onCancelar={cancelarBusqueda}
      />
    );
  }

  if (modal) return modal;

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
            {item.id === "amigos" && solicitudes.length > 0 && (
              <span className="gm-nav-badge">{solicitudes.length}</span>
            )}
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
        <PerfilPage onVolver={volverAJugar} uidObjetivo={perfilUidObjetivo} onRetar={retarJugador} />
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

    {pantallaActiva === "inventario" && (
      <div className="gm-content-full">
        <InventarioPage onVolver={volverAJugar} onIrATienda={() => manejarNav("tienda")} />
      </div>
    )}

    {pantallaActiva === "amigos" && (
      <div className="gm-content-full">
        <AmigosPage
          onVolver={volverAJugar}
          onVerPerfil={irAPerfilDe}
          onRetar={retarJugador}
          solicitudes={solicitudes}
        />
      </div>
    )}

    {pantallaActiva === "tienda" && (
      <div className="gm-content-full">
        <TiendaPage onVolver={volverAJugar} />
      </div>
    )}

    <InvitacionesRetos onAceptar={setLobbyEntrante} />
    {lobbyEntrante && <LobbyEntrante lobbyId={lobbyEntrante} onCerrar={cerrarLobbyEntrante} />}

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