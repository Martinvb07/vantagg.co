import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { env, isProduction } from "@/lib/env";
import { formatMoney } from "@/lib/money";
import {
  chatMessageEmail,
  claimReceivedEmail,
  orderEmail,
  passwordChangedEmail,
  staffAccountSoldEmail,
  staffChatEmail,
  staffClaimEmail,
  staffDeliveryIssueEmail,
  staffSecurityEmail,
  staffServerErrorEmail,
  staffTicketEmail,
  ticketReceivedEmail,
  type Brand,
  type Email,
  type OrderTemplate,
  type StaffSecurityEvent,
} from "./email-templates";
import { getSettings } from "./settings";
import { adminEntryUrl } from "./admin-gate";
import { deliverable, describeDevice } from "@/lib/email-utils";
import { topicLabel } from "@/domain/support";

export { deliverable, describeDevice };

/**
 * Correos transaccionales.
 *  - NOTIFY_PROVIDER=resend → API de Resend (dominio verificado).
 *  - NOTIFY_PROVIDER=smtp   → cualquier servidor SMTP (Gmail/Outlook con contraseña de aplicación, Zoho, etc.).
 *  - NOTIFY_PROVIDER=log    → no envía; solo registra (desarrollo).
 * Cada (pedido, plantilla) se envía una sola vez gracias a la restricción única en Notification.
 */
export type NotificationTemplate = OrderTemplate;
export type EmailResult = { status: "SENT" | "SKIPPED" | "FAILED"; error?: string };

export function notificationsMissingConfig(): string[] {
  const n = env.notify;
  const m: string[] = [];
  if (n.provider === "resend") {
    if (!n.resendApiKey) m.push("RESEND_API_KEY");
  } else if (n.provider === "smtp") {
    if (!n.smtp.host) m.push("SMTP_HOST");
    if (!n.smtp.user) m.push("SMTP_USER");
    if (!n.smtp.pass) m.push("SMTP_PASS");
  } else {
    return [];
  }
  if (!n.fromEmail) m.push("NOTIFY_FROM_EMAIL");
  return m;
}

export const emailReady = () => (env.notify.provider === "resend" || env.notify.provider === "smtp") && notificationsMissingConfig().length === 0;

export async function getBrand(): Promise<Brand> {
  const s = await getSettings();
  return { storeName: s.storeName, appUrl: env.appUrl, supportEmail: s.supportEmail || undefined, whatsapp: s.whatsapp || undefined };
}

type SmtpTransport = { sendMail: (m: Record<string, unknown>) => Promise<unknown> };
let transport: SmtpTransport | null = null;
async function smtp(): Promise<SmtpTransport> {
  if (!transport) {
    const nodemailer = await import("nodemailer");
    const s = env.notify.smtp;
    transport = nodemailer.createTransport({
      host: s.host,
      port: s.port,
      secure: s.port === 465,
      requireTLS: s.port !== 465,
      auth: { user: s.user, pass: s.pass },
      connectionTimeout: 10_000,
      socketTimeout: 15_000,
    });
  }
  return transport;
}

/**
 * Envía un correo con el proveedor configurado y deja constancia (sin contenido) en EmailLog.
 * Sin proveedor configurado devuelve SKIPPED.
 */
