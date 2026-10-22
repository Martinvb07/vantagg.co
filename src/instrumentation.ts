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
    // Formulario de una página abierta antes de un deploy (o un bot): no es una falla de la tienda.
    // El navegador del cliente recarga solo; no vale la pena despertar al equipo por esto.
    if (/Failed to find Server Action/i.test(e?.message ?? "")) return;
    try {
      const { notifyStaffServerError } = await import("@/server/notifications");
      await notifyStaffServerError({ path: request.path, method: request.method, message: e?.message ?? String(err), digest: e?.digest });
    } catch {
      // El aviso nunca debe causar otro error.
    }
  }
};
