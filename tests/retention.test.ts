/**
 * Borrado automático de pedidos cancelados sin pago, contra la base MySQL de PRUEBAS:
 *   TEST_DATABASE_URL=mysql://usuario:clave@localhost:3306/vanta_test npx vitest run tests/retention.test.ts
 * Regla: 12 h después de cancelarse, ya enviado el correo «¿Aún quieres tus diamantes?» (o si no le tocaba);
 * del pedido queda solo el cliente.
 */
import { afterAll, describe, expect, it, vi } from "vitest";

const cfg = vi.hoisted(() => {
  const url = process.env.TEST_DATABASE_URL ?? "";
  const safe = /\/[^/?]*test[^/?]*(\?|$)/i.test(url);
  if (safe) process.env.DATABASE_URL = url;
  return { enabled: safe, settings: { autoRecovery: "true" } as Record<string, string> };
});

vi.mock("@/server/settings", () => ({ getSettings: vi.fn(async () => ({ ...cfg.settings })) }));

import { db } from "@/lib/db";
import { purgeCancelledOrders } from "@/server/retention";

const RUN = Date.now().toString(36);
const NOW = new Date();
const H = 3600_000;
const email = (k: string) => `ret-${RUN}-${k}@example.com`;
let seq = 0;

async function cancelled(k: string, hoursAgo: number, opts: { mailHoursAgo?: number; expired?: boolean; isTest?: boolean; playerId?: string } = {}) {
  seq++;
  const at = new Date(NOW.getTime() - hoursAgo * H);
  const o = await db.order.create({
    data: {
      number: `RT-${RUN}-${seq}`.toUpperCase(), type: "TOPUP", status: "CANCELLED", idempotencyKey: `rt-${RUN}-${seq}`, trackingToken: `rt-token-${RUN}-${seq}`,
      customerEmail: email(k), playerId: opts.playerId ?? "123456789", isTest: opts.isTest ?? false, itemSnapshot: { kind: "TOPUP", name: "110 diamantes", diamonds: 100, bonusDiamonds: 10, region: "latam" },
      subtotal: 3999, total: 3999, currency: "COP", paymentProvider: "bold", createdAt: new Date(at.getTime() - H), expiresAt: at, cancelledAt: at,
      // Vencido por falta de pago (EXPIRED); sin ese evento es un pedido que canceló el equipo (no le toca correo).
      ...(opts.expired === false ? {} : { events: { create: { type: "EXPIRED", message: "Venció.", actor: "SYSTEM" } } }),
    },
  });
  if (opts.mailHoursAgo != null) {
    const sent = new Date(NOW.getTime() - opts.mailHoursAgo * H);
    await db.notification.create({ data: { orderId: o.id, channel: "email", recipient: email(k), template: "order_recovery", status: "SENT", sentAt: sent, createdAt: sent } });
  }
  return o;
}

const exists = async (id: string) => (await db.order.count({ where: { id } })) === 1;

