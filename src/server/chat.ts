import "server-only";
import type { ChatAuthor, OrderStatus, OrderType } from "@prisma/client";
import { db } from "@/lib/db";
import { safeEqual } from "@/lib/crypto";
import { openBytes, openText, sealBytes, sealText } from "@/lib/secure-box";
import type { ChatImageMime } from "@/lib/image-sniff";
import { isStaff, type SessionUser } from "@/lib/auth";
import { notifyStaffChat } from "./notifications";

/**
 * Chat de entrega de cuentas: comprador ↔ equipo, por pedido.
 * Se abre al confirmarse el pago y sigue disponible unos días tras la entrega.
 */

export const CHAT_MAX_LEN = 2000;
const OPEN_AFTER_DELIVERY_DAYS = 7;

export type ChatState = "hidden" | "open" | "closed";

export function chatState(o: { type: OrderType; status: OrderStatus; deliveredAt: Date | null }, now = new Date()): ChatState {
  if (o.type !== "ACCOUNT" || o.status === "PENDING_PAYMENT") return "hidden";
  if (o.status === "CANCELLED" || o.status === "REFUNDED") return "closed";
  if (o.status === "DELIVERED" && o.deliveredAt && now.getTime() - o.deliveredAt.getTime() > OPEN_AFTER_DELIVERY_DAYS * 86_400_000) return "closed";
  return "open";
}

export type ChatAttachmentView = { id: string; mime: string; width: number | null; height: number | null; size: number };
export type ChatMessageView = { id: string; author: ChatAuthor; body: string; createdAt: string; attachment?: ChatAttachmentView | null };
export type NewAttachment = { mime: ChatImageMime; data: Buffer; width?: number | null; height?: number | null };

export async function listMessages(orderId: string, after?: Date): Promise<ChatMessageView[]> {
  const rows = await db.orderMessage.findMany({
    where: { orderId, ...(after ? { createdAt: { gte: after } } : {}) },
    orderBy: { createdAt: "asc" },
    take: 300,
    include: { attachment: { select: { id: true, mime: true, width: true, height: true, size: true } } },
  });
  return rows.map((m) => ({ id: m.id, author: m.author, body: openText(m.body) ?? "[Mensaje no disponible]", createdAt: m.createdAt.toISOString(), attachment: m.attachment ?? null }));
}

/** Limpia el texto: sin caracteres de control (salvo saltos de línea), recortado. */
export function cleanBody(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const body = raw
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
  if (!body || body.length > CHAT_MAX_LEN) return null;
  return body;
}

export async function postMessage(orderId: string, author: ChatAuthor, body: string, staffId?: string, file?: NewAttachment) {
  const now = new Date();
  const dims = (n: number | null | undefined) => (Number.isInteger(n) && n! > 0 && n! < 20_000 ? n! : null);
  const [msg] = await db.$transaction([
    db.orderMessage.create({
      data: {
        order: { connect: { id: orderId } },
        author,
        staffId: staffId ?? null,
        body: sealText(body),
        createdAt: now,
        ...(file
          ? { attachment: { create: { order: { connect: { id: orderId } }, mime: file.mime, size: file.data.length, width: dims(file.width), height: dims(file.height), data: Uint8Array.from(sealBytes(file.data)) } } }
          : {}),
      },
      include: { attachment: { select: { id: true, mime: true, width: true, height: true, size: true } } },
    }),
    db.order.update({
      where: { id: orderId },
      data: {
        chatLastAt: now,
        ...(author === "CUSTOMER" ? { chatUnreadStaff: { increment: 1 } } : {}),
        ...(author === "STAFF" ? { chatUnreadCustomer: { increment: 1 } } : {}),
      },
    }),
  ]);
  if (author === "CUSTOMER") void notifyStaffChat(orderId).catch(() => {});
  touchPresence(orderId, author === "STAFF" ? "staff" : "customer", false);
  return { id: msg.id, author: msg.author, body, createdAt: msg.createdAt.toISOString(), attachment: msg.attachment ?? null } satisfies ChatMessageView;
}

