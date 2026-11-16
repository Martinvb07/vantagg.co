import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { REVENUE_STATUSES } from "@/domain/order-status";
import { parseFee, summarizeBox, toCents, type BoxSummary, type Breakdown, type DeliveryRow, type RefundRow, type SaleRow } from "@/domain/cash";
import { activeWholesale } from "@/server/integrations/topup";
import { PRIZE_PROVIDER } from "@/server/ranking";
import { getSettings } from "@/server/settings";
import { currentUsdCop } from "@/server/fx";
import { costOf } from "@/server/order-cost";

/**
 * Caja: cierres de caja y recargas de saldo al proveedor.
 *
 * Cada venta queda marcada con el cierre en que se contó (no se cuenta por fechas): así ninguna venta se cuenta dos
 * veces ni se pierde, aunque el pago se confirme tarde. Un reembolso de una venta ya contada se descuenta en la caja en
 * que ocurre. Los cierres no se editan ni se borran.
 */

type Client = Prisma.TransactionClient | typeof db;
export type SupplierBalance = { cents: number; currency: string } | null;

/** Saldo del proveedor sin frenar la página (null si no hay proveedor o no responde a tiempo). */
export async function readSupplierBalance(timeoutMs = 4000): Promise<SupplierBalance> {
  const supplier = activeWholesale();
  if (!supplier) return null;
  const timeout = new Promise<null>((r) => setTimeout(() => r(null), timeoutMs));
  const b = await Promise.race([supplier.wholesale.balance().catch(() => null), timeout]);
  return b && Number.isFinite(b.amount) ? { cents: toCents(b.amount), currency: b.currency || "USD" } : null;
}

/** Ventas reales: pagadas, con monto, que no son prueba ni premio y siguen vigentes (no reembolsadas ni canceladas). */
const SALE: Prisma.OrderWhereInput = {
  isTest: false,
  paidAt: { not: null },
  total: { gt: 0 },
  paymentProvider: { not: PRIZE_PROVIDER },
  status: { in: [...REVENUE_STATUSES] },
};
/** Reembolsos aún no contados en ningún cierre. */
const REFUND: Prisma.OrderWhereInput = { refundCloseId: null, isTest: false, paidAt: { not: null }, paymentProvider: { not: PRIZE_PROVIDER }, status: "REFUNDED" };
/** Entregas reales al proveedor (incluye premios) en una ventana de tiempo: lo que salió del saldo. */
const delivered = (after: Date, until: Date): Prisma.OrderWhereInput => ({
  isTest: false,
  type: "TOPUP",
  deliveredAt: { gt: after, lte: until },
  delivery: { is: { simulated: false } },
});

const saleSelect = {
  total: true,
  type: true,
  itemSnapshot: true,
  paymentProvider: true,
  chargeCurrency: true,
  payments: { where: { status: "APPROVED" as const }, select: { method: true }, orderBy: { updatedAt: "desc" as const }, take: 1 },
  delivery: { select: { costCents: true, simulated: true } },
  package: { select: { costCents: true } },
} satisfies Prisma.OrderSelect;

type SaleRecord = Prisma.OrderGetPayload<{ select: typeof saleSelect }>;
const toSale = (o: SaleRecord): SaleRow => ({
  total: o.total,
  type: o.type,
  costCents: costOf(o)?.cents ?? null,
  provider: o.paymentProvider,
  method: o.payments[0]?.method ?? null,
  chargeCurrency: o.chargeCurrency,
});

const costSelect = { type: true, itemSnapshot: true, delivery: { select: { costCents: true, simulated: true } }, package: { select: { costCents: true } } } satisfies Prisma.OrderSelect;

async function refundRows(client: Client, where: Prisma.OrderWhereInput): Promise<RefundRow[]> {
  const rows = await client.order.findMany({ where, select: { ...costSelect, total: true, cashCloseId: true, deliveredAt: true } });
  return rows.map((o) => ({ total: o.total, costCents: costOf(o)?.cents ?? null, counted: o.cashCloseId != null, delivered: o.deliveredAt != null }));
}

