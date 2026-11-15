import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { canonicalEmail } from "@/server/order-limits";
import { REVENUE_STATUSES } from "@/domain/order-status";
import { parseFee } from "@/domain/cash";
import { summarizeAccounting, type Period, type PrizeRow, type RefundRow, type SaleRow } from "@/domain/accounting";
import { PRIZE_PROVIDER } from "@/server/ranking";
import { getSettings } from "@/server/settings";
import { supplierRate } from "@/server/supplier";

/**
 * Contabilidad por fechas: ventas (por fecha de pago), reembolsos (por fecha de reembolso) y premios del Top 3 (por
 * fecha de entrega). Nunca cuenta pedidos de prueba.
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
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

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
} satisfies Prisma.OrderSelect;
export type LedgerOrder = Prisma.OrderGetPayload<{ select: typeof ledgerSelect }>;

const toSale = (o: LedgerOrder): SaleRow => ({
  paidAt: o.paidAt!,
  subtotal: o.subtotal,
  discount: o.discount,
  total: o.total,
  type: o.type,
  name: snap(o.itemSnapshot).name ?? (o.type === "TOPUP" ? "Recarga" : "Cuenta"),
  costCents: o.type === "TOPUP" ? num(snap(o.itemSnapshot).costCents) : null,
  usdtCop: num(snap(o.itemSnapshot).usdtCop),
  provider: o.paymentProvider,
  method: o.payments[0]?.method ?? null,
  chargeCurrency: o.chargeCurrency,
  buyer: canonicalEmail(o.customerEmail),
});
const toRefund = (o: LedgerOrder): RefundRow => ({
  refundedAt: o.refundedAt!,
  total: o.total,
  type: o.type,
  costCents: o.type === "TOPUP" ? num(snap(o.itemSnapshot).costCents) : null,
  usdtCop: num(snap(o.itemSnapshot).usdtCop),
  delivered: o.deliveredAt != null,
});
const toPrize = (o: LedgerOrder): PrizeRow => ({ deliveredAt: o.deliveredAt!, costCents: num(snap(o.itemSnapshot).costCents), usdtCop: num(snap(o.itemSnapshot).usdtCop) });

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
  const [s, rate] = await Promise.all([getSettings(), supplierRate()]);
  return { fee: parseFee(s.cashFeePct, s.cashFeeFixed), usdtCop: rate.usdtCop };
}

export async function accountingSummary(p: Period) {
  const [{ sales, refunds, prizes }, cfg] = await Promise.all([ledgerOrders(p), accountingConfig()]);
  return summarizeAccounting({ period: p, sales: sales.map(toSale), refunds: refunds.map(toRefund), prizes: prizes.map(toPrize), fee: cfg.fee, usdtCop: cfg.usdtCop });
}

/** Cierres de caja hechos dentro del periodo. */
export async function closesIn(p: Pick<Period, "start" | "end">) {
  return db.cashClose.findMany({ where: { closedAt: { gte: p.start, lt: p.end }, opening: false }, orderBy: { number: "desc" } });
}

export { toSale, toRefund, toPrize };
