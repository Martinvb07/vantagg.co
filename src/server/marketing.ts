import "server-only";
import { db } from "@/lib/db";
import { env, getAuthSecret } from "@/lib/env";
import { hmacSha256Hex, safeEqual } from "@/lib/crypto";
import { audit } from "@/lib/audit";
import { formatMoney } from "@/lib/money";
import { maintenanceNotice } from "@/domain/maintenance";
import { normalizePromoCode } from "@/domain/pricing";
import { marketingEmail, type MarketingKind } from "./email-templates";
import { getBrand, sendEmail } from "./notifications";
import { sendReminders } from "./reminders";
import { getSettings, saveSettings } from "./settings";

/**
 * Correos automáticos para atraer y recuperar clientes.
 *  - «Comprar de nuevo» (pedido que venció sin pagar): ver reminders.ts. Sale solo 1 hora después del vencimiento.
 *  - Ofertas a clientes registrados, SOLO si aceptaron recibirlas (Ley 1581: autorización previa y expresa),
 *    siempre con «Darte de baja» (enlace y cabecera List-Unsubscribe de un clic):
 *      · «Tu primera recarga te espera»: se registró hace más de 1 día y aún no compra (una vez).
 *      · «¿Te quedaste sin diamantes?»: lleva N días sin comprar (una vez por cada racha sin compras).
 * Límites: máximo un correo de ofertas por persona cada 7 días, solo entre 8 a. m. y 9 p. m. (Colombia),
 * nunca en modo mantenimiento y como mucho 30 correos por ejecución (el mantenimiento corre cada pocos minutos).
 */

const BOUGHT = ["PAID", "PROCESSING", "DELIVERED", "DELIVERY_FAILED", "REFUND_REQUESTED", "REFUNDED"] as const;
const MKT_TEMPLATES: Record<MarketingKind, string> = { first_purchase: "mkt_first_purchase", winback: "mkt_winback" };
const MKT_COOLDOWN_DAYS = 7;
const RUN_EVERY_MS = 10 * 60_000;
const PER_RUN = 30;
const DAY = 86400_000;
const UTM = (campaign: string) => `utm_source=correo&utm_medium=automatico&utm_campaign=${campaign}`;

// --- Consentimiento y baja --------------------------------------------------

/** Quién recibe el correo: una cuenta registrada («u») o un contacto sin cuenta que aceptó al pagar («c»). */
export type Recipient = "u" | "c";

/** Firma del enlace para darse de baja (no caduca: tiene que servir siempre). */
export function unsubscribeToken(id: string, who: Recipient = "u") {
  return hmacSha256Hex(getAuthSecret(), who === "u" ? `unsub:${id}` : `unsub:c:${id}`).slice(0, 32);
}

export function unsubscribeUrl(id: string, who: Recipient = "u") {
  return `${env.appUrl}/correos/baja?${who}=${encodeURIComponent(id)}&t=${unsubscribeToken(id, who)}`;
}

/** Dirección para la baja de un clic (cabecera List-Unsubscribe-Post): la misma firma, por POST. */
export function oneClickUnsubscribeUrl(id: string, who: Recipient = "u") {
  return `${env.appUrl}/api/correos/baja?${who}=${encodeURIComponent(id)}&t=${unsubscribeToken(id, who)}`;
}

export function validUnsubscribe(id: string, token: string, who: Recipient = "u") {
  return !!id && !!token && safeEqual(token, unsubscribeToken(id, who));
}

/** Acepta o rechaza los correos de ofertas. `source`: dónde lo decidió (queda en la auditoría como prueba). */
export async function setMarketingConsent(userId: string, optIn: boolean, source: string) {
  const now = new Date();
  await db.user.update({
    where: { id: userId },
    data: optIn ? { marketingOptIn: true, marketingConsentAt: now, marketingOptOutAt: null } : { marketingOptIn: false, marketingOptOutAt: now },
  });
  await audit({ actorId: userId, action: optIn ? "marketing.opt_in" : "marketing.opt_out", entity: "User", entityId: userId, data: { source } });
}

