import "server-only";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { reminderState } from "./reminders";
import { getSettings } from "./settings";

/**
 * Borrado automático de pedidos cancelados sin pago (Panel → Ajustes → Pedidos cancelados):
 *  - 12 horas después de cancelarse, si ya recibió el correo «¿Aún quieres tus diamantes?»,
 *  - o si ese correo no le va a llegar (pedido de prueba, lo canceló el equipo, ya compró después, otro pedido
 *    suyo recibió el recordatorio, pidió no recibir correos, los correos automáticos están apagados…),
 *  - y a los 2 días en cualquier caso (el correo automático ya no se envía después de eso).
 * Del pedido borrado queda solo el CLIENTE (correo, ID de jugador, cuántos pedidos dejó sin pagar y la fecha del
 * último) para ver si compra después; sin su permiso no recibe ofertas. El registro de correos enviados se conserva
 * (sin el pedido) para no repetir recordatorios.
 * Nunca se borra un pedido con cobro aprobado o anulado, entrega, chat, notas del equipo o solicitudes de soporte:
 * esos son historial que puede hacer falta (reclamos, devoluciones, contabilidad).
 */

const HOUR = 3600_000;
export const PURGE_AFTER_CANCEL_H = 12;
/** Pasado este tiempo el correo automático ya no se envía (busca pedidos vencidos de los últimos 2 días). */
export const PURGE_ANYWAY_H = 48;
const PER_RUN = 200;

export type PurgeRun = { deleted: number; due: number; kept: number; waiting: number; customers: number; numbers: string[] };

export async function purgeCancelledOrders(opts: { now?: Date; dryRun?: boolean } = {}): Promise<PurgeRun> {
  const now = opts.now ?? new Date();
  const autoRecovery = (await getSettings()).autoRecovery !== "false";
  const candidates = await db.order.findMany({
    where: { status: "CANCELLED", cancelledAt: { lte: new Date(now.getTime() - PURGE_AFTER_CANCEL_H * HOUR) } },
    select: {
      id: true,
      number: true,
      customerEmail: true,
      playerId: true,
      isTest: true,
      createdAt: true,
      cancelledAt: true,
      payments: { select: { status: true } },
      delivery: { select: { id: true } },
      notifications: { where: { template: "order_recovery" }, select: { id: true } },
      _count: { select: { notes: true, tickets: true, messages: true, chatAttachments: true } },
    },
    orderBy: { cancelledAt: "asc" },
    take: 2000,
  });
  const due: typeof candidates = [];
  let kept = 0;
  let waiting = 0;
  for (const o of candidates) {
    // Historial que se conserva siempre.
    if (o.payments.some((p) => p.status === "APPROVED" || p.status === "VOIDED") || o.delivery || o._count.notes || o._count.tickets || o._count.messages || o._count.chatAttachments) {
      kept++;
      continue;
    }
    const mailed = o.notifications.length > 0;
    const old = o.cancelledAt!.getTime() <= now.getTime() - PURGE_ANYWAY_H * HOUR;
    // Sin correo todavía: se espera solo si el recordatorio sí le va a llegar.
    const pending = !mailed && !old && autoRecovery && !!(await reminderState(o.id, now).then((s) => s?.kind === "recovery" && s.canSend).catch(() => false));
    if (pending) {
      waiting++;
      continue;
    }
    due.push(o);
  }
  const batch = due.slice(0, PER_RUN);
  const run: PurgeRun = { deleted: 0, due: due.length, kept, waiting, customers: 0, numbers: batch.map((o) => o.number) };
  if (opts.dryRun || !batch.length) return run;

  // Antes de borrar: queda el cliente (sin permiso de ofertas si no lo dio; si ya lo dio o se dio de baja, no se toca).
  const byEmail = new Map<string, { count: number; last: Date; playerId: string | null }>();
  for (const o of batch) {
    if (o.isTest) continue;
    const email = o.customerEmail.trim().toLowerCase();
    if (!email.includes("@")) continue;
    const c = byEmail.get(email) ?? { count: 0, last: o.createdAt, playerId: null };
    c.count++;
    if (o.createdAt >= c.last) {
      c.last = o.createdAt;
      c.playerId = o.playerId ?? c.playerId;
    }
    byEmail.set(email, c);
  }
  for (const [email, c] of byEmail) {
    const playerId = c.playerId && /^\d{6,12}$/.test(c.playerId) ? c.playerId : null;
    const existing = await db.emailContact.findUnique({ where: { email }, select: { id: true, playerId: true, lastOrderAt: true } });
    if (existing) {
      await db.emailContact.update({
        where: { id: existing.id },
        data: { unpaidOrders: { increment: c.count }, ...(!existing.lastOrderAt || existing.lastOrderAt < c.last ? { lastOrderAt: c.last } : {}), ...(!existing.playerId && playerId ? { playerId } : {}) },
      });
    } else {
      await db.emailContact.create({ data: { email: email.slice(0, 191), playerId, optIn: false, source: "pedido-sin-pagar", unpaidOrders: c.count, lastOrderAt: c.last } });
    }
  }
  run.customers = byEmail.size;

  // Condición repetida en el borrado: si algo cambió (p. ej. llegó un pago), ese pedido no se toca.
  const r = await db.order.deleteMany({ where: { id: { in: batch.map((o) => o.id) }, status: "CANCELLED", delivery: { is: null }, payments: { none: { status: { in: ["APPROVED", "VOIDED"] } } } } });
  run.deleted = r.count;
  await audit({ actorId: null, action: "orders.purge_cancelled", entity: "Order", data: { deleted: r.count, customers: run.customers, numbers: run.numbers } });
  return run;
}
