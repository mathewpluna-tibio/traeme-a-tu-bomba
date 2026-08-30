import { setup, assign } from "xstate";

export const menuMachine = setup({}).createMachine({
  id: "menu",
  initial: "menu",
  context: {
    tipoAccion: null,
    modalidad: null,
    partidaId: null,
  },
  states: {
    menu: {
      on: {
        INICIAR_FLUJO: {
          target: "modalidad",
          actions: assign({ tipoAccion: ({ event }) => event.accion }),
        },
      },
    },
    modalidad: {
      on: {
        SELECCIONAR_MODALIDAD_ESTANDAR: {
          target: "clase",
          actions: assign({ modalidad: () => "estandar" }),
        },
        SELECCIONAR_MODALIDAD_OTRA: {
          target: "buscando",
          actions: assign({ modalidad: ({ event }) => event.modalidad }),
        },
        CANCELAR: { target: "menu", actions: assign({ tipoAccion: null, modalidad: null }) },
      },
    },
    clase: {
      on: {
        CLASE_CONFIRMADA: { target: "buscando" },
        CANCELAR: { target: "menu", actions: assign({ tipoAccion: null, modalidad: null }) },
      },
    },
    buscando: {
      on: {
        CANCELAR_BUSQUEDA: { target: "menu", actions: assign({ tipoAccion: null, modalidad: null }) },
        PARTIDA_ENCONTRADA: {
          target: "en_partida",
          actions: assign({ partidaId: ({ event }) => event.partidaId }),
        },
      },
    },
    en_partida: {
      on: {
        VOLVER_AL_MENU: {
          target: "menu",
          actions: assign({ tipoAccion: null, modalidad: null, partidaId: null }),
        },
        JUGAR_DE_NUEVO: {
          target: "buscando",
          actions: assign({
            partidaId: null,
            tipoAccion: () => "buscar",
            modalidad: ({ event }) => event.modalidad,
          }),
        },
      },
    },
  },
  on: {
    PARTIDA_ENCONTRADA: {
      target: ".en_partida",
      actions: assign({ partidaId: ({ event }) => event.partidaId }),
    },
  },
});