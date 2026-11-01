/**
 * Borrado automático de pedidos cancelados sin pago, contra la base MySQL de PRUEBAS:
 *   TEST_DATABASE_URL=mysql://usuario:clave@localhost:3306/vanta_test npx vitest run tests/retention.test.ts
 */
import { afterAll, describe, expect, it, vi } from "vitest";

const cfg = vi.hoisted(() => {
  const url = process.env.TEST_DATABASE_URL ?? "";
  const safe = /\/[^/?]*test[^/?]*(\?|$)/i.test(url);
  if (safe) process.env.DATABASE_URL = url;
  return { enabled: safe };
});

import { db } from "@/lib/db";
import { purgeCancelledOrders } from "@/server/retention";

const RUN = Date.now().toString(36);
const NOW = new Date();
const H = 3600_000;
const email = (k: string) => `ret-${RUN}-${k}@example.com`;
let seq = 0;

async function cancelled(k: string, hoursAgo: number, opts: { mailHoursAgo?: number } = {}) {
  seq++;
  const at = new Date(NOW.getTime() - hoursAgo * H);
  const o = await db.order.create({
    data: {
      number: `RT-${RUN}-${seq}`.toUpperCase(), type: "TOPUP", status: "CANCELLED", idempotencyKey: `rt-${RUN}-${seq}`, trackingToken: `rt-token-${RUN}-${seq}`,
      customerEmail: email(k), playerId: "123456789", itemSnapshot: { kind: "TOPUP", name: "110 diamantes", diamonds: 100, bonusDiamonds: 10 },
      subtotal: 3999, total: 3999, currency: "COP", paymentProvider: "bold", createdAt: at, expiresAt: at, cancelledAt: at,
      events: { create: { type: "EXPIRED", message: "Venció.", actor: "SYSTEM" } },
    },
  });
  if (opts.mailHoursAgo != null) {
    const sent = new Date(NOW.getTime() - opts.mailHoursAgo * H);
    await db.notification.create({ data: { orderId: o.id, channel: "email", recipient: email(k), template: "order_recovery", status: "SENT", sentAt: sent, createdAt: sent } });
  }
  return o;
}

describe.skipIf(!cfg.enabled)("Borrado de pedidos cancelados sin pago (base de pruebas)", () => {
  afterAll(async () => {
    await db.supportTicket.deleteMany({ where: { email: { startsWith: `ret-${RUN}-` } } });
    await db.order.deleteMany({ where: { customerEmail: { startsWith: `ret-${RUN}-` } } });
    await db.notification.deleteMany({ where: { recipient: { startsWith: `ret-${RUN}-` } } });
    await db.user.deleteMany({ where: { email: { startsWith: `ret-${RUN}-` } } });
    await db.$disconnect();
  });

  it("borra 24 h después del correo (o 48 h sin correo) y conserva lo que tiene dinero o conversación", async () => {
    const mailed = await cancelled("correo-viejo", 40, { mailHoursAgo: 30 });
    const mailedRecent = await cancelled("correo-reciente", 20, { mailHoursAgo: 10 });
    const noMailOld = await cancelled("sin-correo-viejo", 60);
    const noMailRecent = await cancelled("sin-correo-reciente", 30);
    const paid = await cancelled("con-cobro", 60);
    await db.payment.create({ data: { orderId: paid.id, provider: "bold", providerRef: `rt-${RUN}-pay`, status: "VOIDED", amount: 3999, currency: "COP" } });
    const declined = await cancelled("rechazado", 60);
    await db.payment.create({ data: { orderId: declined.id, provider: "bold", providerRef: `rt-${RUN}-dec`, status: "DECLINED", amount: 3999, currency: "COP" } });
    const withTicket = await cancelled("con-soporte", 60);
    await db.supportTicket.create({ data: { orderId: withTicket.id, email: email("con-soporte"), topic: "pedido", message: "¿Qué pasó con mi pedido?" } as never });
    const customer = await db.user.create({ data: { email: email("correo-viejo"), passwordHash: "x", role: "CUSTOMER", marketingOptIn: true } });

    const dry = await purgeCancelledOrders({ now: NOW, dryRun: true });
    expect(dry.deleted).toBe(0);
    expect(await db.order.count({ where: { id: mailed.id } })).toBe(1);

    await purgeCancelledOrders({ now: NOW });
    const left = new Set((await db.order.findMany({ where: { customerEmail: { startsWith: `ret-${RUN}-` } }, select: { id: true } })).map((o) => o.id));
    expect(left.has(mailed.id)).toBe(false); // correo hace 30 h
    expect(left.has(noMailOld.id)).toBe(false); // sin correo, cancelado hace 60 h
    expect(left.has(declined.id)).toBe(false); // un pago rechazado no movió dinero
    expect(left.has(mailedRecent.id)).toBe(true); // correo hace 10 h: todavía no
    expect(left.has(noMailRecent.id)).toBe(true); // sin correo, cancelado hace 30 h: todavía no
    expect(left.has(paid.id)).toBe(true); // cobro anulado: historial de dinero
    expect(left.has(withTicket.id)).toBe(true); // tiene solicitud de soporte

    // Se borran también sus eventos; el cliente y el registro del correo enviado se quedan (sin el pedido).
    expect(await db.orderEvent.count({ where: { orderId: mailed.id } })).toBe(0);
    expect(await db.user.count({ where: { id: customer.id } })).toBe(1);
    const log = await db.notification.findFirstOrThrow({ where: { recipient: email("correo-viejo"), template: "order_recovery" } });
    expect(log.orderId).toBeNull();
    // Queda en la auditoría cuántos se borraron.
    expect(await db.auditLog.count({ where: { action: "orders.purge_cancelled", createdAt: { gte: new Date(NOW.getTime() - 60_000) } } })).toBeGreaterThan(0);
  });
});
