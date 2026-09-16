const { onSchedule } = require("firebase-functions/v2/scheduler");
const { getAuth } = require("firebase-admin/auth");

const HORAS_ANTES_DE_BORRAR = 24;

const limpiarInvitadosViejos = onSchedule(
  {
    schedule: "every day 03:00",
    timeZone: "America/Mexico_City",
  },
  async () => {
    const auth = getAuth();
    const limiteMs = Date.now() - HORAS_ANTES_DE_BORRAR * 60 * 60 * 1000;
    const uidsABorrar = [];

    let pageToken;
    do {
      const resultado = await auth.listUsers(1000, pageToken);
      resultado.users.forEach((userRecord) => {
        const esAnonimo = userRecord.providerData.length === 0;
        const creadoEn = new Date(userRecord.metadata.creationTime).getTime();
        if (esAnonimo && creadoEn < limiteMs) {
          uidsABorrar.push(userRecord.uid);
        }
      });
      pageToken = resultado.pageToken;
    } while (pageToken);

    if (uidsABorrar.length === 0) {
      console.log("[Mantenimiento] No hay invitados viejos que borrar.");
      return;
    }

    // deleteUsers acepta máximo 1000 UIDs por llamada
    const resultado = await auth.deleteUsers(uidsABorrar);
    console.log(
      `[Mantenimiento] Invitados borrados: ${resultado.successCount}, fallidos: ${resultado.failureCount}`
    );
  }
);

module.exports = { limpiarInvitadosViejos };