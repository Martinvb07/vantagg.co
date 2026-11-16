import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { REVENUE_STATUSES } from "@/domain/order-status";
import { parseFee } from "@/domain/cash";
import { bogotaYmd, resolvePeriod, summarizeAccounting, type CostKind, type Period, type PrizeRow, type RefundRow, type SaleRow } from "@/domain/accounting";
import { currentUsdCop, dayRates } from "@/server/fx";
import { canonicalEmail } from "@/server/order-limits";
import { costOf } from "@/server/order-cost";

export { costOf };
import { PRIZE_PROVIDER } from "@/server/ranking";
import { getSettings } from "@/server/settings";
import { listExpenses } from "@/server/expenses";
import { readSupplierBalance } from "@/server/cash";

/**
 * Contabilidad por fechas: ventas (por fecha de pago), reembolsos (por fecha de reembolso) y premios del Top 3 (por
 * fecha de entrega). Nunca cuenta pedidos de prueba.
 *
 * Costo de cada recarga, en este orden: lo que de verdad cobró el proveedor (guardado en la entrega), el costo guardado
 * al vender o, si no hay ninguno, el costo actual del paquete (estimado). Se pasa a pesos con la tasa del dólar del día
 * de la venta (la de mercado de ese día o, para días viejos, la TRM).
 */

/** Ventas: pagadas, con monto, sin prueba ni premio. Incluye las que después se reembolsaron (el reembolso resta aparte). */
const saleWhere = (p: Pick<Period, "start" | "end">): Prisma.OrderWhereInput => ({
  isTest: false,
  paidAt: { gte: p.start, lt: p.end },
  total: { gt: 0 },
  paymentProvider: { not: PRIZE_PROVIDER },
  status: { in: [...REVENUE_STATUSES, "REFUNDED"] },
});
const refundWhere = (p: Pick<Period, "start" | "end">): Prisma.OrderWhereInput => ({
  isTest: false,
  status: "REFUNDED",
  refundedAt: { gte: p.start, lt: p.end },
  paidAt: { not: null },
  paymentProvider: { not: PRIZE_PROVIDER },
});
const prizeWhere = (p: Pick<Period, "start" | "end">): Prisma.OrderWhereInput => ({
  isTest: false,
  paymentProvider: PRIZE_PROVIDER,
  deliveredAt: { gte: p.start, lt: p.end },
  delivery: { is: { simulated: false } },
});

const snap = (s: unknown) => (s ?? {}) as { name?: string; costCents?: unknown; usdtCop?: unknown };
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);

const ledgerSelect = {
  id: true,
  number: true,
  type: true,
  status: true,
  subtotal: true,
  discount: true,
  total: true,
  promoCode: true,
  paidAt: true,
  deliveredAt: true,
  refundedAt: true,
  customerEmail: true,
  playerId: true,
  itemSnapshot: true,
  paymentProvider: true,
  chargeCurrency: true,
  chargeAmount: true,
  payments: { where: { status: "APPROVED" as const }, select: { method: true }, orderBy: { updatedAt: "desc" as const }, take: 1 },
  cashClose: { select: { number: true } },
  refundClose: { select: { number: true } },
  delivery: { select: { costCents: true, simulated: true } },
  package: { select: { costCents: true } },
} satisfies Prisma.OrderSelect;
export type LedgerOrder = Prisma.OrderGetPayload<{ select: typeof ledgerSelect }>;

export type Rates = { byDay: Map<string, { rate: number; source: string }>; current: number; currentSource: string };

/** Tasa del dólar para un día: la de ese día; si no hay, la guardada en la venta; si no, la de hoy. */
export function rateOn(rates: Rates, day: Date, o?: Pick<LedgerOrder, "itemSnapshot">): number {
  return rates.byDay.get(bogotaYmd(day))?.rate ?? num(o ? snap(o.itemSnapshot).usdtCop : null) ?? rates.current;
}

export async function loadRates(p: Pick<Period, "fromYmd" | "toYmd">): Promise<Rates> {
  const [byDay, cur] = await Promise.all([dayRates(p.fromYmd, p.toYmd), currentUsdCop()]);
  return { byDay, current: cur.rate, currentSource: cur.source };
}