describe.skipIf(!cfg.enabled)("Borrado de pedidos cancelados sin pago (base de pruebas)", () => {
  afterAll(async () => {
    await db.supportTicket.deleteMany({ where: { email: { startsWith: `ret-${RUN}-` } } });
    await db.order.deleteMany({ where: { customerEmail: { startsWith: `ret-${RUN}-` } } });
    await db.notification.deleteMany({ where: { recipient: { startsWith: `ret-${RUN}-` } } });
    await db.emailContact.deleteMany({ where: { email: { startsWith: `ret-${RUN}-` } } });
    await db.user.deleteMany({ where: { email: { startsWith: `ret-${RUN}-` } } });
    await db.$disconnect();
  });

  it("borra a las 12 h si ya le llegó el correo (o si no le tocaba) y conserva lo que tiene dinero o conversación", async () => {
    const mailed = await cancelled("correo", 13, { mailHoursAgo: 11, playerId: "611111111" });
    const tooSoon = await cancelled("reciente", 10, { mailHoursAgo: 9 });
    const waitingMail = await cancelled("espera-correo", 14); // le toca el correo y todavía no sale: espera
    const staff = await cancelled("cancelado-equipo", 14, { expired: false }); // no le toca correo: se borra
    const old = await cancelled("viejo", 50); // pasaron 2 días: el correo ya no sale
    const testOrder = await cancelled("prueba", 13, { isTest: true });
    const voided = await cancelled("con-cobro", 60);
    await db.payment.create({ data: { orderId: voided.id, provider: "bold", providerRef: `rt-${RUN}-pay`, status: "VOIDED", amount: 3999, currency: "COP" } });
    const declined = await cancelled("rechazado", 13, { mailHoursAgo: 12 });
    await db.payment.create({ data: { orderId: declined.id, provider: "bold", providerRef: `rt-${RUN}-dec`, status: "DECLINED", amount: 3999, currency: "COP" } });
    const withTicket = await cancelled("con-soporte", 60);
    await db.supportTicket.create({ data: { orderId: withTicket.id, email: email("con-soporte"), topic: "pedido", message: "¿Qué pasó con mi pedido?" } as never });
    const user = await db.user.create({ data: { email: email("correo"), passwordHash: "x", role: "CUSTOMER" } });
    // Clientes que ya existían: uno aceptó ofertas y otro se dio de baja (eso no se toca).
    await db.emailContact.create({ data: { email: email("rechazado"), optIn: true, consentAt: NOW, source: "checkout-recarga", unpaidOrders: 2 } });
    await db.emailContact.create({ data: { email: email("viejo"), optIn: false, optOutAt: NOW, source: "checkout-recarga" } });

    const dry = await purgeCancelledOrders({ now: NOW, dryRun: true });
    expect(dry.deleted).toBe(0);
    expect(dry.waiting).toBeGreaterThanOrEqual(1);
    expect(await exists(mailed.id)).toBe(true);

    const r = await purgeCancelledOrders({ now: NOW });
    expect(await exists(mailed.id)).toBe(false); // cancelado hace 13 h y ya recibió el correo
    expect(await exists(staff.id)).toBe(false); // no le tocaba correo
    expect(await exists(old.id)).toBe(false); // pasaron 2 días
    expect(await exists(testOrder.id)).toBe(false); // de prueba
    expect(await exists(declined.id)).toBe(false); // un pago rechazado no movió dinero
    expect(await exists(tooSoon.id)).toBe(true); // hace 10 h: todavía no
    expect(await exists(waitingMail.id)).toBe(true); // espera su correo
    expect(await exists(voided.id)).toBe(true); // cobro anulado: historial de dinero
    expect(await exists(withTicket.id)).toBe(true); // solicitud de soporte
    expect(r.customers).toBeGreaterThanOrEqual(4);

    // Queda solo el cliente: correo, ID, cuántos dejó sin pagar y la fecha del último; sin permiso de ofertas.
    const c = await db.emailContact.findUniqueOrThrow({ where: { email: email("correo") } });
    expect(c).toMatchObject({ optIn: false, consentAt: null, source: "pedido-sin-pagar", unpaidOrders: 1, playerId: "611111111" });
    expect(c.lastOrderAt?.getTime()).toBe(mailed.createdAt.getTime());
    // Quien ya había aceptado ofertas sigue aceptándolas (se suma el pedido); quien se dio de baja sigue de baja.
    expect(await db.emailContact.findUniqueOrThrow({ where: { email: email("rechazado") } })).toMatchObject({ optIn: true, unpaidOrders: 3 });
    expect(await db.emailContact.findUniqueOrThrow({ where: { email: email("viejo") } })).toMatchObject({ optIn: false, unpaidOrders: 1 });
    expect((await db.emailContact.findUniqueOrThrow({ where: { email: email("viejo") } })).optOutAt).not.toBeNull();
    // Pedido de prueba: no deja cliente.
    expect(await db.emailContact.count({ where: { email: email("prueba") } })).toBe(0);

    // Sus eventos se van; la cuenta registrada y el registro del correo enviado se quedan (sin el pedido).
    expect(await db.orderEvent.count({ where: { orderId: mailed.id } })).toBe(0);
    expect(await db.user.count({ where: { id: user.id } })).toBe(1);
    const log = await db.notification.findFirstOrThrow({ where: { recipient: email("correo"), template: "order_recovery" } });
    expect(log.orderId).toBeNull();
    expect(await db.auditLog.count({ where: { action: "orders.purge_cancelled", createdAt: { gte: new Date(NOW.getTime() - 60_000) } } })).toBeGreaterThan(0);
  });

  it("con los correos automáticos apagados no espera el correo: se borra a las 12 h", async () => {
    const o = await cancelled("sin-automaticos", 13);
    cfg.settings.autoRecovery = "false";
    try {
      await purgeCancelledOrders({ now: NOW });
    } finally {
      cfg.settings.autoRecovery = "true";
    }
    expect(await exists(o.id)).toBe(false);
    expect(await db.emailContact.findUniqueOrThrow({ where: { email: email("sin-automaticos") } })).toMatchObject({ optIn: false, unpaidOrders: 1 });
  });
});