/** Lo que salió del saldo: lo que cobró el proveedor en cada entrega (o, si aún no se sabe, el costo guardado). */
async function deliveryRows(client: Client, after: Date, until: Date): Promise<DeliveryRow[]> {
  const rows = await client.order.findMany({ where: delivered(after, until), select: { ...costSelect, paymentProvider: true } });
  return rows.map((o) => ({ costCents: costOf(o)?.cents ?? null, prize: o.paymentProvider === PRIZE_PROVIDER }));
}

/** Comisión configurada y tasa del dólar de hoy (la de mercado; si no hay, la configurada en Proveedor). */
async function cashConfig() {
  const [s, rate] = await Promise.all([getSettings(), currentUsdCop()]);
  return { fee: parseFee(s.cashFeePct, s.cashFeeFixed), usdtCop: Math.round(rate.rate) };
}

export type CashState =
  | { started: false; firstSaleAt: Date | null }
  | {
      started: true;
      last: Awaited<ReturnType<typeof db.cashClose.findFirst>> & {};
      summary: BoxSummary;
      balance: SupplierBalance;
      recharges: Array<{ id: string; amountCents: number; rateCop: number; note: string | null; createdByName: string | null; createdAt: Date }>;
    };

/** Caja abierta: todo lo que pasó desde el último cierre, sin guardar nada. */
export async function cashState(now = new Date(), balance?: SupplierBalance): Promise<CashState> {
  const last = await db.cashClose.findFirst({ orderBy: { number: "desc" } });
  if (!last) {
    const first = await db.order.findFirst({ where: SALE, orderBy: { paidAt: "asc" }, select: { paidAt: true } });
    return { started: false, firstSaleAt: first?.paidAt ?? null };
  }
  const [sales, refunds, deliveries, recharges, cfg, bal] = await Promise.all([
    db.order.findMany({ where: { ...SALE, cashCloseId: null, paidAt: { lte: now } }, select: saleSelect }),
    refundRows(db, REFUND),
    deliveryRows(db, last.closedAt, now),
    db.supplierRecharge.findMany({ where: { createdAt: { gt: last.closedAt, lte: now } }, orderBy: { createdAt: "desc" } }),
    cashConfig(),
    balance === undefined ? readSupplierBalance() : Promise.resolve(balance),
  ]);
  const summary = summarizeBox({
    sales: sales.map(toSale),
    refunds,
    deliveries,
    recharges,
    fee: cfg.fee,
    usdtCop: cfg.usdtCop,
    startBalanceCents: last.supplierBalanceCents,
    actualBalanceCents: bal?.cents ?? null,
  });
  return { started: true, last, summary, balance: bal, recharges };
}

export type CashResult = { ok: true; number: number; summary: BoxSummary } | { ok: false; error: string };

const actorFields = (actor: { id: string; name: string | null }) => ({ id: actor.id, name: actor.name?.slice(0, 191) ?? null });

