"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { firstError } from "@/lib/validation";
import { SUPPORT_TOPICS, ticketRef } from "@/domain/support";
import { notifyStaffTicket, notifyStaffTicketReply, notifyTicketReceived } from "@/server/notifications";
import { ticketScope } from "@/server/support";

export type SupportState = { ok?: string; error?: string } | null;

const LOGIN = "Tu sesión terminó. Vuelve a ingresar.";

const newTicketSchema = z.object({
  topic: z.enum(SUPPORT_TOPICS.map((t) => t.v) as [string, ...string[]], { message: "Elige un tema." }),
  orderId: z.string().max(40).optional().or(z.literal("")),
  message: z.string().trim().min(15, "Cuéntanos un poco más (mínimo 15 caracteres).").max(2000, "Máximo 2000 caracteres."),
});

const replySchema = z.object({
  id: z.string().min(1).max(40),
  body: z.string().trim().min(2, "Escribe tu mensaje.").max(2000, "Máximo 2000 caracteres."),
});

async function owner() {
  const user = await getCurrentUser();
  if (!user) return null;
  return db.user.findUnique({ where: { id: user.id }, select: { id: true, email: true, emailVerifiedAt: true } });
}

/** Nueva solicitud desde Mi cuenta: queda ligada al cliente y la ve en su historial. */
export async function createAccountTicketAction(_: SupportState, form: FormData): Promise<SupportState> {
  const me = await owner();
  if (!me) return { error: LOGIN };
  if (!rateLimit(`acc-ticket:${me.id}`, 5, 30 * 60_000).ok) return { error: "Ya enviaste varias solicitudes. Espera un momento o escríbenos por WhatsApp." };
  const parsed = newTicketSchema.safeParse({ topic: form.get("topic"), orderId: form.get("orderId") ?? "", message: form.get("message") });
  if (!parsed.success) return { error: firstError(parsed.error) };

  // Solo pedidos del propio cliente.
  let orderId: string | null = null;
  if (parsed.data.orderId) {
    const order = await db.order.findFirst({ where: { id: parsed.data.orderId, OR: [{ userId: me.id }, ...(me.emailVerifiedAt ? [{ customerEmail: me.email }] : [])] }, select: { id: true } });
    if (!order) return { error: "Ese pedido no está en tu cuenta." };
    orderId = order.id;
  }
  const t = await db.supportTicket.create({ data: { email: me.email, userId: me.id, topic: parsed.data.topic, message: parsed.data.message, orderId } });
  void notifyStaffTicket(t.id).catch(() => {});
  void notifyTicketReceived(t.id).catch(() => {});
  revalidatePath("/cuenta");
  return { ok: `Solicitud #${ticketRef(t.id)} enviada. Te avisaremos por correo cuando respondamos.` };
}

/** El cliente contesta en su solicitud; si estaba resuelta, se reabre para el equipo. */
export async function replyAccountTicketAction(_: SupportState, form: FormData): Promise<SupportState> {
  const me = await owner();
  if (!me) return { error: LOGIN };
  if (!rateLimit(`acc-ticket-reply:${me.id}`, 10, 10 * 60_000).ok) return { error: "Vas muy rápido. Espera un momento antes de enviar otro mensaje." };
  const parsed = replySchema.safeParse({ id: form.get("id"), body: String(form.get("body") ?? "").replace(/\r\n?/g, "\n") });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const ticket = await db.supportTicket.findFirst({ where: { id: parsed.data.id, ...ticketScope(me) }, select: { id: true, status: true } });
  if (!ticket) return { error: "Solicitud no encontrada." };
  if (ticket.status === "CLOSED") return { error: "Esta solicitud está cerrada. Abre una nueva si necesitas algo más." };
  await db.$transaction([
    db.ticketReply.create({ data: { ticketId: ticket.id, authorEmail: me.email, fromCustomer: true, body: parsed.data.body, delivery: "INAPP" } }),
    db.supportTicket.update({ where: { id: ticket.id }, data: { status: "OPEN" } }),
  ]);
  void notifyStaffTicketReply(ticket.id, parsed.data.body).catch(() => {});
  revalidatePath("/cuenta");
  return { ok: "Mensaje enviado." };
}

/** El cliente indica que ya quedó solucionado. */
export async function resolveAccountTicketAction(_: SupportState, form: FormData): Promise<SupportState> {
  const me = await owner();
  if (!me) return { error: LOGIN };
  const id = String(form.get("id") ?? "").slice(0, 40);
  const ticket = await db.supportTicket.findFirst({ where: { id, ...ticketScope(me) }, select: { id: true, status: true } });
  if (!ticket) return { error: "Solicitud no encontrada." };
  if (ticket.status !== "RESOLVED" && ticket.status !== "CLOSED") await db.supportTicket.update({ where: { id: ticket.id }, data: { status: "RESOLVED" } });
  revalidatePath("/cuenta");
  return { ok: "Marcamos tu solicitud como resuelta. ¡Gracias!" };
}
