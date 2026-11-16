/**
 * Feed «Entregas en vivo» (BOOYAH!): los fragmentos y cajas Evo salen con su ícono, pero no cuentan en «Entregas hoy».
 *   TEST_DATABASE_URL=mysql://usuario:clave@localhost:3306/vanta_test npx vitest run tests/live-feed.test.ts
 */
import { afterAll, describe, expect, it, vi } from "vitest";

const cfg = vi.hoisted(() => {
  const url = process.env.TEST_DATABASE_URL ?? "";
  const safe = /\/[^/?]*test[^/?]*(\?|$)/i.test(url);
  if (safe) process.env.DATABASE_URL = url;
  return { enabled: safe };
});

import { db } from "@/lib/db";
import { getLiveDeliveries } from "@/server/catalog";

describe.skipIf(!cfg.enabled)("Entregas en vivo con Armas Evo (base de pruebas)", () => {
  const RUN = `lf${Date.now().toString(36)}`;
  const order = (i: number, itemSnapshot: Record<string, unknown>) =>
    db.order.create({
      data: {
        id: `${RUN}_${i}`, number: `LF-${RUN}-${i}`.toUpperCase(), type: "TOPUP", status: "DELIVERED", idempotencyKey: `${RUN}-${i}`, trackingToken: `${RUN}-token-${i}`,
        customerEmail: "cliente@example.com", playerId: `12345678${i}`, itemSnapshot: { kind: "TOPUP", region: "latam", ...itemSnapshot } as never, subtotal: 9999, total: 9999, currency: "COP",
        paymentProvider: "bold", expiresAt: new Date(), paidAt: new Date(Date.now() + i * 1000), deliveredAt: new Date(Date.now() + i * 1000 + 30_000),
      },
    });

  afterAll(async () => {
    await db.order.deleteMany({ where: { id: { startsWith: RUN } } });
    await db.$disconnect();
  });

  it("muestra fragmentos y cajas Evo con su marca y no los cuenta en «Entregas hoy»", async () => {
    const before = (await getLiveDeliveries(10)).stats.today;
    await order(1, { name: "572 diamantes", diamonds: 520, bonusDiamonds: 52 });
    await order(2, { name: "Tarjeta Semanal", diamonds: 0, bonusDiamonds: 0 });
    await order(3, { name: "100 Fragmentos de arma Evo", diamonds: 0, bonusDiamonds: 0 });
    await order(4, { name: "5 Cajas de fragmentos Evo", diamonds: 0, bonusDiamonds: 0 });
    const live = await getLiveDeliveries(10);
    const top = live.items.slice(0, 4).map((p) => [p.title ?? p.diamonds, p.evo]);
    expect(top).toEqual([
      ["5 Cajas de fragmentos Evo", true],
      ["100 Fragmentos de arma Evo", true],
      ["Tarjeta Semanal", false],
      [572, false],
    ]);
    expect(live.stats.today - before).toBe(2); // diamantes y tarjeta; los Evo no
  });
});
