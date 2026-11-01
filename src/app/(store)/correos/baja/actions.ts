"use server";

import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";
import { setContactConsent, setMarketingConsent, validUnsubscribe, type Recipient } from "@/server/marketing";

export type UnsubState = { ok: boolean; optedIn: boolean; message: string } | null;

/** Baja (o volver a suscribirse) desde el enlace firmado del correo, sin iniciar sesión. Sirve para cuentas y contactos sin cuenta. */
export async function unsubscribeAction(_: UnsubState, form: FormData): Promise<UnsubState> {
  const id = String(form.get("id") ?? "");
  const who: Recipient = form.get("who") === "c" ? "c" : "u";
  const t = String(form.get("t") ?? "");
  const optIn = form.get("optIn") === "1";
  if (!rateLimit(`unsub:${await clientIp()}`, 20, 10 * 60_000).ok) return { ok: false, optedIn: !optIn, message: "Demasiados intentos. Espera unos minutos." };
  const exists = who === "u" ? await db.user.findUnique({ where: { id }, select: { id: true } }) : await db.emailContact.findUnique({ where: { id }, select: { id: true } });
  if (!validUnsubscribe(id, t, who) || !exists) return { ok: false, optedIn: !optIn, message: "El enlace no es válido." };
  if (who === "u") await setMarketingConsent(id, optIn, optIn ? "correo-volver" : "correo-baja");
  else await setContactConsent(id, optIn, optIn ? "correo-volver" : "correo-baja");
  return { ok: true, optedIn: optIn, message: optIn ? "Listo: volverás a recibir nuestras ofertas." : "Listo: ya no te enviaremos ofertas. Los correos de tus pedidos te seguirán llegando." };
}
