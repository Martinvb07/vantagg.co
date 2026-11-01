import "server-only";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";

/**
 * Borrado automático de pedidos cancelados sin pago (Panel → Ajustes → Pedidos cancelados).
 *  - Si recibió el correo «¿Aún quieres tus diamantes?»: se borra 24 horas después de ese correo.
 *  - Si no le correspondía correo (ya compró, pedido de prueba, lo canceló el equipo…): 48 horas después de cancelarse
 *    (cuando ya pasó la ventana del correo automático).
 * Nunca se borra un pedido con cobro aprobado o anulado, entrega, chat, notas del equipo o solicitudes de soporte:
 * esos son historial que puede hacer falta (reclamos, devoluciones, contabilidad).
 * Los enlaces de pago de Bold vencen con el pedido, así que un pedido cancelado ya no puede recibir un pago.
 * Los clientes no se borran: las cuentas registradas y los contactos que aceptaron ofertas quedan para los correos,
 * y el registro de correos enviados (sin el pedido) se conserva para no repetir recordatorios.
 */

const HOUR = 3600_000;
export const PURGE_AFTER_EMAIL_H = 24;
export const PURGE_WITHOUT_EMAIL_H = 48;
const PER_RUN = 200;

export type PurgeRun = { deleted: number; due: number; kept: number; numbers: string[] };

export async function purgeCancelledOrders(opts: { now?: Date; dryRun?: boolean } = {}): Promise<PurgeRun> {
  const now = opts.now ?? new Date();
  const candidates = await db.order.findMany({
    where: { status: "CANCELLED", cancelledAt: { lte: new Date(now.getTime() - PURGE_AFTER_EMAIL_H * HOUR) } },
    select: {
      id: true,
      number: true,
      cancelledAt: true,
      payments: { select: { status: true } },
      delivery: { select: { id: true } },
      notifications: { where: { template: "order_recovery" }, select: { sentAt: true, createdAt: true } },
      _count: { select: { notes: true, tickets: true, messages: true, chatAttachments: true } },
    },
    orderBy: { cancelledAt: "asc" },
    take: 2000,
  });
  const due: typeof candidates = [];
  let kept = 0;
  for (const o of candidates) {
    // Historial que se conserva siempre.
    if (o.payments.some((p) => p.status === "APPROVED" || p.status === "VOIDED") || o.delivery || o._count.notes || o._count.tickets || o._count.messages || o._count.chatAttachments) {
      kept++;
      continue;
    }
    const mail = o.notifications[0];
    const after = mail ? (mail.sentAt ?? mail.createdAt).getTime() + PURGE_AFTER_EMAIL_H * HOUR : o.cancelledAt!.getTime() + PURGE_WITHOUT_EMAIL_H * HOUR;
    if (after <= now.getTime()) due.push(o);
  }
  const batch = due.slice(0, PER_RUN);
  const run: PurgeRun = { deleted: 0, due: due.length, kept, numbers: batch.map((o) => o.number) };
  if (opts.dryRun || !batch.length) return run;
  // Condición repetida en el borrado: si algo cambió (p. ej. llegó un pago), ese pedido no se toca.
  const r = await db.order.deleteMany({ where: { id: { in: batch.map((o) => o.id) }, status: "CANCELLED", delivery: { is: null }, payments: { none: { status: { in: ["APPROVED", "VOIDED"] } } } } });
  run.deleted = r.count;
  await audit({ actorId: null, action: "orders.purge_cancelled", entity: "Order", data: { deleted: r.count, numbers: run.numbers } });
  return run;
}
