import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { maintenanceNotice } from "@/domain/maintenance";
import { notifyOrder } from "./notifications";
import { getSettings } from "./settings";

/**
 * Recordatorios por correo para quienes no terminaron de comprar:
 *  - «payment»: pedido que todavía se puede pagar → «Tu pedido te espera» con el enlace para pagar.
 *  - «recovery»: pedido que venció sin pagar → «¿Aún quieres tus diamantes?» con el ID ya escrito para comprar de nuevo.
 * Reglas para no molestar: un recordatorio de cada tipo por pedido, a lo sumo un «comprar de nuevo» por correo
 * cada 7 días, nunca a quien ya compró después, a quien tiene otro pedido en curso, a pedidos de prueba ni a
 * pedidos que canceló el equipo. En modo mantenimiento no se envía nada (no se puede comprar).
 */

const RECOVERY_COOLDOWN_DAYS = 7;
const BOUGHT = ["PAID", "PROCESSING", "DELIVERED", "DELIVERY_FAILED", "REFUND_REQUESTED", "REFUNDED"] as const;
const UTM = "utm_source=correo&utm_medium=recordatorio&utm_campaign=pedido-sin-pagar";

export type ReminderKind = "payment" | "recovery";
export type ReminderState = { kind: ReminderKind; canSend: boolean; reason?: string; sentAt?: Date | null };

const orderInclude = Prisma.validator<Prisma.OrderInclude>()({
  package: { select: { slug: true, active: true, available: true, supplierOutOfStock: true, region: true } },
  account: { select: { slug: true, status: true, reservedUntil: true } },
  events: { where: { type: { in: ["EXPIRED", "CHECKOUT_STARTED"] } }, select: { type: true } },
  notifications: { where: { template: { in: ["payment_reminder", "order_recovery"] } }, select: { template: true, sentAt: true, createdAt: true } },
});
type OrderForReminder = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

/** Enlace para comprar de nuevo: el mismo paquete (si sigue a la venta) con el ID ya escrito, o la misma cuenta. */
function buyAgainUrl(o: OrderForReminder): string | null {
  if (o.type === "ACCOUNT") return o.account ? `${env.appUrl}/cuentas/${o.account.slug}?${UTM}` : null;
  const snap = o.itemSnapshot as { region?: string };
  const p = new URLSearchParams();
  if (o.package?.active && o.package.available && !o.package.supplierOutOfStock) p.set("paquete", o.package.slug);
  if (o.playerId) p.set("id", o.playerId);
  const region = o.package?.region ?? snap.region;
  if (region) p.set("region", region);
  return `${env.appUrl}/recargas?${p.toString()}${p.size ? "&" : ""}${UTM}`;
}

/** Qué recordatorio le corresponde a un pedido y si se puede enviar ahora (sin mirar a otros pedidos del mismo correo). */
function ownState(o: OrderForReminder, now: Date): ReminderState | null {
  if (o.status === "PENDING_PAYMENT") {
    const sent = o.notifications.find((n) => n.template === "payment_reminder");
    if (sent) return { kind: "payment", canSend: false, reason: "Ya se envió el recordatorio de pago.", sentAt: sent.sentAt ?? sent.createdAt };
    if (o.isTest) return { kind: "payment", canSend: false, reason: "Es un pedido de prueba." };
    if (!o.events.some((e) => e.type === "CHECKOUT_STARTED")) return { kind: "payment", canSend: false, reason: "El cliente no llegó a la pasarela de pago." };
    if (o.expiresAt.getTime() < now.getTime() + 8 * 60_000) return { kind: "payment", canSend: false, reason: "Al pedido le quedan menos de 8 minutos para pagar." };
    return { kind: "payment", canSend: true };
  }
  if (o.status === "CANCELLED") {
    const sent = o.notifications.find((n) => n.template === "order_recovery");
    if (sent) return { kind: "recovery", canSend: false, reason: "Ya se envió el recordatorio para comprar de nuevo.", sentAt: sent.sentAt ?? sent.createdAt };
    if (o.isTest) return { kind: "recovery", canSend: false, reason: "Es un pedido de prueba." };
    if (!o.events.some((e) => e.type === "EXPIRED")) return { kind: "recovery", canSend: false, reason: "Lo canceló el equipo (no venció por falta de pago)." };
    if (o.type === "ACCOUNT" && !(o.account && o.account.status === "PUBLISHED" && !(o.account.reservedUntil && o.account.reservedUntil > now))) {
      return { kind: "recovery", canSend: false, reason: "La cuenta ya no está disponible." };
    }
    return { kind: "recovery", canSend: true };
  }
  return null;
}

/** Revisa los otros pedidos del mismo correo: si ya compró después, tiene uno en curso o ya recibió un recordatorio reciente. */
async function blockedByCustomer(o: OrderForReminder, kind: ReminderKind, now: Date): Promise<string | null> {
  const email = o.customerEmail;
  const bought = await db.order.count({ where: { customerEmail: email, isTest: false, status: { in: [...BOUGHT] }, createdAt: { gt: o.createdAt } } });
  if (bought) return "El cliente ya compró después de este pedido.";
  if (kind === "recovery") {
    // Quien pidió no recibir correos (se dio de baja de las ofertas) tampoco recibe «comprar de nuevo».
    const u = await db.user.findUnique({ where: { email }, select: { marketingOptIn: true, marketingOptOutAt: true } });
    if (u?.marketingOptOutAt && !u.marketingOptIn) return "Pidió no recibir correos.";
    const open = await db.order.count({ where: { customerEmail: email, id: { not: o.id }, status: "PENDING_PAYMENT", expiresAt: { gt: now } } });
    if (open) return "El cliente tiene otro pedido esperando pago.";
    const recent = await db.notification.count({ where: { recipient: email, template: "order_recovery", createdAt: { gt: new Date(now.getTime() - RECOVERY_COOLDOWN_DAYS * 86400_000) } } });
    if (recent) return `Ya recibió un recordatorio para comprar de nuevo en los últimos ${RECOVERY_COOLDOWN_DAYS} días.`;
  }
  return null;
}