/** Lo mismo para un contacto sin cuenta (darse de baja o volver a aceptar desde el enlace del correo). */
export async function setContactConsent(contactId: string, optIn: boolean, source: string) {
  const now = new Date();
  await db.emailContact.update({ where: { id: contactId }, data: optIn ? { optIn: true, consentAt: now, optOutAt: null } : { optIn: false, optOutAt: now } });
  await audit({ actorId: null, action: optIn ? "marketing.opt_in" : "marketing.opt_out", entity: "EmailContact", entityId: contactId, data: { source } });
}

/**
 * Casilla «Avísame de ofertas» al pagar. Con sesión: queda en la cuenta. Sin cuenta: se guarda el contacto (correo e ID
 * del jugador), que se conserva aunque el pedido se borre después por no pagarse. Nunca bloquea la compra.
 */
export async function recordCheckoutConsent(p: { userId: string | null; email: string; playerId?: string | null; source: string }) {
  if (p.userId) {
    const u = await db.user.findUnique({ where: { id: p.userId }, select: { marketingOptIn: true } });
    if (u && !u.marketingOptIn) await setMarketingConsent(p.userId, true, p.source);
    return;
  }
  const email = p.email.trim().toLowerCase().slice(0, 191);
  const now = new Date();
  const c = await db.emailContact.upsert({
    where: { email },
    create: { email, playerId: p.playerId ?? null, optIn: true, consentAt: now, source: p.source },
    update: { optIn: true, consentAt: now, optOutAt: null, source: p.source, ...(p.playerId ? { playerId: p.playerId } : {}) },
  });
  await audit({ actorId: null, action: "marketing.opt_in", entity: "EmailContact", entityId: c.id, data: { source: p.source } });
}

// --- Código de descuento opcional ---------------------------------------------

/** El código de Ajustes, si existe y está vigente, ya descrito para el correo. */
export async function marketingPromo(code: string | null | undefined, now = new Date()) {
  const c = normalizePromoCode(code ?? "");
  if (!c) return null;
  const p = await db.promoCode.findUnique({ where: { code: c } });
  if (!p || !p.active || p.isDemo || (p.startsAt && p.startsAt > now) || (p.endsAt && p.endsAt < now) || (p.maxUses != null && p.uses >= p.maxUses) || p.scope === "ACCOUNT") return null;
  const text = p.discountType === "PERCENT" ? `${p.value} % de descuento` : `${formatMoney(p.value)} de descuento`;
  const until = p.endsAt ? new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", timeZone: "America/Bogota" }).format(p.endsAt) : undefined;
  return { code: p.code, text, until };
}

// --- Envío -------------------------------------------------------------------

type Candidate = { id: string; who: Recipient; email: string; name: string | null; ffPlayerId: string | null };

