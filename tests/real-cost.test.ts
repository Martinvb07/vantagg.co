/**
 * Costo real y tasa del día: lo que cobró el proveedor en cada entrega, la tasa del dólar de cada día (mercado o TRM),
 * ganancia bruta y neta (con gastos) y el cuadre del capital. Base de PRUEBAS; nada sale a internet (fetch simulado).
 *   TEST_DATABASE_URL=mysql://usuario:clave@localhost:3306/vanta_test npx vitest run tests/real-cost.test.ts
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const cfg = vi.hoisted(() => {
  const url = process.env.TEST_DATABASE_URL ?? "";
  const safe = /\/[^/?]*test[^/?]*(\?|$)/i.test(url);
  if (safe) process.env.DATABASE_URL = url;
  return { enabled: safe };
});

const state = vi.hoisted(() => ({
  settings: { orderPrefix: "VT", cashFeePct: "3", cashFeeFixed: "", usdtCop: "4000", fxRates: "", fxHistoryAt: "", capitalCop: "", capitalSince: "" } as Record<string, string>,
  supplierCost: new Map<string, number>(),
}));

vi.mock("@/server/notifications", () => ({ notifyOrder: vi.fn(async () => {}) }));
vi.mock("@/server/chat", () => ({ postSystemMessage: vi.fn(async () => {}) }));
vi.mock("@/server/supplier", () => ({ supplierRate: vi.fn(async () => ({ usdtCop: 4000 })) }));
vi.mock("@/server/settings", () => ({
  getSettings: vi.fn(async () => ({ ...state.settings })),
  saveSettings: vi.fn(async (v: Record<string, string>) => Object.assign(state.settings, v)),
}));
vi.mock("@/server/integrations/topup", () => {
  const provider = {
    id: "centralone",
    simulated: false,
    wholesale: { name: "Central One", currency: "USD", balance: async () => ({ amount: 150.25, currency: "USD" }) },
    getTransactionStatus: vi.fn(async (ref: string) => ({ status: "SUCCESS", providerRef: ref, simulated: false, costCents: state.supplierCost.get(ref) ?? null })),
  };
  return { getTopUpProvider: (id: string) => (id === "centralone" ? provider : null), activeTopUpProvider: () => provider, activeWholesale: () => provider };
});

import { db } from "@/lib/db";
import { summarizeAccounting } from "@/domain/accounting";
import { mapCoOrder, saleAmountCents } from "@/server/integrations/topup/centralone-core";
import { costOf } from "@/server/order-cost";
import { accountingSummary, capitalStatus } from "@/server/accounting";
import { resolvePeriod } from "@/domain/accounting";
import { currentUsdCop, dayRates, ensureFxHistory } from "@/server/fx";
import { backfillDeliveryCosts } from "@/server/supplier-costs";

describe("Costo de cada venta", () => {
  it("usa lo que cobró el proveedor; si no, el guardado al vender; si no, el actual del paquete", () => {
    const base = { type: "TOPUP", itemSnapshot: { costCents: 900 }, delivery: { costCents: 945, simulated: false }, package: { costCents: 880 } };
    expect(costOf(base)).toEqual({ cents: 945, kind: "real" });
    expect(costOf({ ...base, delivery: { costCents: null, simulated: false } })).toEqual({ cents: 900, kind: "venta" });
    expect(costOf({ ...base, delivery: { costCents: 945, simulated: true } })).toEqual({ cents: 900, kind: "venta" }); // entrega simulada: no cuenta
    expect(costOf({ ...base, delivery: null, itemSnapshot: {} })).toEqual({ cents: 880, kind: "estimado" });
    expect(costOf({ ...base, delivery: null, itemSnapshot: {}, package: null })).toBeNull();
    expect(costOf({ ...base, type: "ACCOUNT" })).toBeNull();
  });

  it("Central One: total_sale_amount de un pedido completado es el costo real", () => {
    expect(saleAmountCents("9.4500")).toBe(945);
    expect(saleAmountCents("0")).toBeNull();
    expect(saleAmountCents(null)).toBeNull();
    expect(mapCoOrder({ id: "co-1", status: "completed", total_sale_amount: "18.9000", items: [{ id: "l1", status: "completed" }] })).toMatchObject({ status: "SUCCESS", costCents: 1890 });
    expect(mapCoOrder({ id: "co-2", status: "failed", total_sale_amount: "18.9000", items: [{ id: "l1", status: "failed" }] }).costCents).toBeUndefined();
  });

  it("ganancia bruta (ventas − costo) y neta (− comisión, premios y gastos)", () => {
    const s = summarizeAccounting({
      period: { fromYmd: "2026-11-01", toYmd: "2026-11-02", days: 2 },
      sales: [
        { paidAt: new Date("2026-11-01T15:00:00Z"), subtotal: 100_000, discount: 0, total: 100_000, type: "TOPUP", name: "x", costCents: 2000, costKind: "real", usdtCop: 3800, provider: "bold", method: "PSE", buyer: "a" },
        { paidAt: new Date("2026-11-02T15:00:00Z"), subtotal: 50_000, discount: 0, total: 50_000, type: "TOPUP", name: "x", costCents: 1000, costKind: "venta", usdtCop: 3900, provider: "bold", method: "PSE", buyer: "b" },
      ],
      refunds: [],
      prizes: [{ deliveredAt: new Date("2026-11-02T16:00:00Z"), costCents: 500, usdtCop: 3900 }],
      expenses: [
        { day: "2026-11-01", category: "Publicidad", amountCop: 20_000 },
        { day: "2026-11-02", category: "Publicidad", amountCop: 5_000 },
        { day: "2026-11-02", category: "Comisiones y bancos", amountCop: 1_000 },
      ],
      fee: { pct: 3, fixed: 0 },
      usdtCop: 4000,
    });
    // Costo a la tasa del día de cada venta: 20 USD × 3.800 + 10 USD × 3.900.
    expect(s.costCop).toBe(76_000 + 39_000);
    expect(s.grossProfitCop).toBe(150_000 - 115_000);
    expect(s.expensesCop).toBe(26_000);
    expect(s.expensesByCategory).toEqual([
      { label: "Publicidad", count: 2, cop: 25_000 },
      { label: "Comisiones y bancos", count: 1, cop: 1_000 },
    ]);
    expect(s.profitCop).toBe(35_000 - 4_500 - 19_500 - 26_000);
    expect(s.costKinds).toEqual({ real: 1, venta: 1, estimado: 0 });
    expect(s.series.reduce((n, b) => n + b.profitCop, 0)).toBe(s.profitCop);
  });
});

describe.skipIf(!cfg.enabled)("Costo real y tasa del día (base de pruebas)", () => {
  const RUN = `rc${Date.now().toString(36)}`;
  // Días lejanos para no cruzarse con otros datos de prueba.
  const at = (day: number, hour = 15) => new Date(Date.UTC(2032, 4, day, hour, 0, 0));
  const ids: Record<string, string> = {};
  let seq = 0;
  const order = async (key: string, o: { total: number; cost: number; paidAt: Date; ref?: string; realCost?: number }) => {
    seq += 1;
    const r = await db.order.create({
      data: {
        id: `ord_${RUN}_${seq}`,
        number: `VT-${RUN}-${seq}`.toUpperCase(),
        type: "TOPUP",
        status: "DELIVERED",
        idempotencyKey: `idem-${RUN}-${seq}`,
        trackingToken: `tok-${RUN}-${seq}`,
        customerEmail: `${key}.${RUN}@example.com`,
        itemSnapshot: { kind: "TOPUP", name: "1060 diamantes", costCents: o.cost, usdtCop: 3400 },
        subtotal: o.total,
        total: o.total,
        paymentProvider: "bold",
        expiresAt: o.paidAt,
        paidAt: o.paidAt,
        deliveredAt: o.paidAt,
        delivery: { create: { provider: "centralone", providerRef: o.ref ?? `co-${RUN}-${seq}`, idempotencyKey: `dlv-${RUN}-${seq}`, status: "SUCCESS", simulated: false, costCents: o.realCost ?? null } },
      },
    });
    ids[key] = r.id;
    return r;
  };
  const days = ["2032-05-01", "2032-05-02", "2032-05-03", "2032-05-04", "2032-05-05", "2032-05-06"];

  beforeAll(async () => {
    await db.fxDay.deleteMany({ where: { day: { in: days } } });
    await db.fxDay.create({ data: { day: "2032-05-02", copPerUsd: 3900, source: "mercado" } });
    await order("a", { total: 100_000, cost: 2000, paidAt: at(2), realCost: 2100 }); // costo real ya guardado
    await order("b", { total: 50_000, cost: 1000, paidAt: at(4), ref: `co-${RUN}-b` }); // costo real por recuperar
  });

  afterAll(async () => {
    await db.order.deleteMany({ where: { id: { startsWith: `ord_${RUN}_` } } });
    await db.fxDay.deleteMany({ where: { day: { in: days } } });
    await db.expense.deleteMany({ where: { concept: { contains: RUN } } });
    await db.$disconnect();
  });

  it("tasa del día: la de ese día o, si falta (fin de semana), la del último día con tasa", async () => {
    const m = await dayRates("2032-05-01", "2032-05-05");
    expect(m.get("2032-05-01")).toBeUndefined(); // antes de la primera tasa
    expect(m.get("2032-05-02")).toEqual({ rate: 3900, source: "mercado" });
    expect(m.get("2032-05-04")).toEqual({ rate: 3900, source: "mercado" });
    expect(await currentUsdCop()).toMatchObject({ rate: 4000, source: "configurada" });
    state.settings.fxRates = JSON.stringify({ at: new Date().toISOString(), rates: { COP: 3812.5 } });
    expect(await currentUsdCop()).toMatchObject({ rate: 3812.5, source: "mercado" });
    state.settings.fxRates = "";
  });

  it("los días pasados sin tasa se llenan con la TRM, sin tocar los de mercado", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify([
          { valor: "3950.10", vigenciadesde: "2032-05-01T00:00:00.000", vigenciahasta: "2032-05-01T00:00:00.000" },
          { valor: "3990.00", vigenciadesde: "2032-05-02T00:00:00.000", vigenciahasta: "2032-05-04T00:00:00.000" },
        ]),
      ),
    );
    const saved = await ensureFxHistory(new Date("2032-05-05T17:00:00Z"), { from: "2032-05-01" });
    expect(saved).toBe(3); // 1, 3 y 4 de mayo (el 2 ya tenía la de mercado)
    expect(String(fetchMock.mock.calls[0][0])).toContain("datos.gov.co");
    const rows = Object.fromEntries((await db.fxDay.findMany({ where: { day: { in: days } } })).map((r) => [r.day, `${r.copPerUsd} ${r.source}`]));
    expect(rows).toEqual({ "2032-05-01": "3950.1 TRM", "2032-05-02": "3900 mercado", "2032-05-03": "3990 TRM", "2032-05-04": "3990 TRM" });
    // Dentro de las 6 horas siguientes no vuelve a consultar.
    expect(await ensureFxHistory(new Date("2032-05-05T18:00:00Z"), { from: "2032-05-01" })).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockRestore();
  });

  it("recupera del proveedor el costo real de entregas anteriores (solo lectura)", async () => {
    state.supplierCost.set(`co-${RUN}-b`, 1080);
    const r = await backfillDeliveryCosts({ limit: 500 });
    expect(r.found).toBeGreaterThanOrEqual(1);
    const d = await db.delivery.findUniqueOrThrow({ where: { orderId: ids.b } });
    expect(d.costCents).toBe(1080);
    expect(d.costCheckedAt).not.toBeNull();
    // La que ya tenía costo no se vuelve a consultar.
    expect((await db.delivery.findUniqueOrThrow({ where: { orderId: ids.a } })).costCents).toBe(2100);
  });

  it("contabilidad: costo real a la tasa del día de cada venta, gastos y cuadre del capital", async () => {
    await db.expense.create({ data: { day: "2032-05-03", category: "Publicidad", concept: `Anuncios ${RUN}`, amountCop: 10_000 } });
    const p = resolvePeriod({ desde: "2032-05-01", hasta: "2032-05-05" });
    const s = await accountingSummary(p);
    // a: 21 USD × 3.900 (mercado del 2) · b: 10,80 USD × 3.990 (TRM del 4).
    expect(s.costCop).toBe(81_900 + 43_092);
    expect(s.costKinds).toMatchObject({ real: 2 });
    expect(s.grossProfitCop).toBe(150_000 - 124_992);
    expect(s.feeCop).toBe(4_500);
    expect(s.expensesCop).toBe(10_000);
    expect(s.profitCop).toBe(25_008 - 4_500 - 10_000);

    state.settings.capitalCop = "1000000";
    state.settings.capitalSince = "2032-05-01";
    state.settings.fxRates = JSON.stringify({ at: new Date().toISOString(), rates: { COP: 4000 } });
    const c = await capitalStatus(new Date("2032-05-05T20:00:00Z"));
    expect(c).toMatchObject({ capitalCop: 1_000_000, profitCop: s.profitCop, shouldHave: 1_000_000 + s.profitCop, inSupplierCop: 601_000 });
    expect(c!.elsewhereCop).toBe(1_000_000 + s.profitCop - 601_000);
    state.settings.capitalCop = "";
    state.settings.fxRates = "";
  });
});
