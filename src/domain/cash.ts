/**
 * Caja (Panel → Caja): reglas puras, sin base de datos, para el panel y las pruebas.
 *
 * - Ventas: pedidos pagados que aún no se contaron en un cierre (pesos).
 * - Costo: lo que cuesta cada venta en el proveedor (centavos de su moneda, USD/USDT), guardado al momento de la compra.
 * - Reembolsos: ventas ya contadas que después se devolvieron; se descuentan en la caja en que se reembolsan.
 * - Entregas: lo que de verdad salió del saldo del proveedor (incluye premios del Top 3), para el cuadre.
 */

export type FeeConfig = { pct: number; fixed: number };

/** Comisión de la pasarela configurada en la caja: porcentaje y valor fijo por pago (ambos opcionales). */
export function parseFee(pct: string | null | undefined, fixed: string | null | undefined): FeeConfig {
  const p = Number(String(pct ?? "").trim().replace(",", "."));
  const f = Number(String(fixed ?? "").replace(/\D/g, ""));
  return { pct: Number.isFinite(p) && p > 0 && p < 30 ? Math.round(p * 100) / 100 : 0, fixed: Number.isInteger(f) && f > 0 && f < 100_000 ? f : 0 };
}

/** Comisión estimada de un pago, en pesos. */
export function feeFor(total: number, fee: FeeConfig): number {
  if (total <= 0 || (!fee.pct && !fee.fixed)) return 0;
  return Math.round((total * fee.pct) / 100) + fee.fixed;
}

/** Centavos de dólar (USD/USDT) a pesos con una tasa (pesos por 1 USDT). */
export const centsToCop = (cents: number, usdtCop: number) => Math.round((cents / 100) * usdtCop);

/** Monto del proveedor («123.45») a centavos. */
export const toCents = (amount: number) => Math.round(amount * 100);

/** «12,34» / «12.34» / «1.234,50» → centavos (null si no es un monto válido y positivo). */
export function parseUsdCents(raw: string | null | undefined): number | null {
  let s = String(raw ?? "").trim().replace(/\s|\$|usdt?/gi, "");
  if (!s) return null;
  // Con coma y punto, el último separador es el decimal.
  if (s.includes(",") && s.includes(".")) s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  else if (s.includes(",")) s = s.replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const cents = Math.round(Number(s) * 100);
  return cents > 0 && cents <= 100_000_000 ? cents : null;
}

const PROVIDERS: Record<string, string> = { bold: "Bold", epayco: "ePayco", mercadopago: "Mercado Pago", mock: "Pago de prueba", manual: "Manual" };
const METHODS: Record<string, string> = {
  CARD: "Tarjeta",
  CREDIT_CARD: "Tarjeta",
  DEBIT_CARD: "Tarjeta débito",
  TC: "Tarjeta",
  PSE: "PSE",
  NEQUI: "Nequi",
  DAVIPLATA: "Daviplata",
  BOTON_BANCOLOMBIA: "Botón Bancolombia",
  BANCOLOMBIA_TRANSFER: "Botón Bancolombia",
  EFECTY: "Efecty",
  CASH: "Efectivo",
};

/** «Bold · PSE», «ePayco · Tarjeta (cobro en USD)». */
export function paymentLabel(provider: string, method: string | null | undefined, chargeCurrency?: string | null): string {
  const p = PROVIDERS[provider] ?? (provider ? provider.charAt(0).toUpperCase() + provider.slice(1) : "Sin pasarela");
  const key = String(method ?? "").trim().toUpperCase().replace(/[\s-]+/g, "_");
  const m = key ? (METHODS[key] ?? key.charAt(0) + key.slice(1).toLowerCase().replace(/_/g, " ")) : "";
  return `${p}${m ? ` · ${m}` : ""}${chargeCurrency && chargeCurrency !== "COP" ? ` (cobro en ${chargeCurrency})` : ""}`;
}

export type SaleRow = { total: number; type: "TOPUP" | "ACCOUNT"; costCents: number | null; provider: string; method: string | null; chargeCurrency?: string | null };
/** `counted`: la venta ya se contó en un cierre anterior. `delivered`: llegó a entregarse (el proveedor la cobró). */
export type RefundRow = { total: number; costCents: number | null; counted: boolean; delivered: boolean };
export type DeliveryRow = { costCents: number | null; prize: boolean };
export type RechargeRow = { amountCents: number; rateCop: number };

export type BreakdownLine = { label: string; orders: number; cop: number; costCents: number };
export type Breakdown = { byPayment: BreakdownLine[]; byType: BreakdownLine[]; countFrom?: string };

export type BoxSummary = {
  orders: number;
  salesCop: number;
  /** Costo del proveedor de las ventas (centavos). */
  costCents: number;
  /** Ventas de recargas sin costo guardado (no suman costo). */
  missingCost: number;
  feeCop: number;
  refunds: number;
  refundsCop: number;
  /** Costo que vuelve por reembolsos de ventas que nunca se entregaron (positivo) o que se pierde por entregas reembolsadas que no se habían contado (negativo). */
  refundsCostCents: number;
  deliveries: number;
  deliveriesCostCents: number;
  prizes: number;
  prizesCostCents: number;
  rechargeCents: number;
  rechargeCop: number;
  /** Ganancia estimada: ventas − comisión − costo − reembolsos (costos pasados a pesos con `usdtCop`). */
  profitCop: number;
  usdtCop: number;
  /** Cuadre del saldo del proveedor (null si falta el saldo de partida o el actual). */
  expectedBalanceCents: number | null;
  actualBalanceCents: number | null;
  diffCents: number | null;
  balanceOk: boolean | null;
  breakdown: Breakdown;
};

