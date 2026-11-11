/**
 * Top 3 del mes: reglas del mes (hora de Colombia), quién participa, orden y entrega del premio una sola vez.
 * Las pruebas con base de datos usan una base MySQL de PRUEBAS (nunca la real):
 *   TEST_DATABASE_URL=mysql://usuario:clave@localhost:3306/vanta_test npx vitest run tests/ranking.test.ts
 * Nada sale a internet: el proveedor de recargas es un doble de prueba.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const cfg = vi.hoisted(() => {
  const url = process.env.TEST_DATABASE_URL ?? "";
  const safe = /\/[^/?]*test[^/?]*(\?|$)/i.test(url);
  if (safe) process.env.DATABASE_URL = url;
  return { enabled: safe };
});

const fakes = vi.hoisted(() => ({
  notify: {
    notifyOrder: vi.fn(async () => {}),
    notifyStaffAccountSold: vi.fn(async () => {}),
    notifyStaffDeliveryIssue: vi.fn(async () => {}),
    notifyStaffPaymentIssue: vi.fn(async () => {}),
    notifyStaffUnknownPayment: vi.fn(async () => {}),
    notifyStaffOrderAlert: vi.fn(async () => {}),
    notifyStaffSystemAlert: vi.fn(async () => {}),
  },
  topup: {
    id: "fake",
    displayName: "Proveedor de prueba",
    simulated: false,
    retryCooldownMs: 15 * 60_000,
    mode: () => "production" as const,
    missingConfig: () => [],
    isEnabled: () => true,
    getProducts: vi.fn(),
    validatePlayer: vi.fn(),
    createTopUp: vi.fn(async () => ({ status: "SUCCESS" as const, providerRef: "prov-premio", simulated: false })),
    processDelivery: vi.fn(),
    getTransactionStatus: vi.fn(),
    handleWebhook: vi.fn(),
    healthCheck: vi.fn(),
  },
}));

vi.mock("@/server/notifications", () => fakes.notify);
vi.mock("@/server/integrations/topup", () => ({ activeTopUpProvider: () => fakes.topup, getTopUpProvider: () => fakes.topup, activeWholesale: () => null }));
vi.mock("@/server/chat", () => ({ postSystemMessage: vi.fn(async () => {}) }));
vi.mock("@/server/supplier", () => ({ checkPlayerRegion: vi.fn(), supplierRate: vi.fn(async () => ({ usdtCop: 4000 })), supplierRegionName: vi.fn(async () => "LATAM") }));
vi.mock("@/server/settings", () => ({
  getSettings: vi.fn(async () => ({ orderPrefix: "VT", topupRegions: "latam", rankingMode: "on", rankingMinCop: "120000", rankingPrizes: "2180,1060,520" })),
}));

import { db } from "@/lib/db";
import { compareRank, maskPlayer, parseMinCop, parsePeriodKey, parsePrizes, periodOf, previousPeriod } from "@/domain/ranking";
import { awardPrize, computeRanking, getPublicRanking, PRIZE_PROVIDER, prizeKey } from "@/server/ranking";

describe("Reglas del mes (hora de Colombia)", () => {
  it("el mes empieza a las 00:00 de Colombia (05:00 UTC)", () => {
    expect(periodOf(new Date("2026-11-01T04:59:59Z")).key).toBe("2026-10");
    expect(periodOf(new Date("2026-11-01T05:00:00Z")).key).toBe("2026-11");
    const nov = periodOf(new Date("2026-11-15T12:00:00Z"));
    expect(nov.start.toISOString()).toBe("2026-11-01T05:00:00.000Z");
    expect(nov.end.toISOString()).toBe("2026-12-01T05:00:00.000Z");
    expect(nov.month).toBe("noviembre");
    expect(previousPeriod(periodOf(new Date("2026-01-10T12:00:00Z"))).key).toBe("2025-12");
    expect(parsePeriodKey("2026-13")).toBeNull();
    expect(parsePeriodKey("2026-02")?.end.toISOString()).toBe("2026-03-01T05:00:00.000Z");
  });

  it("premios, mínimo, ID enmascarado y desempate", () => {
    expect(parsePrizes("")).toEqual([2180, 1060, 520]);
    expect(parsePrizes("5600,2180,1060")).toEqual([5600, 2180, 1060]);
    expect(parseMinCop("120.000")).toBe(120000);
    expect(maskPlayer("1234567890")).toBe("12****90");
    expect(maskPlayer("123")).toBeNull();
    const a = { total: 140000, lastPaidAt: new Date("2026-11-03T10:00:00Z") };
    const b = { total: 140000, lastPaidAt: new Date("2026-11-05T10:00:00Z") };
    const c = { total: 200000, lastPaidAt: new Date("2026-11-20T10:00:00Z") };
    expect([b, c, a].sort(compareRank)).toEqual([c, a, b]);
  });
});

describe("Sección del inicio", () => {
  it("dibuja puestos ocupados y libres, perseguidores e insignias, sin correos ni montos", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { createElement } = await import("react");
    const { TopMonth } = await import("@/components/store/top-month");
    const data = {
      month: "noviembre",
      endsAt: new Date(Date.now() + 3 * 86400_000).toISOString(),
      minCop: 120000,
      podium: [
        { pos: 1, player: "84****21", taken: true, prize: 2180 },
        { pos: 2, player: null, taken: false, prize: 1060 },
        { pos: 3, player: null, taken: false, prize: 520 },
      ],
      chasers: [],
    };
    const html = renderToStaticMarkup(createElement(TopMonth, { data }));
    expect(html).toContain("ID 84****21");
    expect(html.match(/Puesto libre/g)).toHaveLength(2);
    expect(html).toContain("2.180");
    expect(html).toContain("/legal/top-del-mes");
    expect(html).not.toMatch(/[\w.+-]+@[\w-]+\.[a-z]{2,}/);
    const full = renderToStaticMarkup(createElement(TopMonth, { data: { ...data, chasers: [{ pos: 4, player: "12****95" }] } }));
    expect(full).toContain("Persiguen el podio");
    expect(full).toContain("12****95");
  });
});

describe.skipIf(!cfg.enabled)("Ranking y premios (base de pruebas)", () => {
  const RUN = `rk${Date.now().toString(36)}`;
  // Un mes pasado y fijo: no se cruza con pedidos de otras pruebas.
  const period = parsePeriodKey("2019-03")!;
  const at = (day: number, hour = 12) => new Date(Date.UTC(2019, 2, day, hour + 5));
  const mail = (n: string) => `${n}.${RUN}@example.com`;
  let seq = 0;
  let adminId = "";
  const order = (email: string, total: number, paidAt: Date, extra: Record<string, unknown> = {}) =>
    db.order.create({
      data: {
        id: `ord_${RUN}_${++seq}`,
        number: `VT-${RUN}-${seq}`.toUpperCase(),
        type: "TOPUP",
        status: "DELIVERED",
        idempotencyKey: `idem-${RUN}-${seq}`,
        trackingToken: `tok-${RUN}-${seq}`,
        customerEmail: email,
        playerId: `9${String(seq).padStart(8, "0")}`,
        itemSnapshot: { kind: "TOPUP", name: "x", diamonds: 100, bonusDiamonds: 10 },
        subtotal: total,
        total,
        paymentProvider: "bold",
        expiresAt: paidAt,
        paidAt,
        deliveredAt: paidAt,
        ...extra,
      },
    });

  beforeAll(async () => {
    // Permiso de ofertas: A y E sin cuenta (contacto), B con cuenta; C no aceptó; D aceptó pero no llega al mínimo.
    await db.emailContact.createMany({ data: [mail("a"), mail("d"), `e${RUN}@gmail.com`, mail("f")].map((email) => ({ email, optIn: true, source: "prueba" })) });
    adminId = (await db.user.create({ data: { email: mail("b"), name: "B", passwordHash: "x", marketingOptIn: true } })).id;

    await order(mail("a"), 80_000, at(2));
    await order(mail("a"), 60_000, at(4)); // A: 140.000, llegó el día 4
    await order(mail("b"), 200_000, at(10)); // B: 200.000
    await order(mail("c"), 300_000, at(3)); // C: más que todos, pero no aceptó ofertas
    await order(mail("d"), 100_000, at(5)); // D: bajo el mínimo
    await order(`e.${RUN}@gmail.com`, 70_000, at(5)); // E (mismo Gmail, con punto y con +): 140.000, llegó el día 6
    await order(`e${RUN}+promo@gmail.com`, 70_000, at(6));
    // F: nada de esto cuenta.
    await order(mail("f"), 500_000, at(7), { isTest: true });
    await order(mail("f"), 500_000, at(7), { status: "REFUNDED" });
    await order(mail("f"), 0, at(7), { paymentProvider: PRIZE_PROVIDER });
    await order(mail("f"), 500_000, new Date(Date.UTC(2019, 3, 1, 5, 0, 0))); // 1 de abril, 00:00 en Colombia
    await order(mail("f"), 500_000, at(8), { status: "PENDING_PAYMENT", paidAt: null });

    await db.diamondPackage.create({ data: { slug: `premio-${RUN}`, name: "2180 diamantes", diamonds: 2180, bonusDiamonds: 218, price: 64999, region: "latam", providerSku: `sku-${RUN}`, active: true } });
  });

  afterAll(async () => {
    await db.order.deleteMany({ where: { OR: [{ id: { startsWith: `ord_${RUN}_` } }, { idempotencyKey: { startsWith: prizeKey(period.key, 0).slice(0, -1) } }] } });
    await db.emailContact.deleteMany({ where: { email: { contains: RUN } } });
    await db.user.deleteMany({ where: { email: { contains: RUN } } });
    await db.diamondPackage.deleteMany({ where: { slug: `premio-${RUN}` } });
    await db.auditLog.deleteMany({ where: { action: "ranking.prize" } });
    await db.$disconnect();
  });

  it("cuenta solo compras pagadas y entregadas del mes, agrupa el correo y respeta ofertas y mínimo", async () => {
    const rows = (await computeRanking(period)).filter((r) => r.key.includes(RUN));
    const byKey = Object.fromEntries(rows.map((r) => [r.key.split(".")[0].split("@")[0].replace(RUN, ""), r]));
    expect(rows.map((r) => r.total)).toEqual([300_000, 200_000, 140_000, 140_000, 100_000]);
    expect(byKey.c.qualifies).toBe(false); // no aceptó ofertas
    expect(byKey.d.qualifies).toBe(false); // bajo el mínimo
    expect(byKey.e.orders).toBe(2); // las dos variantes del mismo Gmail
    expect(rows.find((r) => r.key.startsWith("f"))).toBeUndefined(); // prueba, reembolso, premio, otro mes y sin pagar

    const winners = rows.filter((r) => r.qualifies);
    expect(winners.map((r) => r.email)).toEqual([mail("b"), mail("a"), `e${RUN}+promo@gmail.com`]); // A llegó antes que E
  });

  it("la vista pública solo lleva puestos e IDs enmascarados (nunca correos ni montos)", async () => {
    const pub = await getPublicRanking(new Date(Date.UTC(2019, 2, 20)));
    expect(pub).not.toBeNull();
    const json = JSON.stringify(pub);
    expect(json).not.toContain("@");
    expect(json).not.toContain("200000");
    expect(pub!.podium.map((p) => p.prize)).toEqual([2180, 1060, 520]);
    expect(pub!.podium.every((p) => !p.player || /^\d{2}\*{4}\d{2}$/.test(p.player) || p.player === "Jugador VANTAGG")).toBe(true);
  });

  it("el premio solo se entrega con el mes cerrado, sin cobro y una sola vez aunque se pulse dos veces", async () => {
    const early = await awardPrize({ periodKey: period.key, pos: 1, actorId: adminId }, at(20));
    expect(early.ok).toBe(false);

    const [first, second] = await Promise.all([
      awardPrize({ periodKey: period.key, pos: 1, actorId: adminId }),
      awardPrize({ periodKey: period.key, pos: 1, actorId: adminId }),
    ]);
    expect([first.ok, second.ok].filter(Boolean)).toHaveLength(1);
    expect(fakes.topup.createTopUp).toHaveBeenCalledTimes(1);

    const prize = await db.order.findUniqueOrThrow({ where: { idempotencyKey: prizeKey(period.key, 1) } });
    expect(prize.customerEmail).toBe(mail("b"));
    expect(prize.total).toBe(0);
    expect(prize.paymentProvider).toBe(PRIZE_PROVIDER);
    expect(prize.status).toBe("DELIVERED");
    expect(fakes.notify.notifyOrder).toHaveBeenCalledWith(prize.id, "ranking_prize");

    const again = await awardPrize({ periodKey: period.key, pos: 1, actorId: adminId });
    expect(again.ok).toBe(false);
    expect(fakes.topup.createTopUp).toHaveBeenCalledTimes(1);

    // El premio no suma al ranking.
    const rows = (await computeRanking(period)).filter((r) => r.key.includes(RUN));
    expect(rows.find((r) => r.email === mail("b"))?.total).toBe(200_000);
  });
});
