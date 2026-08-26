import { useState, useEffect } from "react";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "../../firebase/config";
import { useAuth } from "../../context/AuthContext";
import { unirseACola } from "./matchmaking";
import { useNotificacionPartida } from "../../hooks/useNotificacionPartida";
import SeleccionModalidad from "./SeleccionModalidad";
import SeleccionClase from "./SeleccionClase";
import PartidaScreen from "../gameplay/PartidaScreen";
import "./MenuPrincipal.css";

export default function MenuPrincipal() {
  const [paso, setPaso] = useState("menu");
  const [tipoAccion, setTipoAccion] = useState(null);
  const [modalidadElegida, setModalidadElegida] = useState(null);
  const { user } = useAuth();
  const { partidaId, limpiarNotificacion } = useNotificacionPartida();

  console.log("[RENDER] paso:", paso, "| partidaId:", partidaId);

  useEffect(() => {
    if (partidaId) {
      setPaso("en_partida");
    }
  }, [partidaId]);

  const iniciarFlujo = (accion) => {
    setTipoAccion(accion);
    setPaso("modalidad");
  };

  const onModalidadSeleccionada = async (modalidad) => {
    setModalidadElegida(modalidad);
    if (modalidad === "estandar") {
      setPaso("clase");
    } else {
      if (tipoAccion === "buscar") {
        await unirseACola(modalidad, user.uid, null);
      }
      setPaso("buscando");
    }
  };

  const cancelarFlujo = () => {
    setPaso("menu");
    setTipoAccion(null);
    setModalidadElegida(null);
  };

  const volverAlMenuDesdePartida = async () => {
    await limpiarNotificacion();
    setPaso("menu");
  };

  const jugarDeNuevo = async () => {
    await limpiarNotificacion();

    const prefRef = doc(db, "preferencias", user.uid);
    const prefSnap = await getDoc(prefRef);
    const ultimaModalidad = prefSnap.exists() ? prefSnap.data().ultimaModalidad : "estandar";
    const ultimaClase = prefSnap.exists() ? prefSnap.data().ultimaClase : "aleatoria";

    setModalidadElegida(ultimaModalidad);
    setTipoAccion("buscar");

    await unirseACola(ultimaModalidad, user.uid, ultimaClase);
    setPaso("buscando");
  };

  if (paso === "en_partida") {
    return (
      <PartidaScreen
        partidaId={partidaId}
        onVolverAlMenu={volverAlMenuDesdePartida}
        onJugarDeNuevo={jugarDeNuevo}
      />
    );
  }

  if (paso === "modalidad") {
    return (
      <SeleccionModalidad onSeleccionar={onModalidadSeleccionada} onCancelar={cancelarFlujo} />
    );
  }

  if (paso === "clase") {
    return (
      <SeleccionClase
        tipoAccion={tipoAccion}
        modalidad={modalidadElegida}
        onConfirmar={() => {}}
        onCancelar={cancelarFlujo}
      />
    );
  }

  if (paso === "buscando") {
    return (
      <div>
        <p>Buscando partida en modalidad: {modalidadElegida}...</p>
        <button onClick={cancelarFlujo}>Cancelar búsqueda</button>
      </div>
    );
  }

  return (
    <div className="menu-principal">
      <button className="btn-principal" onClick={() => iniciarFlujo("buscar")}>
        Buscar Partida
      </button>
      <button className="btn-principal" onClick={() => iniciarFlujo("lobby")}>
        Crear Lobby Privado
      </button>
    </div>
  );
}