/** Diferencia aceptada en el cuadre: 1 USD (redondeos y cambios de precio del proveedor entre la compra y la entrega). */
export const BALANCE_TOLERANCE_CENTS = 100;

/** Efecto de un reembolso en la caja: pesos devueltos y costo que vuelve (o se pierde). */
export function refundEffect(r: RefundRow): { cop: number; costCents: number } {
  const cost = r.costCents ?? 0;
  if (r.counted) return { cop: r.total, costCents: r.delivered ? 0 : cost };
  // Pagado y reembolsado dentro de la misma caja: nunca fue venta; si alcanzó a entregarse, ese costo se perdió.
  return { cop: 0, costCents: r.delivered ? -cost : 0 };
}

function addLine(map: Map<string, BreakdownLine>, label: string, cop: number, costCents: number) {
  const row = map.get(label) ?? { label, orders: 0, cop: 0, costCents: 0 };
  row.orders += 1;
  row.cop += cop;
  row.costCents += costCents;
  map.set(label, row);
}

export function summarizeBox(input: {
  sales: SaleRow[];
  refunds: RefundRow[];
  deliveries: DeliveryRow[];
  recharges: RechargeRow[];
  fee: FeeConfig;
  usdtCop: number;
  /** Saldo del proveedor al cierre anterior (centavos), si se conoce. */
  startBalanceCents: number | null;
  /** Saldo del proveedor ahora (centavos), si respondió. */
  actualBalanceCents: number | null;
}): BoxSummary {
  const { sales, refunds, deliveries, recharges, fee, usdtCop } = input;
  const byPayment = new Map<string, BreakdownLine>();
  const byType = new Map<string, BreakdownLine>();
  let salesCop = 0;
  let costCents = 0;
  let missingCost = 0;
  let feeCop = 0;
  for (const s of sales) {
    const cost = s.type === "TOPUP" ? (s.costCents ?? 0) : 0;
    if (s.type === "TOPUP" && s.costCents == null) missingCost += 1;
    salesCop += s.total;
    costCents += cost;
    feeCop += feeFor(s.total, fee);
    addLine(byPayment, paymentLabel(s.provider, s.method, s.chargeCurrency), s.total, cost);
    addLine(byType, s.type === "TOPUP" ? "Recargas de diamantes" : "Cuentas Free Fire", s.total, cost);
  }
  let refundsCop = 0;
  let refundsCostCents = 0;
  for (const r of refunds) {
    const e = refundEffect(r);
    refundsCop += e.cop;
    refundsCostCents += e.costCents;
  }
  let deliveriesCostCents = 0;
  let prizes = 0;
  let prizesCostCents = 0;
  for (const d of deliveries) {
    const c = d.costCents ?? 0;
    deliveriesCostCents += c;
    if (d.prize) {
      prizes += 1;
      prizesCostCents += c;
    }
  }
  const rechargeCents = recharges.reduce((n, r) => n + r.amountCents, 0);
  const rechargeCop = recharges.reduce((n, r) => n + centsToCop(r.amountCents, r.rateCop), 0);
  const profitCop = salesCop - feeCop - centsToCop(costCents - refundsCostCents, usdtCop) - refundsCop;

  const expectedBalanceCents = input.startBalanceCents == null ? null : input.startBalanceCents + rechargeCents - deliveriesCostCents;
  const diffCents = expectedBalanceCents == null || input.actualBalanceCents == null ? null : input.actualBalanceCents - expectedBalanceCents;
  const sort = (m: Map<string, BreakdownLine>) => [...m.values()].sort((a, b) => b.cop - a.cop || a.label.localeCompare(b.label));
  return {
    orders: sales.length,
    salesCop,
    costCents,
    missingCost,
    feeCop,
    refunds: refunds.length,
    refundsCop,
    refundsCostCents,
    deliveries: deliveries.length,
    deliveriesCostCents,
    prizes,
    prizesCostCents,
    rechargeCents,
    rechargeCop,
    profitCop,
    usdtCop,
    expectedBalanceCents,
    actualBalanceCents: input.actualBalanceCents,
    diffCents,
    balanceOk: diffCents == null ? null : Math.abs(diffCents) <= BALANCE_TOLERANCE_CENTS,
    breakdown: { byPayment: sort(byPayment), byType: sort(byType) },
  };
}

/** «12.34» con dos decimales (montos del proveedor). */
export const formatUsd = (cents: number) => (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Ganancia estimada de un cierre guardado (misma fórmula que la caja abierta). */
export function closeProfit(c: { salesCop: number; feeCop: number; costCents: number; refundsCostCents: number; refundsCop: number; usdtCop: number }): number {
  return c.salesCop - c.feeCop - centsToCop(c.costCents - c.refundsCostCents, c.usdtCop) - c.refundsCop;
}

/** Diferencia del cuadre de un cierre guardado (saldo real − saldo esperado), o null si no se pudo cuadrar. */
export function closeDiff(c: { supplierBalanceCents: number | null; expectedBalanceCents: number | null }): number | null {
  return c.supplierBalanceCents == null || c.expectedBalanceCents == null ? null : c.supplierBalanceCents - c.expectedBalanceCents;
}

/** Date → «YYYY-MM-DDTHH:mm» en hora de Colombia (para inputs datetime-local). */
export function toBogotaInput(d: Date): string {
  return new Date(d.getTime() - 5 * 3_600_000).toISOString().slice(0, 16);
}