/** Estado del recordatorio de un pedido (para el panel). null si a ese pedido no le corresponde ninguno. */
export async function reminderState(orderId: string, now = new Date()): Promise<ReminderState | null> {
  const o = await db.order.findUnique({ where: { id: orderId }, include: orderInclude });
  if (!o) return null;
  const own = ownState(o, now);
  if (!own || !own.canSend) return own;
  const blocked = await blockedByCustomer(o, own.kind, now);
  return blocked ? { ...own, canSend: false, reason: blocked } : own;
}

async function send(o: OrderForReminder, kind: ReminderKind) {
  if (kind === "payment") return notifyOrder(o.id, "payment_reminder");
  return notifyOrder(o.id, "order_recovery", { buyAgainUrl: buyAgainUrl(o) ?? undefined });
}

/** Envía el recordatorio que le toca a un pedido (botón del panel). */
export async function sendOrderReminder(orderId: string): Promise<{ ok: boolean; message: string }> {
  const paused = maintenanceNotice(await getSettings());
  if (paused) return { ok: false, message: "La tienda está en modo mantenimiento: no se envían recordatorios porque no se puede comprar." };
  const state = await reminderState(orderId);
  if (!state) return { ok: false, message: "A este pedido no le corresponde recordatorio (solo a los que esperan pago o vencieron sin pagar)." };
  if (!state.canSend) return { ok: false, message: state.reason ?? "No se puede enviar el recordatorio." };
  const o = (await db.order.findUnique({ where: { id: orderId }, include: orderInclude }))!;
  await send(o, state.kind);
  return { ok: true, message: state.kind === "payment" ? "Recordatorio de pago enviado." : "Recordatorio para comprar de nuevo enviado." };
}

export type ReminderRun = {
  payment: { candidates: number; sent: number };
  /** ages: días desde que venció cada pedido a recordar (para mostrar cuántos hay en 7, 14 o 30 días). */
  recovery: { candidates: number; sent: number; skipped: Record<string, number>; ages: number[] };
};

/**
 * Recordatorios en lote (botón del panel o flujo manual). `days`: pedidos vencidos en los últimos N días.
 * `dryRun`: solo cuenta. Un solo correo por persona: el de su pedido vencido más reciente.
 */
export async function sendReminders(opts: { kinds: ReminderKind[]; days: number; dryRun?: boolean; limit?: number; now?: Date; /** Solo pedidos vencidos hace al menos estos minutos (envío automático). */ minAgeMinutes?: number }): Promise<ReminderRun> {
  const now = opts.now ?? new Date();
  const limit = Math.min(Math.max(opts.limit ?? 200, 1), 500);
  const run: ReminderRun = { payment: { candidates: 0, sent: 0 }, recovery: { candidates: 0, sent: 0, skipped: {}, ages: [] } };
  if (!opts.dryRun && maintenanceNotice(await getSettings())) return run;
  let budget = limit;

  if (opts.kinds.includes("payment")) {
    // Esperando pago, con al menos 5 minutos (no se le escribe a quien está pagando en este momento).
    const pending = await db.order.findMany({
      where: { status: "PENDING_PAYMENT", isTest: false, expiresAt: { gt: new Date(now.getTime() + 8 * 60_000) }, createdAt: { lt: new Date(now.getTime() - 5 * 60_000) } },
      include: orderInclude,
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    for (const o of pending) {
      if (!ownState(o, now)?.canSend || (await blockedByCustomer(o, "payment", now))) continue;
      run.payment.candidates++;
      if (!opts.dryRun && budget > 0) {
        await send(o, "payment");
        run.payment.sent++;
        budget--;
      }
    }
  }

  if (opts.kinds.includes("recovery")) {
    const since = new Date(now.getTime() - Math.min(Math.max(opts.days, 1), 90) * 86400_000);
    const expired = await db.order.findMany({
      where: { status: "CANCELLED", isTest: false, cancelledAt: { gte: since, ...(opts.minAgeMinutes ? { lte: new Date(now.getTime() - opts.minAgeMinutes * 60_000) } : {}) } },
      include: orderInclude,
      orderBy: { createdAt: "desc" },
      take: 2000,
    });
    const seen = new Set<string>();
    const skip = (why: string) => (run.recovery.skipped[why] = (run.recovery.skipped[why] ?? 0) + 1);
    for (const o of expired) {
      const email = o.customerEmail.trim().toLowerCase();
      if (seen.has(email)) {
        skip("Otro pedido más reciente de la misma persona");
        continue;
      }
      seen.add(email);
      const own = ownState(o, now);
      if (!own?.canSend) {
        skip(own?.reason ?? "No corresponde");
        continue;
      }
      const blocked = await blockedByCustomer(o, "recovery", now);
      if (blocked) {
        skip(blocked);
        continue;
      }
      run.recovery.candidates++;
      run.recovery.ages.push(Math.floor((now.getTime() - (o.cancelledAt ?? o.createdAt).getTime()) / 86400_000));
      if (!opts.dryRun && budget > 0) {
        await send(o, "recovery");
        run.recovery.sent++;
        budget--;
        await new Promise((r) => setTimeout(r, 250)); // sin saturar el servicio de correo
      }
    }
  }
  return run;
}
