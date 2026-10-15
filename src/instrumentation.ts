import type { Instrumentation } from "next";

/**
 * Errores del servidor en producción: se registran y se avisa al equipo por correo
 * (agrupados para no llenar la bandeja). En desarrollo no se envía nada.
 * El import queda dentro del bloque "nodejs" para que no entre en el paquete edge.
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request) => {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (process.env.NODE_ENV !== "production") return;
    const e = err as Error & { digest?: string };
    try {
      const { notifyStaffServerError } = await import("@/server/notifications");
      await notifyStaffServerError({ path: request.path, method: request.method, message: e?.message ?? String(err), digest: e?.digest });
    } catch {
      // El aviso nunca debe causar otro error.
    }
  }
};
