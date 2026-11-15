/**
 * Contabilidad por fechas y búsqueda de pedidos por fecha. Las pruebas con base de datos usan la base de PRUEBAS:
 *   TEST_DATABASE_URL=mysql://usuario:clave@localhost:3306/vanta_test npx vitest run tests/accounting.test.ts
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const cfg = vi.hoisted(() => {
  const url = process.env.TEST_DATABASE_URL ?? "";
  const safe = /\/[^/?]*test[^/?]*(\?|$)/i.test(url);
  if (safe) process.env.DATABASE_URL = url;
  return { enabled: safe };
});

vi.mock("@/server/notifications", () => ({
  notifyOrder: vi.fn(async () => {}),
  notifyStaffAccountSold: vi.fn(async () => {}),
  notifyStaffDeliveryIssue: vi.fn(async () => {}),
  notifyStaffPaymentIssue: vi.fn(async () => {}),
  notifyStaffUnknownPayment: vi.fn(async () => {}),
  notifyStaffOrderAlert: vi.fn(async () => {}),
  notifyStaffSystemAlert: vi.fn(async () => {}),
}));
vi.mock("@/server/integrations/topup", () => ({ activeTopUpProvider: () => null, getTopUpProvider: () => null, activeWholesale: () => null }));
vi.mock("@/server/chat", () => ({ postSystemMessage: vi.fn(async () => {}) }));
vi.mock("@/server/supplier", () => ({ checkPlayerRegion: vi.fn(), supplierRate: vi.fn(async () => ({ usdtCop: 4000 })), supplierRegionName: vi.fn(async () => "LATAM") }));
vi.mock("@/server/settings", () => ({ getSettings: vi.fn(async () => ({ orderPrefix: "VT", cashFeePct: "3", cashFeeFixed: "" })) }));

import { db } from "@/lib/db";
import { bogotaYmd, changePct, monthRange, periodLabel, presetPeriod, previousPeriod, resolvePeriod, summarizeAccounting } from "@/domain/accounting";
import { orderSort, orderWhere } from "@/server/admin-filters";
import { accountingSummary, ledgerOrders } from "@/server/accounting";
import { transitionOrder } from "@/server/orders";

// Domingo 15 de noviembre de 2026, 12:00 en Colombia.
const NOW = new Date("2026-11-15T17:00:00Z");

describe("Periodos (hora de Colombia)", () => {
  it("atajos: hoy, ayer, semana, mes, mes pasado, 30 días y año", () => {
    const r = (k: Parameters<typeof presetPeriod>[0]) => {
      const p = presetPeriod(k, NOW);
      return `${p.fromYmd}..${p.toYmd}`;
    };
    expect(r("hoy")).toBe("2026-11-15..2026-11-15");
    expect(r("ayer")).toBe("2026-11-14..2026-11-14");
    expect(r("semana")).toBe("2026-11-09..2026-11-15"); // lunes a hoy
    expect(r("mes")).toBe("2026-11-01..2026-11-15");
    expect(r("mes-pasado")).toBe("2026-10-01..2026-10-31");
    expect(r("30d")).toBe("2026-10-17..2026-11-15");
    expect(r("anio")).toBe("2026-01-01..2026-11-15");
    const mes = presetPeriod("mes", NOW);
    expect(mes.start.toISOString()).toBe("2026-11-01T05:00:00.000Z");
    expect(mes.end.toISOString()).toBe("2026-11-16T05:00:00.000Z");
    expect(mes.days).toBe(15);
    // 30 de noviembre a las 10 p. m. en Colombia ya es 1 de diciembre en UTC: sigue siendo noviembre.
    expect(presetPeriod("hoy", new Date("2026-12-01T03:00:00Z")).fromYmd).toBe("2026-11-30");
    expect(presetPeriod("mes-pasado", new Date("2027-01-10T15:00:00Z")).fromYmd).toBe("2026-12-01");
    expect(presetPeriod("mes-pasado", new Date("2027-01-10T15:00:00Z")).toYmd).toBe("2026-12-31");
  });

  it("fechas a mano, periodo anterior y nombres", () => {
    expect(resolvePeriod({}, NOW).preset).toBe("mes");
    expect(resolvePeriod({ p: "ayer" }, NOW).fromYmd).toBe("2026-11-14");
    const swapped = resolvePeriod({ desde: "2026-11-10", hasta: "2026-11-03" }, NOW);
    expect([swapped.fromYmd, swapped.toYmd, swapped.days]).toEqual(["2026-11-03", "2026-11-10", 8]);
    expect(resolvePeriod({ desde: "2026-11-05" }, NOW).toYmd).toBe("2026-11-15");
    expect(resolvePeriod({ desde: "basura" }, NOW).preset).toBe("mes");
    const prev = previousPeriod(presetPeriod("mes", NOW));
    expect([prev.fromYmd, prev.toYmd]).toEqual(["2026-10-17", "2026-10-31"]);
    expect(periodLabel("2026-11-01", "2026-11-15")).toBe("1 nov – 15 nov 2026");
    expect(periodLabel("2026-11-15", "2026-11-15")).toBe("15 nov 2026");
    expect(periodLabel("2025-12-20", "2026-01-05")).toBe("20 dic 2025 – 5 ene 2026");
    expect(monthRange("2028-02")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
    expect(bogotaYmd(new Date("2026-11-02T03:00:00Z"))).toBe("2026-11-01");
    expect(changePct(150, 100)).toBe(50);
    expect(changePct(50, 0)).toBeNull();
  });
});

describe("Cálculos de la contabilidad", () => {
  const period = { fromYmd: "2026-11-01", toYmd: "2026-11-03", days: 3 };
  const sale = (paidAt: string, total: number, extra: Partial<Parameters<typeof summarizeAccounting>[0]["sales"][number]> = {}) => ({
    paidAt: new Date(paidAt),
    subtotal: total,
    discount: 0,
    total,
    type: "TOPUP" as const,
    name: "1060 diamantes",
    costCents: 1000,
    usdtCop: null,
    provider: "bold",
    method: "PSE",
    buyer: "a@x.co",
    ...extra,
  });

  it("ventas por día de pago (hora de Colombia), reembolsos, premios, comisión y ganancia", () => {
    const s = summarizeAccounting({
      period,
      sales: [
        sale("2026-11-02T03:00:00Z", 50_000), // 1 nov, 10 p. m. en Colombia
        sale("2026-11-02T15:00:00Z", 30_000, { subtotal: 35_000, discount: 5_000, costCents: 500, usdtCop: 3800, method: "NEQUI", buyer: "b@x.co" }),
        sale("2026-11-03T15:00:00Z", 100_000, { type: "ACCOUNT", name: "Cuenta", costCents: null }),
      ],
      refunds: [
        { refundedAt: new Date("2026-11-03T16:00:00Z"), total: 40_000, type: "TOPUP", costCents: 800, usdtCop: null, delivered: false }, // el costo vuelve
        { refundedAt: new Date("2026-11-03T17:00:00Z"), total: 20_000, type: "TOPUP", costCents: 400, usdtCop: null, delivered: true },
      ],
      prizes: [{ deliveredAt: new Date("2026-11-02T20:00:00Z"), costCents: 2000, usdtCop: 4100 }],
      fee: { pct: 3, fixed: 0 },
      usdtCop: 4000,
    });
    expect(s).toMatchObject({ orders: 3, buyers: 2, grossCop: 185_000, discountCop: 5_000, salesCop: 180_000, refunds: 2, refundsCop: 60_000, netCop: 120_000 });
    // Costo: 10 USD a la tasa actual (4.000) + 5 USD a la tasa guardada (3.800); la cuenta no tiene costo.
    expect(s.costCop).toBe(40_000 + 19_000);
    expect(s.costBackCop).toBe(32_000);
    expect(s.prizesCostCop).toBe(82_000);
    expect(s.feeCop).toBe(1500 + 900 + 3000);
    expect(s.profitCop).toBe(120_000 - 5400 - 59_000 + 32_000 - 82_000);
    expect(s.series.map((b) => [b.key, b.orders, b.salesCop, b.refundsCop])).toEqual([
      ["2026-11-01", 1, 50_000, 0],
      ["2026-11-02", 1, 30_000, 0],
      ["2026-11-03", 1, 100_000, 60_000],
    ]);
    // La ganancia por día suma lo mismo que el total.
    expect(s.series.reduce((n, b) => n + b.profitCop, 0)).toBe(s.profitCop);
    expect(s.byPayment.map((l) => l.label)).toEqual(["Bold · PSE", "Bold · Nequi"]);
    expect(s.byType.map((l) => [l.label, l.orders])).toEqual([
      ["Cuentas Free Fire", 1],
      ["Recargas de diamantes", 2],
    ]);
    expect(s.granularity).toBe("day");
    expect(summarizeAccounting({ period: { fromYmd: "2026-01-01", toYmd: "2026-11-15", days: 319 }, sales: [], refunds: [], prizes: [], fee: { pct: 0, fixed: 0 }, usdtCop: 4000 }).series.map((b) => b.key)).toHaveLength(11);
  });
});

describe("Pedidos: buscar por fecha de compra, de pago o de entrega", () => {
  it("usa la fecha elegida y ordena por ella", () => {
    expect(orderWhere({ desde: "2026-11-01", hasta: "2026-11-15" })).toMatchObject({ createdAt: { gte: new Date("2026-11-01T05:00:00Z"), lte: new Date("2026-11-16T04:59:59.999Z") } });
    expect(orderWhere({ fecha: "pagado", desde: "2026-11-01" })).toMatchObject({ paidAt: { not: null, gte: new Date("2026-11-01T05:00:00Z") } });
    expect(orderWhere({ fecha: "entregado" })).toMatchObject({ deliveredAt: { not: null } });
    expect(orderWhere({ fecha: "pagado", desde: "2026-11-01" }).createdAt).toBeUndefined();
    expect(orderSort({ fecha: "pagado" })[0]).toEqual({ paidAt: "desc" });
    expect(orderSort({ fecha: "pagado", orden: "actividad" })[0]).toEqual({ updatedAt: "desc" });
  });
});

describe.skipIf(!cfg.enabled)("Contabilidad con la base de pruebas", () => {
  const RUN = `ct${Date.now().toString(36)}`;
  // Un mes lejano para no cruzarse con otros datos de prueba.
  const at = (day: number, hour = 15) => new Date(Date.UTC(2031, 2, day, hour, 0, 0));
  let seq = 0;
  const ids: Record<string, string> = {};
  const order = async (key: string, o: { total: number; status?: string; paidAt?: Date | null; deliveredAt?: Date | null; refundedAt?: Date | null; provider?: string; isTest?: boolean; cost?: number; rate?: number }) => {
    seq += 1;
    const r = await db.order.create({
      data: {
        id: `ord_${RUN}_${seq}`,
        number: `VT-${RUN}-${seq}`.toUpperCase(),
        type: "TOPUP",
        status: (o.status ?? "DELIVERED") as "DELIVERED",
        isTest: o.isTest ?? false,
        idempotencyKey: `idem-${RUN}-${seq}`,
        trackingToken: `tok-${RUN}-${seq}`,
        customerEmail: `${key}.${RUN}@example.com`,
        itemSnapshot: { kind: "TOPUP", name: "1060 diamantes", costCents: o.cost ?? 1000, ...(o.rate ? { usdtCop: o.rate } : {}) },
        subtotal: o.total,
        total: o.total,
        paymentProvider: o.provider ?? "bold",
        expiresAt: at(1),
        paidAt: o.paidAt === undefined ? at(5) : o.paidAt,
        deliveredAt: o.deliveredAt === undefined ? at(5, 16) : o.deliveredAt,
        refundedAt: o.refundedAt ?? null,
        ...(o.deliveredAt !== null ? { delivery: { create: { provider: "fake", idempotencyKey: `dlv-${RUN}-${seq}`, status: "SUCCESS", simulated: false } } } : {}),
      },
    });
    ids[key] = r.id;
    return r;
  };

  beforeAll(async () => {
    await order("a", { total: 60_000, rate: 3900 });
    await order("b", { total: 40_000, paidAt: at(31, 4), deliveredAt: at(31, 4) }); // 30 de marzo, 11 p. m. en Colombia
    await order("devuelta", { total: 25_000, status: "REFUNDED", paidAt: at(2), deliveredAt: null, refundedAt: at(20) });
    await order("devuelta-abril", { total: 30_000, status: "REFUNDED", paidAt: at(10), refundedAt: new Date(Date.UTC(2031, 3, 2, 15)) }); // reembolso en abril
    await order("premio", { total: 0, provider: "premio", deliveredAt: at(15), cost: 2000 });
    await order("prueba", { total: 999_000, isTest: true });
    await order("sinpagar", { total: 70_000, status: "PENDING_PAYMENT", paidAt: null, deliveredAt: null });
    await order("abril", { total: 80_000, paidAt: new Date(Date.UTC(2031, 3, 1, 5, 0, 0)) }); // 1 de abril, 00:00 en Colombia
    await order("pedido-reembolso", { total: 15_000, status: "REFUND_REQUESTED", deliveredAt: null });
  });

  afterAll(async () => {
    await db.order.deleteMany({ where: { id: { startsWith: `ord_${RUN}_` } } });
    await db.$disconnect();
  });

  it("marzo: ventas por fecha de pago, reembolsos por su fecha y premios por su entrega", async () => {
    const mar = resolvePeriod({ desde: "2031-03-01", hasta: "2031-03-31" });
    const { sales, refunds, prizes } = await ledgerOrders(mar);
    const mine = (list: { id: string }[]) => list.map((o) => o.id).filter((id) => id.includes(RUN)).sort();
    expect(mine(sales)).toEqual([ids.a, ids.b, ids.devuelta, ids["devuelta-abril"], ids["pedido-reembolso"]].sort());
    expect(mine(refunds)).toEqual([ids.devuelta]);
    expect(mine(prizes)).toEqual([ids.premio]);

    const s = await accountingSummary(mar);
    expect(s.salesCop).toBe(60_000 + 40_000 + 25_000 + 30_000 + 15_000);
    expect(s.refundsCop).toBe(25_000);
    expect(s.series.find((b) => b.key === "2031-03-30")?.salesCop).toBe(40_000);

    const apr = await accountingSummary(resolvePeriod({ desde: "2031-04-01", hasta: "2031-04-30" }));
    expect([apr.salesCop, apr.refundsCop]).toEqual([80_000, 30_000]);
  });

  it("marcar un pedido como reembolsado guarda la fecha del reembolso", async () => {
    const before = Date.now();
    const r = await transitionOrder(ids["pedido-reembolso"], "REFUNDED", "ADMIN:prueba", "Devuelto por PSE");
    expect(r.ok).toBe(true);
    const o = await db.order.findUniqueOrThrow({ where: { id: ids["pedido-reembolso"] } });
    expect(o.status).toBe("REFUNDED");
    expect(o.refundedAt!.getTime()).toBeGreaterThanOrEqual(before - 1000);
  });
});