function uniqueClash(err: unknown) {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

/**
 * Empieza a usar la caja: crea el cierre de inicio (#0) con las ventas pagadas antes de `from` (ya contadas a mano),
 * para que no aparezcan en la primera caja. Guarda el saldo del proveedor de ese momento como punto de partida del cuadre.
 */
export async function startCash(opts: { from: Date; actor: { id: string; name: string | null }; note?: string | null; now?: Date; balance?: SupplierBalance }): Promise<CashResult> {
  const now = opts.now ?? new Date();
  if (!(opts.from instanceof Date) || Number.isNaN(opts.from.getTime())) return { ok: false, error: "Elige desde cuándo se cuentan las ventas." };
  if (opts.from.getTime() > now.getTime()) return { ok: false, error: "La fecha de inicio no puede ser futura." };
  if (await db.cashClose.count()) return { ok: false, error: "La caja ya está en uso." };
  const [cfg, bal] = await Promise.all([cashConfig(), opts.balance === undefined ? readSupplierBalance() : Promise.resolve(opts.balance)]);
  const actor = actorFields(opts.actor);
  try {
    return await db.$transaction(
      async (tx) => {
        const close = await tx.cashClose.create({
          data: { number: 0, opening: true, closedAt: now, closedById: actor.id, closedByName: actor.name, note: opts.note || null, usdtCop: cfg.usdtCop, supplierBalanceCents: bal?.cents ?? null, supplierCurrency: bal?.currency ?? null, breakdown: {} },
        });
        // Ventas y reembolsos anteriores al inicio: ya se contaron fuera de la caja.
        await tx.order.updateMany({ where: { ...SALE, cashCloseId: null, paidAt: { lt: opts.from } }, data: { cashCloseId: close.id } });
        await tx.order.updateMany({ where: { ...REFUND, paidAt: { lt: opts.from } }, data: { refundCloseId: close.id } });
        const sales = (await tx.order.findMany({ where: { cashCloseId: close.id }, select: saleSelect })).map(toSale);
        const s = summarizeBox({ sales, refunds: [], deliveries: [], recharges: [], fee: cfg.fee, usdtCop: cfg.usdtCop, startBalanceCents: null, actualBalanceCents: null });
        const breakdown: Breakdown = { ...s.breakdown, countFrom: opts.from.toISOString() };
        await tx.cashClose.update({ where: { id: close.id }, data: { orders: s.orders, salesCop: s.salesCop, costCents: s.costCents, feeCop: s.feeCop, breakdown } });
        return { ok: true as const, number: 0, summary: s };
      },
      { timeout: 30_000 },
    );
  } catch (err) {
    if (uniqueClash(err)) return { ok: false, error: "La caja ya está en uso (alguien más la inició). Recarga la página." };
    throw err;
  }
}

/** Cierra la caja: marca las ventas y reembolsos sin contar con este cierre y guarda los totales y el saldo del proveedor. */
export async function closeCash(opts: { actor: { id: string; name: string | null }; note?: string | null; now?: Date; balance?: SupplierBalance; expectNumber?: number }): Promise<CashResult> {
  const now = opts.now ?? new Date();
  const last = await db.cashClose.findFirst({ orderBy: { number: "desc" } });
  if (!last) return { ok: false, error: "Primero elige desde cuándo se cuentan las ventas." };
  // El formulario dice qué caja se cierra: si alguien más la cerró mientras tanto, no se cierra otra vacía por error.
  if (opts.expectNumber != null && opts.expectNumber !== last.number + 1) return { ok: false, error: `La caja #${opts.expectNumber} ya se cerró. Recarga la página para ver la caja abierta.` };
  if (now.getTime() <= last.closedAt.getTime()) return { ok: false, error: "Espera un momento: la caja anterior se acaba de cerrar." };
  const [cfg, bal] = await Promise.all([cashConfig(), opts.balance === undefined ? readSupplierBalance() : Promise.resolve(opts.balance)]);
  const actor = actorFields(opts.actor);
  const number = last.number + 1;
  try {
    return await db.$transaction(
      async (tx) => {
        const close = await tx.cashClose.create({
          data: { number, closedAt: now, closedById: actor.id, closedByName: actor.name, note: opts.note || null, usdtCop: cfg.usdtCop, supplierBalanceCents: bal?.cents ?? null, supplierCurrency: bal?.currency ?? null, breakdown: {} },
        });
        await tx.order.updateMany({ where: { ...SALE, cashCloseId: null, paidAt: { lte: now } }, data: { cashCloseId: close.id } });
        await tx.order.updateMany({ where: REFUND, data: { refundCloseId: close.id } });
        const [sales, refunds, deliveries, recharges] = await Promise.all([
          tx.order.findMany({ where: { cashCloseId: close.id }, select: saleSelect }),
          refundRows(tx, { refundCloseId: close.id }),
          deliveryRows(tx, last.closedAt, now),
          tx.supplierRecharge.findMany({ where: { createdAt: { gt: last.closedAt, lte: now } }, select: { amountCents: true, rateCop: true } }),
        ]);
        const s = summarizeBox({
          sales: sales.map(toSale),
          refunds,
          deliveries,
          recharges,
          fee: cfg.fee,
          usdtCop: cfg.usdtCop,
          startBalanceCents: last.supplierBalanceCents,
          actualBalanceCents: bal?.cents ?? null,
        });
        await tx.cashClose.update({
          where: { id: close.id },
          data: {
            orders: s.orders,
            salesCop: s.salesCop,
            costCents: s.costCents,
            feeCop: s.feeCop,
            refunds: s.refunds,
            refundsCop: s.refundsCop,
            refundsCostCents: s.refundsCostCents,
            deliveries: s.deliveries,
            deliveriesCostCents: s.deliveriesCostCents,
            prizes: s.prizes,
            prizesCostCents: s.prizesCostCents,
            rechargeCents: s.rechargeCents,
            rechargeCop: s.rechargeCop,
            expectedBalanceCents: s.expectedBalanceCents,
            breakdown: s.breakdown,
          },
        });
        return { ok: true as const, number, summary: s };
      },
      { timeout: 30_000 },
    );
  } catch (err) {
    if (uniqueClash(err)) return { ok: false, error: "Alguien más acaba de cerrar la caja. Recarga la página." };
    throw err;
  }
}

/** Anota una recarga de saldo hecha en el panel del proveedor. */
export async function addRecharge(opts: { amountCents: number; rateCop: number; note?: string | null; actor: { id: string; name: string | null } }) {
  if (!Number.isInteger(opts.amountCents) || opts.amountCents <= 0) return { ok: false as const, error: "Escribe cuánto recargaste." };
  if (!Number.isInteger(opts.rateCop) || opts.rateCop < 1000 || opts.rateCop > 20_000) return { ok: false as const, error: "La tasa debe ser los pesos que pagaste por 1 USDT (p. ej. 3.950)." };
  const actor = actorFields(opts.actor);
  const r = await db.supplierRecharge.create({ data: { amountCents: opts.amountCents, rateCop: opts.rateCop, note: opts.note?.slice(0, 300) || null, createdById: actor.id, createdByName: actor.name } });
  return { ok: true as const, id: r.id };
}

/** Quita una recarga anotada por error. Solo si aún está en la caja abierta (las de cajas cerradas no se tocan). */
export async function removeRecharge(id: string) {
  const [r, last] = await Promise.all([db.supplierRecharge.findUnique({ where: { id } }), db.cashClose.findFirst({ orderBy: { number: "desc" }, select: { closedAt: true } })]);
  if (!r) return { ok: false as const, error: "Esa recarga ya no existe." };
  if (last && r.createdAt.getTime() <= last.closedAt.getTime()) return { ok: false as const, error: "Esa recarga ya quedó en un cierre: no se puede quitar." };
  await db.supplierRecharge.delete({ where: { id } });
  return { ok: true as const, amountCents: r.amountCents };
}

export async function listCloses(take = 60) {
  return db.cashClose.findMany({ orderBy: { number: "desc" }, take });
}

/** Un cierre con sus ventas y reembolsos (para el detalle y el archivo para Excel). */
export async function closeDetail(number: number) {
  if (!Number.isInteger(number) || number < 0) return null;
  const close = await db.cashClose.findUnique({ where: { number } });
  if (!close) return null;
  const select = {
    id: true,
    number: true,
    type: true,
    status: true,
    total: true,
    paidAt: true,
    deliveredAt: true,
    itemSnapshot: true,
    paymentProvider: true,
    chargeCurrency: true,
    cashCloseId: true,
    payments: { where: { status: "APPROVED" as const }, select: { method: true }, orderBy: { updatedAt: "desc" as const }, take: 1 },
    delivery: { select: { costCents: true, simulated: true } },
    package: { select: { costCents: true } },
  } satisfies Prisma.OrderSelect;
  const [sales, refunds, previous] = await Promise.all([
    db.order.findMany({ where: { cashCloseId: close.id }, select, orderBy: { paidAt: "asc" } }),
    db.order.findMany({ where: { refundCloseId: close.id }, select, orderBy: { paidAt: "asc" } }),
    db.cashClose.findFirst({ where: { number: { lt: number } }, orderBy: { number: "desc" }, select: { number: true, closedAt: true, opening: true, breakdown: true } }),
  ]);
  return { close, sales, refunds, previous, costOf: (o: (typeof sales)[number]) => costOf(o)?.cents ?? null };
}