async function sendMarketing(u: Candidate, kind: MarketingKind, promo: Awaited<ReturnType<typeof marketingPromo>>) {
  const template = MKT_TEMPLATES[kind];
  const qs = new URLSearchParams();
  if (u.ffPlayerId) qs.set("id", u.ffPlayerId);
  const url = `${env.appUrl}/recargas?${qs.toString()}${qs.size ? "&" : ""}${UTM(kind === "first_purchase" ? "primera-recarga" : "te-extranamos")}`;
  const unsub = unsubscribeUrl(u.id, u.who);
  const email = marketingEmail(await getBrand(), kind, { name: u.name && u.name !== "No Name" ? u.name : null, playerId: u.ffPlayerId, url, promo, unsubscribeUrl: unsub });
  // Se registra antes de enviar: si dos procesos coinciden, el registro evita el doble envío en la siguiente vuelta.
  const n = await db.notification.create({ data: { channel: "email", recipient: u.email, template } });
  const r = await sendEmail(u.email, template, email, { headers: { "List-Unsubscribe": `<${oneClickUnsubscribeUrl(u.id, u.who)}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } });
  await db.notification.update({ where: { id: n.id }, data: { status: r.status, sentAt: r.status === "SENT" ? new Date() : null, error: r.error ?? null } });
}

/** ¿Recibió una oferta o un «comprar de nuevo» hace menos de 7 días? (No se le escribe dos veces seguidas.) */
async function recentlyMarketed(email: string, now: Date) {
  return (await db.notification.count({ where: { recipient: email, OR: [{ template: { startsWith: "mkt_" } }, { template: "order_recovery" }], createdAt: { gt: new Date(now.getTime() - MKT_COOLDOWN_DAYS * DAY) } } })) > 0;
}

/** Contactos sin cuenta que aceptaron ofertas (los correos que también tienen cuenta se manejan desde la cuenta). */
async function optedInContacts(where: { consentAt?: { lt: Date; gt: Date } } = {}) {
  const contacts = await db.emailContact.findMany({ where: { optIn: true, ...where }, select: { id: true, email: true, playerId: true }, take: 1000 });
  const users = new Set((await db.user.findMany({ where: { email: { in: contacts.map((c) => c.email) } }, select: { email: true } })).map((u) => u.email.toLowerCase()));
  return contacts.filter((c) => !users.has(c.email.toLowerCase())).map((c): Candidate => ({ id: c.id, who: "c", email: c.email, name: null, ffPlayerId: c.playerId }));
}

/** Registrados que aceptaron ofertas, se registraron hace 1 a 30 días y aún no compran. */
async function firstPurchaseCandidates(now: Date): Promise<Candidate[]> {
  const users = await db.user.findMany({
    where: { role: "CUSTOMER", disabled: false, marketingOptIn: true, createdAt: { lt: new Date(now.getTime() - DAY), gt: new Date(now.getTime() - 30 * DAY) } },
    select: { id: true, email: true, name: true, ffPlayerId: true },
    take: 300,
  });
  const people: Candidate[] = [...users.map((u) => ({ ...u, who: "u" as const })), ...(await optedInContacts({ consentAt: { lt: new Date(now.getTime() - DAY), gt: new Date(now.getTime() - 30 * DAY) } }))];
  const out: Candidate[] = [];
  for (const u of people) {
    const bought = await db.order.count({ where: { OR: [...(u.who === "u" ? [{ userId: u.id }] : []), { customerEmail: u.email }], isTest: false, status: { in: [...BOUGHT] } } });
    if (bought) continue;
    if (await db.notification.count({ where: { recipient: u.email, template: MKT_TEMPLATES.first_purchase } })) continue;
    if (await recentlyMarketed(u.email, now)) continue;
    out.push(u);
  }
  return out;
}

/** Registrados que aceptaron ofertas y llevan `days` días sin comprar (una vez por racha sin compras). */
async function winbackCandidates(now: Date, days: number): Promise<Candidate[]> {
  const users = await db.user.findMany({
    where: { role: "CUSTOMER", disabled: false, marketingOptIn: true },
    select: { id: true, email: true, name: true, ffPlayerId: true },
    take: 1000,
  });
  const people: Candidate[] = [...users.map((u) => ({ ...u, who: "u" as const })), ...(await optedInContacts())];
  const out: Candidate[] = [];
  for (const u of people) {
    const last = await db.order.findFirst({ where: { OR: [...(u.who === "u" ? [{ userId: u.id }] : []), { customerEmail: u.email }], isTest: false, status: { in: [...BOUGHT] } }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
    if (!last || last.createdAt > new Date(now.getTime() - days * DAY)) continue;
    // Ya se le escribió después de su última compra: no se repite hasta que vuelva a comprar.
    if (await db.notification.count({ where: { recipient: u.email, template: MKT_TEMPLATES.winback, createdAt: { gt: last.createdAt } } })) continue;
    // Tiene un pedido en curso: está comprando.
    if (await db.order.count({ where: { customerEmail: u.email, status: "PENDING_PAYMENT", expiresAt: { gt: now } } })) continue;
    if (await recentlyMarketed(u.email, now)) continue;
    out.push(u);
  }
  return out;
}

/** Hora de Colombia (0–23). */
const bogotaHour = (d: Date) => Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: "America/Bogota" }).format(d));

export type AutomationRun = { ran: boolean; reason?: string; recovery: number; firstPurchase: number; winback: number };

/**
 * Correos automáticos (lo llama el mantenimiento cada pocos minutos; aquí se limita a una vez cada 10 min).
 * `force`: ignora la espera de 10 min (pruebas y flujo manual). `dryRun`: solo cuenta.
 */
export async function runEmailAutomations(opts: { now?: Date; force?: boolean; dryRun?: boolean } = {}): Promise<AutomationRun> {
  const now = opts.now ?? new Date();
  const s = await getSettings();
  const empty = (reason: string): AutomationRun => ({ ran: false, reason, recovery: 0, firstPurchase: 0, winback: 0 });
  if (maintenanceNotice(s)) return empty("La tienda está en modo mantenimiento.");
  const hour = bogotaHour(now);
  if (!opts.dryRun && (hour < 8 || hour >= 21)) return empty("Fuera del horario de envío (8 a. m. a 9 p. m.).");
  if (!opts.force && !opts.dryRun && s.emailAutomationsAt && now.getTime() - new Date(s.emailAutomationsAt).getTime() < RUN_EVERY_MS) return empty("Ya se ejecutó hace menos de 10 minutos.");
  if (!opts.dryRun) await saveSettings({ emailAutomationsAt: now.toISOString() });

  const run: AutomationRun = { ran: true, recovery: 0, firstPurchase: 0, winback: 0 };
  let budget = PER_RUN;

  // 1) Comprar de nuevo: pedidos que vencieron sin pagar hace entre 1 hora y 2 días.
  if (s.autoRecovery === "true") {
    const r = await sendReminders({ kinds: ["recovery"], days: 2, minAgeMinutes: 60, dryRun: opts.dryRun, limit: budget, now });
    run.recovery = opts.dryRun ? r.recovery.candidates : r.recovery.sent;
    budget -= r.recovery.sent;
  }

  // 2) Ofertas (solo quien aceptó). Un mismo correo no recibe dos ofertas en la misma vuelta.
  const promo = await marketingPromo(s.marketingPromoCode, now);
  const used = new Set<string>();
  if (s.mktFirstPurchase === "true") {
    for (const u of await firstPurchaseCandidates(now)) {
      if (budget <= 0) break;
      used.add(u.email);
      run.firstPurchase++;
      if (!opts.dryRun) {
        await sendMarketing(u, "first_purchase", promo);
        budget--;
      }
    }
  }
  const days = Number(s.mktWinbackDays);
  if (days > 0) {
    for (const u of await winbackCandidates(now, days)) {
      if (budget <= 0) break;
      if (used.has(u.email)) continue;
      run.winback++;
      if (!opts.dryRun) {
        await sendMarketing(u, "winback", promo);
        budget--;
      }
    }
  }
  return run;
}

/** Números para el panel: quiénes aceptaron ofertas y qué se envió en los últimos 7 días. */
export async function marketingStats(now = new Date()) {
  const since = new Date(now.getTime() - 7 * DAY);
  const [customers, optedInUsers, contacts, sent] = await Promise.all([
    db.user.count({ where: { role: "CUSTOMER", disabled: false } }),
    db.user.count({ where: { role: "CUSTOMER", disabled: false, marketingOptIn: true } }),
    db.emailContact.count({ where: { optIn: true } }),
    db.notification.groupBy({ by: ["template"], where: { createdAt: { gte: since }, status: "SENT", template: { in: ["order_recovery", "payment_reminder", MKT_TEMPLATES.first_purchase, MKT_TEMPLATES.winback] } }, _count: { _all: true } }),
  ]);
  const count = (t: string) => sent.find((x) => x.template === t)?._count._all ?? 0;
  return { customers, optedIn: optedInUsers + contacts, optedInUsers, contacts, last7: { payment: count("payment_reminder"), recovery: count("order_recovery"), firstPurchase: count(MKT_TEMPLATES.first_purchase), winback: count(MKT_TEMPLATES.winback) } };
}
