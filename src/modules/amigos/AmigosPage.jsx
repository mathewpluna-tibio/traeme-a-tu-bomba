import { useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../../firebase/config";
import { useAuth } from "../../context/AuthContext";
import { useAmigos } from "../../hooks/useAmigos";
import { useEstaEnLinea } from "../../hooks/Useestaenlinea";
import UserBomb from "../../assets/UserBomb.png";
import "./AmigosPage.css";

const enviarSolicitudCallable = httpsCallable(functions, "enviarSolicitudAmistad");
const responderSolicitudCallable = httpsCallable(functions, "responderSolicitudAmistad");
const eliminarAmigoCallable = httpsCallable(functions, "eliminarAmigo");

function FilaJugador({ jugador, esAmigo, enviada, esInvitado, onVerPerfil, onRetar, onAgregar, onEliminar }) {
  // RQNF-SOC-03: el estado en línea viene de Realtime Database en tiempo real
  const enLinea = useEstaEnLinea(jugador.uid);

  return (
    <li className="amg-fila">
      <button className="amg-fila-info" onClick={() => onVerPerfil(jugador.uid)}>
        <span className="amg-avatar-wrap">
          <img className="amg-avatar" src={jugador.fotoPerfil || UserBomb} alt="" />
          <span className={"amg-estado" + (enLinea ? " amg-estado--on" : "")} />
        </span>
        <span className="amg-nombre">
          {jugador.username}
          <small>{enLinea ? "En línea" : "Desconectado"}</small>
        </span>
      </button>

      <div className="amg-acciones">
        <button
          className="amg-btn amg-btn--primary"
          disabled={!enLinea}
          title={!enLinea ? "El jugador debe estar en línea para retarlo" : undefined}
          onClick={() => onRetar(jugador.uid)}
        >
          ⚔️ Retar
        </button>
        {esAmigo ? (
          <button className="amg-btn" onClick={() => onEliminar(jugador.uid)}>Eliminar</button>
        ) : (
          !esInvitado && (
            <button className="amg-btn" disabled={enviada} onClick={() => onAgregar(jugador.uid)}>
              {enviada ? "Solicitud enviada ✓" : "➕ Agregar"}
            </button>
          )
        )}
      </div>
    </li>
  );
}

export default function AmigosPage({ onVolver, onVerPerfil, onRetar, solicitudes }) {
  const { user } = useAuth();
  const amigosUids = useAmigos(user?.uid);
  const [perfilesAmigos, setPerfilesAmigos] = useState({});
  const [busqueda, setBusqueda] = useState("");
  const [resultados, setResultados] = useState(null);
  const [buscando, setBuscando] = useState(false);
  const [enviadas, setEnviadas] = useState({});
  const [mensaje, setMensaje] = useState("");

  const esInvitado = !!user?.isAnonymous;

  // Perfiles de los amigos (nombre/foto) a partir de sus uids
  useEffect(() => {
    let cancelado = false;
    (async () => {
      const faltantes = amigosUids.filter((id) => !perfilesAmigos[id]);
      if (faltantes.length === 0) return;
      const cargados = await Promise.all(
        faltantes.map(async (id) => {
          const snap = await getDoc(doc(db, "usuarios", id));
          return snap.exists() ? [id, { uid: id, ...snap.data() }] : null;
        })
      );
      if (cancelado) return;
      setPerfilesAmigos((prev) => ({
        ...prev,
        ...Object.fromEntries(cargados.filter(Boolean)),
      }));
    })();
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amigosUids]);

  // RQF-SOC-01: búsqueda por nombre de usuario (prefijo, consulta indexada
  // sobre `username`) o por ID único (uid exacto).
  useEffect(() => {
    const termino = busqueda.trim();
    if (!termino) {
      setResultados(null);
      return;
    }

    let cancelado = false;
    const temporizador = setTimeout(async () => {
      setBuscando(true);
      try {
        const encontrados = new Map();

        const porNombre = await getDocs(
          query(
            collection(db, "usuarios"),
            orderBy("username"),
            where("username", ">=", termino),
            where("username", "<=", termino + ""),
            limit(20)
          )
        );
        porNombre.forEach((d) => encontrados.set(d.id, { uid: d.id, ...d.data() }));

        if (!termino.includes("/") && termino.length >= 20) {
          const porId = await getDoc(doc(db, "usuarios", termino));
          if (porId.exists()) encontrados.set(porId.id, { uid: porId.id, ...porId.data() });
        }

        if (!cancelado) {
          setResultados(
            [...encontrados.values()].filter((j) => j.uid !== user?.uid && j.username)
          );
        }
      } catch (err) {
        console.error("Error en la búsqueda:", err);
        if (!cancelado) setMensaje("No se pudo completar la búsqueda.");
      } finally {
        if (!cancelado) setBuscando(false);
      }
    }, 300);

    return () => {
      cancelado = true;
      clearTimeout(temporizador);
    };
  }, [busqueda, user?.uid]);

  const agregar = async (uidDestino) => {
    setMensaje("");
    try {
      await enviarSolicitudCallable({ uidDestino });
      setEnviadas((prev) => ({ ...prev, [uidDestino]: true }));
    } catch (err) {
      console.error("Error al enviar solicitud:", err);
      setMensaje(err.message || "No se pudo enviar la solicitud.");
    }
  };

  const responder = async (idSolicitud, aceptar) => {
    setMensaje("");
    try {
      await responderSolicitudCallable({ idSolicitud, aceptar });
    } catch (err) {
      console.error("Error al responder solicitud:", err);
      setMensaje(err.message || "No se pudo responder la solicitud.");
    }
  };

  const eliminar = async (uidAmigo) => {
    setMensaje("");
    try {
      await eliminarAmigoCallable({ uidAmigo });
    } catch (err) {
      console.error("Error al eliminar amigo:", err);
      setMensaje(err.message || "No se pudo eliminar al amigo.");
    }
  };

  const amigosCargados = amigosUids.map((id) => perfilesAmigos[id]).filter(Boolean);
  const setAmigos = new Set(amigosUids);

  // Con búsqueda activa: primero los amigos que coinciden, luego el resto.
  let lista = amigosCargados;
  if (resultados !== null) {
    const t = busqueda.trim().toLowerCase();
    const amigosQueCoinciden = amigosCargados.filter(
      (a) => a.username?.toLowerCase().includes(t) || a.uid === busqueda.trim()
    );
    const idsAmigosCoinciden = new Set(amigosQueCoinciden.map((a) => a.uid));
    const otros = resultados.filter((j) => !idsAmigosCoinciden.has(j.uid));
    lista = [...amigosQueCoinciden, ...otros];
  }

  return (
    <div className="amg-page">
      <button className="amg-volver" onClick={onVolver}>← Volver al menú</button>
      <h2>Amigos</h2>

      {esInvitado && (
        <p className="amg-aviso">
          Estás jugando como invitado: puedes buscar jugadores y retarlos, pero necesitas una
          cuenta para tener amigos.
        </p>
      )}

      {solicitudes.length > 0 && (
        <section className="amg-seccion">
          <h3>Solicitudes de amistad ({solicitudes.length})</h3>
          <ul className="amg-lista">
            {solicitudes.map((s) => (
              <li key={s.id} className="amg-fila">
                <span className="amg-nombre">
                  {s.deUsername}
                  <small>quiere ser tu amigo</small>
                </span>
                <div className="amg-acciones">
                  <button className="amg-btn amg-btn--primary" onClick={() => responder(s.id, true)}>
                    Aceptar
                  </button>
                  <button className="amg-btn" onClick={() => responder(s.id, false)}>
                    Rechazar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <input
        className="amg-busqueda"
        type="search"
        placeholder="Buscar jugador por nombre de usuario o ID..."
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
      />

      {mensaje && <p className="amg-error">{mensaje}</p>}

      <section className="amg-seccion">
        <h3>{resultados !== null ? "Resultados" : `Tus amigos (${amigosUids.length})`}</h3>

        {buscando && <p className="amg-vacio">Buscando...</p>}
        {!buscando && lista.length === 0 && (
          <p className="amg-vacio">
            {resultados !== null
              ? "No se encontró ningún jugador."
              : "Aún no tienes amigos. ¡Busca a alguien por su nombre o ID!"}
          </p>
        )}

        <ul className="amg-lista">
          {lista.map((j) => (
            <FilaJugador
              key={j.uid}
              jugador={j}
              esAmigo={setAmigos.has(j.uid)}
              enviada={!!enviadas[j.uid]}
              esInvitado={esInvitado}
              onVerPerfil={onVerPerfil}
              onRetar={onRetar}
              onAgregar={agregar}
              onEliminar={eliminar}
            />
          ))}
        </ul>
      </section>
    </div>
  );
}