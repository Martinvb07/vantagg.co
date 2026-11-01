"use server";

import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";
import { setMarketingConsent, validUnsubscribe } from "@/server/marketing";

export type UnsubState = { ok: boolean; optedIn: boolean; message: string } | null;

/** Baja (o volver a suscribirse) desde el enlace firmado del correo, sin iniciar sesión. */
export async function unsubscribeAction(_: UnsubState, form: FormData): Promise<UnsubState> {
  const u = String(form.get("u") ?? "");
  const t = String(form.get("t") ?? "");
  const optIn = form.get("optIn") === "1";
  if (!rateLimit(`unsub:${await clientIp()}`, 20, 10 * 60_000).ok) return { ok: false, optedIn: !optIn, message: "Demasiados intentos. Espera unos minutos." };
  if (!validUnsubscribe(u, t) || !(await db.user.findUnique({ where: { id: u }, select: { id: true } }))) return { ok: false, optedIn: !optIn, message: "El enlace no es válido." };
  await setMarketingConsent(u, optIn, optIn ? "correo-volver" : "correo-baja");
  return { ok: true, optedIn: optIn, message: optIn ? "Listo: volverás a recibir nuestras ofertas." : "Listo: ya no te enviaremos ofertas. Los correos de tus pedidos te seguirán llegando." };
}
