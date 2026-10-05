import { setup, assign } from "xstate";

export const menuMachine = setup({}).createMachine({
  id: "menu",
  initial: "menu",
  context: {
    tipoAccion: null,
    modalidad: null,
    partidaId: null,
    lobbyId: null,
    retadoUid: null,
  },
  states: {
    menu: {
      on: {
        INICIAR_FLUJO: {
          target: "modalidad",
          actions: assign({
            tipoAccion: ({ event }) => event.accion,
            retadoUid: ({ event }) => event.uidRetado ?? null,
          }),
        },
      },
    },
    modalidad: {
      on: {
        SELECCIONAR_MODALIDAD_ESTANDAR: {
          target: "clase",
          actions: assign({ modalidad: () => "estandar" }),
        },
        // Lobby privado (RQF-MEN-05): sin clase que elegir, el lobby ya fue
        // creado por MenuPrincipal y llega su id en el evento.
        SELECCIONAR_MODALIDAD_OTRA: [
          {
            guard: ({ context }) => context.tipoAccion === "lobby",
            target: "lobby_espera",
            actions: assign({
              modalidad: ({ event }) => event.modalidad,
              lobbyId: ({ event }) => event.lobbyId,
            }),
          },
          {
            target: "buscando",
            actions: assign({ modalidad: ({ event }) => event.modalidad }),
          },
        ],
        CANCELAR: { target: "menu", actions: assign({ tipoAccion: null, modalidad: null, retadoUid: null }) },
      },
    },
    clase: {
      on: {
        CLASE_CONFIRMADA: [
          {
            guard: ({ context }) => context.tipoAccion === "lobby",
            target: "lobby_espera",
            actions: assign({ lobbyId: ({ event }) => event.lobbyId }),
          },
          { target: "buscando" },
        ],
        CANCELAR: { target: "menu", actions: assign({ tipoAccion: null, modalidad: null, retadoUid: null }) },
      },
    },
    lobby_espera: {
      on: {
        CANCELAR_BUSQUEDA: {
          target: "menu",
          actions: assign({ tipoAccion: null, modalidad: null, lobbyId: null, retadoUid: null }),
        },
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
          actions: assign({ tipoAccion: null, modalidad: null, partidaId: null, lobbyId: null, retadoUid: null }),
        },
        // Partida privada: "Retar nuevamente" crea otro lobby dirigido al rival
        REVANCHA: {
          target: "lobby_espera",
          actions: assign({
            partidaId: null,
            tipoAccion: () => "lobby",
            modalidad: ({ event }) => event.modalidad,
            lobbyId: ({ event }) => event.lobbyId,
            retadoUid: ({ event }) => event.uidRetado,
          }),
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