function toSale(o: LedgerOrder, rates: Rates): SaleRow {
  const c = costOf(o);
  return {
    paidAt: o.paidAt!,
    subtotal: o.subtotal,
    discount: o.discount,
    total: o.total,
    type: o.type,
    name: snap(o.itemSnapshot).name ?? (o.type === "TOPUP" ? "Recarga" : "Cuenta"),
    costCents: c?.cents ?? null,
    costKind: c?.kind,
    usdtCop: rateOn(rates, o.paidAt!, o),
    provider: o.paymentProvider,
    method: o.payments[0]?.method ?? null,
    chargeCurrency: o.chargeCurrency,
    buyer: canonicalEmail(o.customerEmail),
  };
}
// El costo que vuelve en un reembolso se pasa a pesos con la tasa del día de la venta: así anula exactamente lo contado.
const toRefund = (o: LedgerOrder, rates: Rates): RefundRow => ({
  refundedAt: o.refundedAt!,
  total: o.total,
  type: o.type,
  costCents: costOf(o)?.cents ?? null,
  usdtCop: rateOn(rates, o.paidAt ?? o.refundedAt!, o),
  delivered: o.deliveredAt != null,
});
const toPrize = (o: LedgerOrder, rates: Rates): PrizeRow => ({ deliveredAt: o.deliveredAt!, costCents: costOf(o)?.cents ?? null, usdtCop: rateOn(rates, o.deliveredAt!, o) });

/** Pedidos del periodo: ventas, reembolsos y premios (para el resumen y el libro de ventas). */
export async function ledgerOrders(p: Pick<Period, "start" | "end">) {
  const [sales, refunds, prizes] = await Promise.all([
    db.order.findMany({ where: saleWhere(p), select: ledgerSelect, orderBy: { paidAt: "asc" }, take: 50_000 }),
    db.order.findMany({ where: refundWhere(p), select: ledgerSelect, orderBy: { refundedAt: "asc" }, take: 50_000 }),
    db.order.findMany({ where: prizeWhere(p), select: ledgerSelect, orderBy: { deliveredAt: "asc" }, take: 5_000 }),
  ]);
  return { sales, refunds, prizes };
}

export async function accountingConfig() {
  const s = await getSettings();
  return { fee: parseFee(s.cashFeePct, s.cashFeeFixed), capitalCop: Number(s.capitalCop) > 0 ? Math.round(Number(s.capitalCop)) : 0, capitalSince: /^\d{4}-\d{2}-\d{2}$/.test(s.capitalSince) ? s.capitalSince : "" };
}

/**
 * Cuadre del negocio: con el capital inicial y la ganancia neta desde ese día, cuánto debería valer el negocio hoy y
 * cuánto de eso está en el saldo del proveedor (el resto debería estar en Bold, el banco o en efectivo).
 */
export async function capitalStatus(now = new Date()) {
  const cfg = await accountingConfig();
  if (!cfg.capitalCop || !cfg.capitalSince) return null;
  const since = resolvePeriod({ desde: cfg.capitalSince, hasta: bogotaYmd(now) }, now);
  const [s, balance, cur] = await Promise.all([accountingSummary(since), readSupplierBalance(), currentUsdCop()]);
  const shouldHave = cfg.capitalCop + s.profitCop;
  const inSupplierCop = balance ? Math.round((balance.cents / 100) * cur.rate) : null;
  return {
    capitalCop: cfg.capitalCop,
    since: cfg.capitalSince,
    profitCop: s.profitCop,
    salesCop: s.netCop,
    shouldHave,
    balance,
    inSupplierCop,
    elsewhereCop: inSupplierCop == null ? null : shouldHave - inSupplierCop,
  };
}

/** Dinero reinvertido: recargas al proveedor anotadas en Caja dentro del periodo. */
export async function rechargesIn(p: Pick<Period, "start" | "end">) {
  const rows = await db.supplierRecharge.findMany({ where: { createdAt: { gte: p.start, lt: p.end } }, select: { amountCents: true, rateCop: true } });
  return { count: rows.length, cents: rows.reduce((n, r) => n + r.amountCents, 0), cop: rows.reduce((n, r) => n + Math.round((r.amountCents / 100) * r.rateCop), 0) };
}

export async function accountingSummary(p: Period) {
  const [{ sales, refunds, prizes }, cfg, rates, expenses] = await Promise.all([ledgerOrders(p), accountingConfig(), loadRates(p), listExpenses(p)]);
  const summary = summarizeAccounting({
    period: p,
    sales: sales.map((o) => toSale(o, rates)),
    refunds: refunds.map((o) => toRefund(o, rates)),
    prizes: prizes.map((o) => toPrize(o, rates)),
    expenses: expenses.map((e) => ({ day: e.day, category: e.category, amountCop: e.amountCop })),
    fee: cfg.fee,
    usdtCop: rates.current,
  });
  // Tasa usada: la de los días del periodo (promedio de los días con ventas) y la de hoy.
  const used = sales.map((o) => rateOn(rates, o.paidAt!, o));
  const avgRate = used.length ? Math.round(used.reduce((a, b) => a + b, 0) / used.length) : Math.round(rates.current);
  return { ...summary, rate: { average: avgRate, current: Math.round(rates.current), source: rates.currentSource } };
}

/** Cierres de caja hechos dentro del periodo. */
export async function closesIn(p: Pick<Period, "start" | "end">) {
  return db.cashClose.findMany({ where: { closedAt: { gte: p.start, lt: p.end }, opening: false }, orderBy: { number: "desc" } });
}