/** Mensaje automático de la tienda. `alertStaff` lo marca como pendiente en la bandeja. */
export async function postSystemMessage(orderId: string, text: string, opts: { alertStaff?: boolean } = {}) {
  const now = new Date();
  await db.$transaction([
    db.orderMessage.create({ data: { orderId, author: "SYSTEM", body: sealText(text), createdAt: now } }),
    db.order.update({ where: { id: orderId }, data: { chatLastAt: now, ...(opts.alertStaff ? { chatUnreadStaff: { increment: 1 } } : {}) } }),
  ]);
}

/** Marca el chat como visto por un lado: borra sus pendientes y guarda la hora (para el «visto ✓✓»). */
export async function markRead(orderId: string, side: "staff" | "customer") {
  const now = new Date();
  // updateMany: si el pedido ya no existe (p. ej. un enlace viejo del panel) no es un error.
  if (side === "staff") await db.order.updateMany({ where: { id: orderId }, data: { chatUnreadStaff: 0, chatStaffReadAt: now } });
  else await db.order.updateMany({ where: { id: orderId }, data: { chatUnreadCustomer: 0, chatCustomerReadAt: now } });
}

/** Hora en que el otro lado vio el chat por última vez. */
export async function peerReadAt(orderId: string, side: "staff" | "customer"): Promise<string | null> {
  const o = await db.order.findUnique({ where: { id: orderId }, select: { chatCustomerReadAt: true, chatStaffReadAt: true } });
  const at = side === "staff" ? o?.chatCustomerReadAt : o?.chatStaffReadAt;
  return at ? at.toISOString() : null;
}

// ---------------------------------------------------------------------
// Presencia y «escribiendo…» (en memoria: es efímero y no hace falta guardarlo)
// ---------------------------------------------------------------------

const presence = new Map<string, { customer?: number; staff?: number; customerTyping?: number; staffTyping?: number }>();

export function touchPresence(orderId: string, side: "staff" | "customer", typing: boolean) {
  const p = presence.get(orderId) ?? {};
  const now = Date.now();
  if (side === "staff") {
    p.staff = now;
    p.staffTyping = typing ? now : undefined;
  } else {
    p.customer = now;
    p.customerTyping = typing ? now : undefined;
  }
  presence.set(orderId, p);
  if (presence.size > 5000) presence.delete(presence.keys().next().value!);
}

/** Estado del otro lado: en línea (visto en los últimos 25 s) y escribiendo (últimos 6 s). */
export function peerPresence(orderId: string, side: "staff" | "customer") {
  const p = presence.get(orderId);
  const now = Date.now();
  const seen = side === "staff" ? p?.customer : p?.staff;
  const typing = side === "staff" ? p?.customerTyping : p?.staffTyping;
  return { online: !!seen && now - seen < 25_000, typing: !!typing && now - typing < 6_000 };
}

/** Imagen adjunta descifrada (solo si pertenece al pedido). */
export async function readAttachment(orderId: string, attachmentId: string) {
  const a = await db.chatAttachment.findFirst({ where: { id: attachmentId, orderId }, select: { mime: true, data: true } });
  if (!a) return null;
  const data = openBytes(a.data);
  return data ? { mime: a.mime, data } : null;
}

/**
 * Acceso del comprador: token de seguimiento o sesión del dueño del pedido.
 * El equipo responde desde el panel, no desde la vista del cliente.
 */
export async function findCustomerChatOrder(number: string, token: string | null, user: SessionUser | null) {
  const order = await db.order.findUnique({
    where: { number },
    select: { id: true, type: true, status: true, deliveredAt: true, trackingToken: true, userId: true },
  });
  if (!order) return null;
  const tokenOk = !!token && safeEqual(order.trackingToken, token);
  const ownerOk = !!user && order.userId === user.id;
  if (!tokenOk && !ownerOk) return null;
  const staffViewer = !!user && isStaff(user.role) && !ownerOk;
  return { order, staffViewer };
}
