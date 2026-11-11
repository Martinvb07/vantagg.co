import "server-only";
import { parsePeriodKey } from "@/domain/ranking";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { env, isProduction } from "@/lib/env";
import { formatCharge, formatMoney } from "@/lib/money";
import {
  chatMessageEmail,
  claimReceivedEmail,
  orderEmail,
  passwordChangedEmail,
  staffAccountSoldEmail,
  staffAlertEmail,
  staffChatEmail,
  staffClaimEmail,
  staffDeliveryIssueEmail,
  staffPaymentIssueEmail,
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
export async function sendEmail(to: string, template: string, email: Email, opts: { replyTo?: string; headers?: Record<string, string> } = {}): Promise<EmailResult> {
  let result: EmailResult;
  const onlyTo = env.notify.onlyTo;
  if (!emailReady()) {
    result = { status: "SKIPPED", error: "Correo no configurado" };
  } else if (onlyTo.length && !onlyTo.includes(to.trim().toLowerCase())) {
    result = { status: "SKIPPED", error: "Modo prueba: solo se envía a los correos de NOTIFY_ONLY_TO (verifica tu dominio en Resend para enviar a todos)" };
  } else {
    try {
      if (env.notify.provider === "smtp") {
        await (await smtp()).sendMail({ from: env.notify.fromEmail, to, subject: email.subject, html: email.html, text: email.text, ...(opts.replyTo ? { replyTo: opts.replyTo } : {}), ...(opts.headers ? { headers: opts.headers } : {}) });
      } else {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${env.notify.resendApiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: env.notify.fromEmail, to, subject: email.subject, html: email.html, text: email.text, ...(opts.replyTo ? { reply_to: opts.replyTo } : {}), ...(opts.headers ? { headers: opts.headers } : {}) }),
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

export async function notifyOrder(orderId: string, template: NotificationTemplate, extra: { buyAgainUrl?: string } = {}) {
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order) return;

  let notification;
  try {
    notification = await db.notification.create({ data: { orderId, channel: "email", recipient: order.customerEmail, template } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return; // ya enviada
    throw err;
  }

  // Retraso del sistema: si el pago se confirmó tarde, o la entrega llegó más de 1 h después del pago, el correo de pago
  // y el de entrega piden disculpas (un solo correo; no se manda aparte la disculpa).
  const slowDelivery = template === "delivered" && !!order.paidAt && !!order.deliveredAt && order.deliveredAt.getTime() - order.paidAt.getTime() > APOLOGY_AFTER_MS;
  const late = (template === "payment_confirmed" || template === "delivered") && (slowDelivery || (await db.orderEvent.count({ where: { orderId, type: "PAYMENT_CONFIRMED_LATE" } })) > 0);
  // Premio del Top 3 del mes: pedido sin cobro.
  const prizeInfo = (order.itemSnapshot as { prize?: { period?: string; pos?: number } }).prize;
  const prizeMonth = prizeInfo?.period ? parsePeriodKey(prizeInfo.period)?.month : null;
  const prize = prizeInfo?.pos ? `puesto #${prizeInfo.pos} del Top 3 de ${prizeMonth ?? "el mes"}` : undefined;
  const email = orderEmail(await getBrand(), template, {
    late,
    prize,
    number: order.number,
    type: order.type,
    item: (order.itemSnapshot as { name?: string }).name ?? "Producto digital",
    // Clientes de otros países que pagan en dólares: lo que se les cobró (y su equivalente en pesos).
    total: prize ? "Premio · sin costo" : order.chargeCurrency && order.chargeAmount != null ? `${formatCharge(order.chargeAmount, order.chargeCurrency)} (≈ ${formatMoney(order.total, order.currency)})` : formatMoney(order.total, order.currency),
    playerId: order.playerId,
    link: orderLink(order),
    isTest: order.isTest,
    expiresAt: new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" }).format(order.expiresAt),
    isPass: order.type === "TOPUP" && (order.itemSnapshot as { diamonds?: number }).diamonds === 0,
    buyAgainUrl: extra.buyAgainUrl,
  });
  const r = await sendEmail(order.customerEmail, template, email);
  await db.notification.update({ where: { id: notification.id }, data: { status: r.status, sentAt: r.status === "SENT" ? new Date() : null, error: r.error ?? null } });
  // La disculpa ya fue en el correo de entrega: queda anotada para no mandarla otra vez por separado.
  if (late && template === "delivered") {
    await db.notification.create({ data: { orderId, channel: "email", recipient: order.customerEmail, template: "delay_apology", status: "SKIPPED", error: "Incluida en el correo de entrega" } }).catch(() => {});
  }
}

/** Una entrega que llega más de esto después del pago se considera demorada: el cliente recibe una disculpa. */
export const APOLOGY_AFTER_MS = 60 * 60_000;

/**
 * Disculpas por demora a pedidos ya entregados más de 1 h después del pago (p. ej. los que esperaron mientras el
 * mantenimiento estuvo detenido). Una sola vez por pedido; los que ya la recibieron en su correo de entrega no cuentan.
 * dryRun: solo dice a quiénes les llegaría.
 */
export async function sendDelayApologies(opts: { dryRun: boolean; days?: number }) {
  const since = new Date(Date.now() - (opts.days ?? 15) * 86400_000);
  const orders = await db.order.findMany({
    where: { type: "TOPUP", isTest: false, status: "DELIVERED", paidAt: { not: null }, deliveredAt: { gte: since }, notifications: { none: { template: "delay_apology" } } },
    select: { id: true, number: true, paidAt: true, deliveredAt: true },
    orderBy: { deliveredAt: "asc" },
    take: 200,
  });
  const due = orders.filter((o) => o.deliveredAt!.getTime() - o.paidAt!.getTime() > APOLOGY_AFTER_MS);
  if (!opts.dryRun) for (const o of due) await notifyOrder(o.id, "delay_apology");
  return due.map((o) => ({ number: o.number, paidAt: o.paidAt!, deliveredAt: o.deliveredAt! }));
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

/** Aviso al equipo por un problema de pago (uno por tipo y pedido: duplicate | voided | amount). */
export async function notifyStaffPaymentIssue(orderId: string, kind: "duplicate" | "voided" | "amount", title: string, reason: string) {
  const to = await staffInbox();
  if (!to) return;
  const order = await db.order.findUnique({ where: { id: orderId }, select: { id: true, number: true, itemSnapshot: true } });
  if (!order) return;
  const template = `staff_payment_${kind}`;
  try {
    await db.notification.create({ data: { orderId, channel: "email", recipient: to, template } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return;
    throw err;
  }
  const r = await sendEmail(
    to,
    template,
    staffPaymentIssueEmail(await getBrand(), { number: order.number, item: (order.itemSnapshot as { name?: string }).name ?? "Pedido", title, reason: reason.slice(0, 500), adminLink: adminEntryUrl(`/admin/pedidos/${order.id}`) }),
  );
  await db.notification.updateMany({ where: { orderId, template }, data: { status: r.status, sentAt: r.status === "SENT" ? new Date() : null, error: r.error ?? null } });
}

/**
 * Aviso urgente al equipo sobre un pedido (uno por tipo y pedido): «stuck» = pagado y sin entregar varios minutos;
 * «late» = la tienda confirmó el pago tarde (el cliente esperó).
 */
export async function notifyStaffOrderAlert(orderId: string, kind: "stuck" | "late", title: string, reason: string, note?: string) {
  const to = await staffInbox();
  if (!to) return;
  const order = await db.order.findUnique({ where: { id: orderId }, select: { id: true, number: true, itemSnapshot: true } });
  if (!order) return;
  const template = `staff_order_${kind}`;
  try {
    await db.notification.create({ data: { orderId, channel: "email", recipient: to, template } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return;
    throw err;
  }
  const r = await sendEmail(to, template, staffAlertEmail(await getBrand(), { title, reason: reason.slice(0, 600), number: order.number, item: (order.itemSnapshot as { name?: string }).name ?? "Pedido", adminLink: adminEntryUrl(`/admin/pedidos/${order.id}`), note }));
  await db.notification.updateMany({ where: { orderId, template }, data: { status: r.status, sentAt: r.status === "SENT" ? new Date() : null, error: r.error ?? null } });
}

/** Aviso urgente al equipo sobre la tienda (no un pedido): como mucho uno por hora por tipo, aunque la tienda se reinicie. */
export async function notifyStaffSystemAlert(key: string, title: string, reason: string, note?: string) {
  const to = await staffInbox();
  if (!to) return;
  const settingKey = `staffAlertAt:${key}`.slice(0, 60);
  const prev = await db.setting.findUnique({ where: { key: settingKey } });
  if (prev && Date.now() - Number(prev.value) < 3600_000) return;
  await db.setting.upsert({ where: { key: settingKey }, create: { key: settingKey, value: String(Date.now()) }, update: { value: String(Date.now()) } });
  await sendEmail(to, `staff_system_${key}`.slice(0, 60), staffAlertEmail(await getBrand(), { title, reason: reason.slice(0, 600), adminLink: adminEntryUrl("/admin/pedidos"), note }));
}

/** Cobro aprobado de un pedido que ya no existe en la tienda (p. ej. borrado por estar cancelado): revisar y devolver. */
export async function notifyStaffUnknownPayment(reference: string, amount: string, providerId: string) {
  const to = await staffInbox();
  if (!to) return;
  const r = await sendEmail(
    to,
    "staff_payment_unknown",
    staffPaymentIssueEmail(await getBrand(), {
      number: reference.slice(0, 40),
      item: `Cobro por ${amount}`,
      title: "Pago de un pedido que no existe",
      reason: `${providerId} confirmó un pago aprobado para la referencia ${reference.slice(0, 40)}, pero ese pedido ya no está en la tienda (se borró por estar cancelado o no existe). Revísalo en la pasarela y devuelve el dinero o crea la entrega a mano.`,
      adminLink: adminEntryUrl("/admin/pedidos"),
    }),
  );
  await db.notification.create({ data: { channel: "email", recipient: to, template: "staff_payment_unknown", status: r.status, sentAt: r.status === "SENT" ? new Date() : null, error: r.error ?? null } });
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
