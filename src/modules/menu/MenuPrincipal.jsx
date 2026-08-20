import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { unirseACola } from "./matchmaking";
import { useNotificacionPartida } from "../../hooks/useNotificacionPartida";
import "./MenuPrincipal.css"
import SeleccionModalidad from "./SeleccionModalidad";
import SeleccionClase from "./SeleccionClase";
import PartidaScreen from "../gameplay/PartidaScreen";

export default function MenuPrincipal() {
  const [paso, setPaso] = useState("menu");
  const [tipoAccion, setTipoAccion] = useState(null);
  const [modalidadElegida, setModalidadElegida] = useState(null);
  const { user } = useAuth();
  const { partidaId, limpiarNotificacion } = useNotificacionPartida();

  // En cuanto llega una notificación de partida, cambiamos de vista automáticamente
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

  if (paso === "en_partida") {
    return <PartidaScreen partidaId={partidaId} />;
  }

  if (paso === "modalidad") {
    return (
      <SeleccionModalidad
        onSeleccionar={onModalidadSeleccionada}
        onCancelar={cancelarFlujo}
      />
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