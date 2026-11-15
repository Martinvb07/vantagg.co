/**
 * Caja: cálculos (comisión, reembolsos, cuadre del saldo) y cierres contra la base de PRUEBAS (nunca la real):
 *   TEST_DATABASE_URL=mysql://usuario:clave@localhost:3306/vanta_test npx vitest run tests/cash.test.ts
 * Nada sale a internet: el saldo del proveedor se pasa a mano en cada cierre.
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
import { centsToCop, closeDiff, closeProfit, feeFor, parseFee, parseUsdCents, paymentLabel, refundEffect, summarizeBox } from "@/domain/cash";
import { addRecharge, cashState, closeCash, closeDetail, removeRecharge, startCash } from "@/server/cash";

describe("Cálculos de la caja", () => {
  it("comisión, montos en dólares y nombres de medios de pago", () => {
    expect(parseFee("3,29", "900")).toEqual({ pct: 3.29, fixed: 900 });
    expect(parseFee("", "")).toEqual({ pct: 0, fixed: 0 });
    expect(parseFee("90", "abc")).toEqual({ pct: 0, fixed: 0 });
    expect(feeFor(100_000, { pct: 3.29, fixed: 900 })).toBe(4190);
    expect(feeFor(100_000, { pct: 0, fixed: 0 })).toBe(0);
    expect(parseUsdCents("150")).toBe(15_000);
    expect(parseUsdCents("150,5")).toBe(15_050);
    expect(parseUsdCents("1.234,50")).toBe(123_450);
    expect(parseUsdCents("1,234.50")).toBe(123_450);
    expect(parseUsdCents("$ 20 USDT")).toBe(2000);
    expect(parseUsdCents("0")).toBeNull();
    expect(parseUsdCents("abc")).toBeNull();
    expect(parseUsdCents("1.2.3")).toBeNull();
    expect(paymentLabel("bold", "PSE")).toBe("Bold · PSE");
    expect(paymentLabel("bold", "BOTON_BANCOLOMBIA")).toBe("Bold · Botón Bancolombia");
    expect(paymentLabel("epayco", "CREDIT_CARD", "USD")).toBe("ePayco · Tarjeta (cobro en USD)");
    expect(paymentLabel("bold", null)).toBe("Bold");
    expect(centsToCop(2050, 4000)).toBe(82_000);
  });

  it("reembolsos: devuelven el dinero contado y el costo solo si no se entregó", () => {
    expect(refundEffect({ total: 50_000, costCents: 1000, counted: true, delivered: true })).toEqual({ cop: 50_000, costCents: 0 });
    expect(refundEffect({ total: 50_000, costCents: 1000, counted: true, delivered: false })).toEqual({ cop: 50_000, costCents: 1000 });
    // Pagado y reembolsado dentro de la misma caja: nunca fue venta; si se entregó, el costo se perdió.
    expect(refundEffect({ total: 50_000, costCents: 1000, counted: false, delivered: true })).toEqual({ cop: 0, costCents: -1000 });
    expect(refundEffect({ total: 50_000, costCents: 1000, counted: false, delivered: false })).toEqual({ cop: 0, costCents: 0 });
  });

  it("resumen: ventas, costo, ganancia y cuadre del saldo", () => {
    const s = summarizeBox({
      sales: [
        { total: 100_000, type: "TOPUP", costCents: 2000, provider: "bold", method: "PSE" },
        { total: 50_000, type: "TOPUP", costCents: null, provider: "bold", method: "CARD" },
        { total: 200_000, type: "ACCOUNT", costCents: 999, provider: "bold", method: "PSE" },
      ],
      refunds: [{ total: 40_000, costCents: 800, counted: true, delivered: false }],
      deliveries: [{ costCents: 2000, prize: false }, { costCents: 3000, prize: true }],
      recharges: [{ amountCents: 10_000, rateCop: 3900 }],
      fee: { pct: 3, fixed: 0 },
      usdtCop: 4000,
      startBalanceCents: 50_000,
      actualBalanceCents: 54_950,
    });
    expect(s).toMatchObject({ orders: 3, salesCop: 350_000, costCents: 2000, missingCost: 1, feeCop: 10_500, refunds: 1, refundsCop: 40_000, refundsCostCents: 800 });
    expect(s).toMatchObject({ deliveries: 2, deliveriesCostCents: 5000, prizes: 1, prizesCostCents: 3000, rechargeCents: 10_000, rechargeCop: 390_000 });
    // Las cuentas no tienen costo de proveedor; el costo que vuelve del reembolso se suma.
    expect(s.profitCop).toBe(350_000 - 10_500 - centsToCop(2000 - 800, 4000) - 40_000);
    expect(s.expectedBalanceCents).toBe(55_000);
    expect(s.diffCents).toBe(-50);
    expect(s.balanceOk).toBe(true);
    expect(s.breakdown.byPayment.map((l) => [l.label, l.orders, l.cop])).toEqual([
      ["Bold · PSE", 2, 300_000],
      ["Bold · Tarjeta", 1, 50_000],
    ]);
    expect(closeProfit({ ...s, usdtCop: 4000 })).toBe(s.profitCop);
    const off = summarizeBox({ sales: [], refunds: [], deliveries: [], recharges: [], fee: { pct: 0, fixed: 0 }, usdtCop: 4000, startBalanceCents: 10_000, actualBalanceCents: 9_000 });
    expect(off).toMatchObject({ diffCents: -1000, balanceOk: false });
    expect(summarizeBox({ sales: [], refunds: [], deliveries: [], recharges: [], fee: { pct: 0, fixed: 0 }, usdtCop: 4000, startBalanceCents: null, actualBalanceCents: 9_000 }).balanceOk).toBeNull();
  });
});

describe.skipIf(!cfg.enabled)("Cierres de caja (base de pruebas)", () => {
  const RUN = `cj${Date.now().toString(36)}`;
  const T = new Date(Math.floor(Date.now() / 1000) * 1000);
  const at = (s: number) => new Date(T.getTime() + s * 1000);
  const actor = { id: "", name: "Admin de prueba" };
  let seq = 0;
  const ids: Record<string, string> = {};

  const order = async (key: string, o: { total: number; type?: "TOPUP" | "ACCOUNT"; cost?: number | null; status?: string; paidAt?: Date | null; deliveredAt?: Date | null; provider?: string; method?: string; isTest?: boolean }) => {
    seq += 1;
    const delivered = o.deliveredAt ?? null;
    const created = await db.order.create({
      data: {
        id: `ord_${RUN}_${seq}`,
        number: `VT-${RUN}-${seq}`.toUpperCase(),
        type: o.type ?? "TOPUP",
        status: (o.status ?? (delivered ? "DELIVERED" : "PAID")) as "PAID",
        isTest: o.isTest ?? false,
        idempotencyKey: `idem-${RUN}-${seq}`,
        trackingToken: `tok-${RUN}-${seq}`,
        customerEmail: `${key}.${RUN}@example.com`,
        itemSnapshot: { kind: o.type ?? "TOPUP", name: `Producto ${key}`, ...(o.cost !== undefined ? { costCents: o.cost } : {}) },
        subtotal: o.total,
        total: o.total,
        paymentProvider: o.provider ?? "bold",
        expiresAt: T,
        paidAt: o.paidAt === undefined ? at(5) : o.paidAt,
        deliveredAt: delivered,
        ...(o.method ? { payments: { create: { provider: o.provider ?? "bold", providerRef: `pay-${RUN}-${seq}`, status: "APPROVED", method: o.method, amount: o.total, currency: "COP" } } } : {}),
        ...(delivered ? { delivery: { create: { provider: "fake", idempotencyKey: `dlv-${RUN}-${seq}`, status: "SUCCESS", simulated: false } } } : {}),
      },
    });
    ids[key] = created.id;
    return created;
  };

  const reset = async () => {
    await db.order.updateMany({ where: { OR: [{ cashCloseId: { not: null } }, { refundCloseId: { not: null } }] }, data: { cashCloseId: null, refundCloseId: null } });
    await db.cashClose.deleteMany({});
    await db.supplierRecharge.deleteMany({});
  };

  beforeAll(async () => {
    await reset();
    actor.id = (await db.user.create({ data: { email: `admin.${RUN}@example.com`, name: "Admin de prueba", passwordHash: "x", role: "ADMIN" } })).id;
  });

  afterAll(async () => {
    await reset();
    await db.order.deleteMany({ where: { id: { startsWith: `ord_${RUN}_` } } });
    await db.user.deleteMany({ where: { email: { contains: RUN } } });
    await db.$disconnect();
  });

  it("sin inicio no se puede cerrar; el inicio guarda aparte las ventas anteriores", async () => {
    expect((await cashState(T, null)).started).toBe(false);
    expect(await closeCash({ actor, now: at(1), balance: null })).toMatchObject({ ok: false });
    await order("antes", { total: 90_000, cost: 1800, paidAt: at(-3600), deliveredAt: at(-3500) });
    expect(await startCash({ from: at(60), actor, now: T, balance: null })).toMatchObject({ ok: false }); // fecha futura
    const r = await startCash({ from: T, actor, now: T, balance: { cents: 50_000, currency: "USD" } });
    expect(r).toMatchObject({ ok: true, number: 0 });
    expect((await db.order.findUnique({ where: { id: ids.antes } }))?.cashCloseId).toBeTruthy();
    expect(await startCash({ from: T, actor, now: T, balance: null })).toMatchObject({ ok: false }); // ya está en uso
  });

  it("primer cierre: cuenta cada venta una vez, incluye pagos confirmados tarde y cuadra el saldo", async () => {
    await order("a", { total: 100_000, cost: 2000, method: "PSE", deliveredAt: at(6) });
    await order("b", { total: 50_000, cost: 1000, method: "CARD" }); // pagado, aún sin entregar
    await order("c", { total: 200_000, type: "ACCOUNT", provider: "epayco", method: "PSE" });
    await order("tarde", { total: 30_000, cost: 600, paidAt: at(-86_400) }); // el pago se confirmó después del inicio con fecha anterior
    await order("prueba", { total: 999_000, cost: 9000, isTest: true, deliveredAt: at(7) });
    await order("premio", { total: 0, cost: 3000, provider: "premio", deliveredAt: at(8) });
    await order("devuelto", { total: 20_000, cost: 500, status: "REFUNDED", deliveredAt: at(9) }); // pagado, entregado y reembolsado en esta caja
    await order("sinpagar", { total: 70_000, cost: 1500, status: "PENDING_PAYMENT", paidAt: null });

    const keep = await addRecharge({ amountCents: 10_000, rateCop: 3900, note: "P2P", actor });
    const oops = await addRecharge({ amountCents: 777, rateCop: 3900, actor });
    expect(keep.ok && oops.ok).toBe(true);
    expect(await removeRecharge(oops.ok ? oops.id : "")).toMatchObject({ ok: true });
    expect(await addRecharge({ amountCents: 1000, rateCop: 12, actor })).toMatchObject({ ok: false }); // tasa absurda

    const open = await cashState(at(60), { cents: 54_450, currency: "USD" });
    expect(open.started && open.summary).toMatchObject({ orders: 4, salesCop: 380_000 });

    expect(await closeCash({ actor, now: at(60), balance: { cents: 54_450, currency: "USD" }, expectNumber: 2 })).toMatchObject({ ok: false }); // otra caja
    const r = await closeCash({ actor, now: at(60), balance: { cents: 54_450, currency: "USD" }, expectNumber: 1, note: "antes de recargar" });
    expect(r).toMatchObject({ ok: true, number: 1 });
    const c = await db.cashClose.findUniqueOrThrow({ where: { number: 1 } });
    expect(c).toMatchObject({ orders: 4, salesCop: 380_000, costCents: 3600, feeCop: 11_400, refunds: 1, refundsCop: 0, refundsCostCents: -500 });
    expect(c).toMatchObject({ deliveries: 3, deliveriesCostCents: 5500, prizes: 1, prizesCostCents: 3000, rechargeCents: 10_000, rechargeCop: 390_000 });
    expect(c).toMatchObject({ supplierBalanceCents: 54_450, expectedBalanceCents: 54_500, usdtCop: 4000, closedByName: "Admin de prueba", note: "antes de recargar" });
    expect(closeDiff(c)).toBe(-50);
    expect(closeProfit(c)).toBe(380_000 - 11_400 - centsToCop(3600 + 500, 4000));

    const stamped = await db.order.findMany({ where: { id: { startsWith: `ord_${RUN}_` } }, select: { id: true, cashCloseId: true, refundCloseId: true } });
    const by = Object.fromEntries(stamped.map((o) => [o.id, o]));
    for (const k of ["a", "b", "c", "tarde"]) expect(by[ids[k]].cashCloseId).toBe(c.id);
    for (const k of ["prueba", "premio", "sinpagar", "devuelto"]) expect(by[ids[k]].cashCloseId).toBeNull();
    expect(by[ids.devuelto].refundCloseId).toBe(c.id);
    // La recarga ya quedó en un cierre: no se puede quitar.
    expect(await removeRecharge(keep.ok ? keep.id : "")).toMatchObject({ ok: false });
  });

  it("segundo cierre: reembolsos de ventas ya contadas se descuentan y nada se cuenta dos veces", async () => {
    await db.order.update({ where: { id: ids.a }, data: { status: "REFUNDED" } }); // entregada y devuelta
    await db.order.update({ where: { id: ids.b }, data: { status: "REFUNDED" } }); // nunca se entregó: el costo vuelve
    await order("d", { total: 70_000, cost: 1500, paidAt: at(65), method: "NEQUI" });
    const r = await closeCash({ actor, now: at(120), balance: null });
    expect(r).toMatchObject({ ok: true, number: 2 });
    const c = await db.cashClose.findUniqueOrThrow({ where: { number: 2 } });
    expect(c).toMatchObject({ orders: 1, salesCop: 70_000, costCents: 1500, refunds: 2, refundsCop: 150_000, refundsCostCents: 1000, supplierBalanceCents: null, expectedBalanceCents: 54_450 });
    expect(closeDiff(c)).toBeNull();
    expect(closeProfit(c)).toBe(70_000 - 2100 - centsToCop(1500 - 1000, 4000) - 150_000);

    const empty = await closeCash({ actor, now: at(180), balance: null });
    expect(empty).toMatchObject({ ok: true, number: 3 });
    expect(await db.cashClose.findUniqueOrThrow({ where: { number: 3 } })).toMatchObject({ orders: 0, salesCop: 0, refunds: 0 });

    const d1 = await closeDetail(1);
    expect(d1?.sales.map((o) => o.id).sort()).toEqual([ids.a, ids.b, ids.c, ids.tarde].sort());
    expect(d1?.refunds.map((o) => o.id)).toEqual([ids.devuelto]);
    expect((await closeDetail(2))?.refunds.map((o) => o.id).sort()).toEqual([ids.a, ids.b].sort());
    expect(await closeDetail(99)).toBeNull();
    // Un cierre no se puede borrar mientras tenga ventas.
    await expect(db.cashClose.delete({ where: { number: 1 } })).rejects.toThrow();
  });
});