export async function sendEmail(to: string, template: string, email: Email, opts: { replyTo?: string } = {}): Promise<EmailResult> {
  let result: EmailResult;
  const onlyTo = env.notify.onlyTo;
  if (!emailReady()) {
    result = { status: "SKIPPED", error: "Correo no configurado" };
  } else if (onlyTo.length && !onlyTo.includes(to.trim().toLowerCase())) {
    result = { status: "SKIPPED", error: "Modo prueba: solo se envía a los correos de NOTIFY_ONLY_TO (verifica tu dominio en Resend para enviar a todos)" };
  } else {
    try {
      if (env.notify.provider === "smtp") {
        await (await smtp()).sendMail({ from: env.notify.fromEmail, to, subject: email.subject, html: email.html, text: email.text, ...(opts.replyTo ? { replyTo: opts.replyTo } : {}) });
      } else {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${env.notify.resendApiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: env.notify.fromEmail, to, subject: email.subject, html: email.html, text: email.text, ...(opts.replyTo ? { reply_to: opts.replyTo } : {}) }),
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) throw new Error(`Resend HTTP ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
      }
      result = { status: "SENT" };
    } catch (err) {
      result = { status: "FAILED", error: (err as Error).message.slice(0, 500) };
    }
  }
  if (result.status === "SKIPPED" && !isProduction) console.info(`[correo:${template}] (sin enviar: ${result.error}) → ${to} · ${email.subject}`);
  if (result.status === "FAILED") console.error(`[correo:${template}] falló: ${result.error}`);
  await db.emailLog.create({ data: { to: to.slice(0, 191), template: template.slice(0, 40), subject: email.subject.slice(0, 200), status: result.status, error: result.error ?? null } }).catch(() => {});
  return result;
}

const orderLink = (o: { number: string; trackingToken: string }) => `${env.appUrl}/pedido/${o.number}?t=${o.trackingToken}`;

export async function notifyOrder(orderId: string, template: NotificationTemplate) {
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order) return;

  let notification;
  try {
    notification = await db.notification.create({ data: { orderId, channel: "email", recipient: order.customerEmail, template } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return; // ya enviada
    throw err;
  }

  const email = orderEmail(await getBrand(), template, {
    number: order.number,
    type: order.type,
    item: (order.itemSnapshot as { name?: string }).name ?? "Producto digital",
    total: formatMoney(order.total, order.currency),
    playerId: order.playerId,
    link: orderLink(order),
    isTest: order.isTest,
  });
  const r = await sendEmail(order.customerEmail, template, email);
  await db.notification.update({ where: { id: notification.id }, data: { status: r.status, sentAt: r.status === "SENT" ? new Date() : null, error: r.error ?? null } });
}

/** Aviso al comprador de un mensaje nuevo en el chat. Máximo uno cada 15 min por pedido. */
export async function notifyChatMessage(orderId: string) {
  const since = new Date(Date.now() - 15 * 60_000);
  const claimed = await db.order.updateMany({
    where: { id: orderId, type: "ACCOUNT", OR: [{ chatEmailedAt: null }, { chatEmailedAt: { lt: since } }] },
    data: { chatEmailedAt: new Date() },
  });
  if (claimed.count !== 1) return;
  const order = await db.order.findUnique({ where: { id: orderId }, select: { number: true, trackingToken: true, customerEmail: true } });
  if (!order) return;
  await sendEmail(order.customerEmail, "chat_message", chatMessageEmail(await getBrand(), { number: order.number, link: orderLink(order) }));
}

/** Avisos al equipo: van al «correo para avisos internos» de Ajustes (o, si está vacío, al de soporte). */
async function staffInbox() {
  const s = await getSettings();
  return s.staffAlertEmail || s.supportEmail || null;
}

/** Fecha y hora en Colombia, para los avisos de seguridad. */
const bogota = (d = new Date()) => new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeStyle: "short", timeZone: "America/Bogota" }).format(d);

export async function notifyStaffAccountSold(orderId: string) {
  const to = await staffInbox();
  if (!to) return;
  const order = await db.order.findUnique({ where: { id: orderId }, select: { id: true, number: true, total: true, currency: true, itemSnapshot: true } });
  if (!order) return;
  await sendEmail(
    to,
    "staff_account_sold",
    staffAccountSoldEmail(await getBrand(), { number: order.number, item: (order.itemSnapshot as { name?: string }).name ?? "Cuenta", total: formatMoney(order.total, order.currency), adminLink: adminEntryUrl(`/admin/chats?o=${order.id}`) }),
  );
}

export async function notifyStaffTicket(ticketId: string) {
  const to = await staffInbox();
  if (!to) return;
  const t = await db.supportTicket.findUnique({ where: { id: ticketId } });
  if (!t) return;
  const ref = t.id.slice(-8).toUpperCase();
  await sendEmail(to, "staff_ticket", staffTicketEmail(await getBrand(), { ref, topic: topicLabel(t.topic), email: t.email, excerpt: t.message.slice(0, 600), adminLink: adminEntryUrl(`/admin/soporte?v=todas&q=${ref.toLowerCase()}`) }), { replyTo: t.email });
}

// ---------------------------------------------------------------------
// Cliente: seguridad y solicitudes
// ---------------------------------------------------------------------

export async function notifyPasswordChanged(userId: string, how: "reset" | "perfil") {
  const u = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!u || !deliverable(u.email)) return;
  await sendEmail(u.email, "password_changed", passwordChangedEmail(await getBrand(), { when: bogota(), how }));
}

export async function notifyTicketReceived(ticketId: string) {
  const t = await db.supportTicket.findUnique({ where: { id: ticketId } });
  if (!t || !deliverable(t.email)) return;
  const ref = t.id.slice(-8).toUpperCase();
  const brand = await getBrand();
  const accountLink = t.userId ? `${env.appUrl}/cuenta?seccion=soporte` : undefined;
  await sendEmail(t.email, "ticket_received", ticketReceivedEmail(brand, { ref, topic: topicLabel(t.topic), excerpt: t.message.slice(0, 600), accountLink }), { replyTo: (await staffInbox()) ?? undefined });
}

/** El cliente contestó desde su cuenta: aviso al equipo para que no quede sin respuesta. */
export async function notifyStaffTicketReply(ticketId: string, body: string) {
  const to = await staffInbox();
  if (!to) return;
  const t = await db.supportTicket.findUnique({ where: { id: ticketId } });
  if (!t) return;
  const ref = t.id.slice(-8).toUpperCase();
  await sendEmail(to, "staff_ticket_reply", staffTicketEmail(await getBrand(), { ref, topic: topicLabel(t.topic), email: t.email, excerpt: body.slice(0, 600), adminLink: adminEntryUrl(`/admin/soporte?v=todas&q=${ref.toLowerCase()}`), followUp: true }), { replyTo: t.email });
}

/** Reclamo de propiedad de una cuenta: acuse al reclamante y aviso al equipo. */
export async function notifyClaim(claimId: string) {
  const c = await db.listingClaim.findUnique({ where: { id: claimId }, include: { account: { select: { title: true } } } });
  if (!c) return;
  const ref = c.id.slice(-8).toUpperCase();
  const brand = await getBrand();
  if (deliverable(c.email)) await sendEmail(c.email, "claim_received", claimReceivedEmail(brand, { ref, listing: c.account.title }));
  const to = await staffInbox();
  if (to) await sendEmail(to, "staff_claim", staffClaimEmail(brand, { ref, listing: c.account.title, email: c.email, excerpt: c.reason.slice(0, 600), adminLink: adminEntryUrl("/admin/reclamos") }), { replyTo: c.email });
}

// ---------------------------------------------------------------------
// Equipo: chat, entregas detenidas y seguridad
// ---------------------------------------------------------------------

const staffChatAlerts = new Map<string, number>();

/** El cliente escribió en el chat de entrega. Máximo un aviso cada 10 min por pedido. */
export async function notifyStaffChat(orderId: string) {
  const last = staffChatAlerts.get(orderId) ?? 0;
  if (Date.now() - last < 10 * 60_000) return;
  staffChatAlerts.set(orderId, Date.now());
  const to = await staffInbox();
  if (!to) return;
  const order = await db.order.findUnique({ where: { id: orderId }, select: { number: true } });
  if (!order) return;
  await sendEmail(to, "staff_chat", staffChatEmail(await getBrand(), { number: order.number, adminLink: adminEntryUrl(`/admin/chats?o=${orderId}`) }));
}

/** Una recarga pagada quedó detenida. Un solo aviso por pedido (los reintentos automáticos no repiten). */
export async function notifyStaffDeliveryIssue(orderId: string, reason: string) {
  const to = await staffInbox();
  if (!to) return;
  const order = await db.order.findUnique({ where: { id: orderId }, select: { id: true, number: true, itemSnapshot: true } });
  if (!order) return;
  try {
    await db.notification.create({ data: { orderId, channel: "email", recipient: to, template: "staff_delivery_issue" } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return;
    throw err;
  }
  const r = await sendEmail(
    to,
    "staff_delivery_issue",
    staffDeliveryIssueEmail(await getBrand(), { number: order.number, item: (order.itemSnapshot as { name?: string }).name ?? "Recarga", reason: reason.replace(/^\[[a-z0-9_]+\]\s*/i, "").slice(0, 500), adminLink: adminEntryUrl(`/admin/pedidos/${order.id}`) }),
  );
  await db.notification.updateMany({ where: { orderId, template: "staff_delivery_issue" }, data: { status: r.status, sentAt: r.status === "SENT" ? new Date() : null, error: r.error ?? null } });
}

/** Aviso de seguridad al propio miembro del equipo (ingreso, 2FA, códigos). */
export async function notifyStaffSecurity(userId: string, event: StaffSecurityEvent, opts: { userAgent?: string | null; method?: string } = {}) {
  const u = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!u || !deliverable(u.email)) return;
  await sendEmail(u.email, `staff_${event}`, staffSecurityEmail(await getBrand(), { event, when: bogota(), device: describeDevice(opts.userAgent), method: opts.method }));
}

// ---------------------------------------------------------------------
// Errores del servidor (producción)
// ---------------------------------------------------------------------

const errorAlerts = new Map<string, { last: number; count: number }>();

/**
 * Error del servidor visto por un cliente: aviso al equipo, como máximo uno cada 30 min por tipo de error.
 * Si la base de datos no responde, usa ALERT_EMAIL del servidor como destino de respaldo.
 */
export async function notifyStaffServerError(p: { path: string; method: string; message: string; digest?: string }) {
  const path = p.path.split("?")[0].slice(0, 200); // sin parámetros: pueden llevar tokens de pedido
  const key = `${path}|${p.message.slice(0, 120)}`;
  const now = Date.now();
  const entry = errorAlerts.get(key) ?? { last: 0, count: 0 };
  entry.count++;
  errorAlerts.set(key, entry);
  if (now - entry.last < 30 * 60_000) return;
  const count = entry.count;
  entry.last = now;
  entry.count = 0;
  if (errorAlerts.size > 500) errorAlerts.clear();

  const to = (await staffInbox().catch(() => null)) || process.env.ALERT_EMAIL?.trim() || null;
  if (!to) return;
  const brand = await getBrand().catch((): Brand => ({ storeName: "Tienda", appUrl: env.appUrl }));
  await sendEmail(to, "staff_server_error", staffServerErrorEmail(brand, { path, method: p.method, message: p.message.slice(0, 600), digest: p.digest, when: bogota(), count, adminLink: adminEntryUrl("/admin") }));
}
