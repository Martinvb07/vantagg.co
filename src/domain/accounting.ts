/**
 * Contabilidad (Panel → Contabilidad): reglas puras, sin base de datos, para el panel, el libro de ventas y las pruebas.
 *
 * - Una venta cuenta el día en que se pagó (hora de Colombia), aunque después se reembolse.
 * - Un reembolso es otro movimiento: resta el día en que se hizo. Si la recarga nunca se entregó, su costo vuelve.
 * - Los premios del Top 3 no son ventas: su costo se resta el día en que se entregaron.
 * - El costo del proveedor se pasa a pesos con la tasa guardada en el pedido (o la tasa actual si es un pedido viejo).
 */
import { centsToCop, feeFor, paymentLabel, type FeeConfig } from "@/domain/cash";

const OFFSET_MS = 5 * 3_600_000; // Colombia: UTC−5, sin horario de verano
const DAY_MS = 86_400_000;
const YMD = /^\d{4}-\d{2}-\d{2}$/;
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MONTHS_LONG = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** Fecha → «2026-11-15» (día en Colombia). */
export const bogotaYmd = (d: Date) => new Date(d.getTime() - OFFSET_MS).toISOString().slice(0, 10);
/** «2026-11-15» → inicio de ese día en Colombia. */
export const ymdStart = (ymd: string) => new Date(`${ymd}T00:00:00-05:00`);
const addDays = (ymd: string, n: number) => new Date(ymdStart(ymd).getTime() + n * DAY_MS + OFFSET_MS).toISOString().slice(0, 10);
const isYmd = (s: string | undefined | null): s is string => !!s && YMD.test(s) && !Number.isNaN(ymdStart(s).getTime());

export const PRESETS = [
  { key: "hoy", label: "Hoy" },
  { key: "ayer", label: "Ayer" },
  { key: "semana", label: "Esta semana" },
  { key: "mes", label: "Este mes" },
  { key: "mes-pasado", label: "Mes pasado" },
  { key: "30d", label: "Últimos 30 días" },
  { key: "anio", label: "Este año" },
] as const;
export type PresetKey = (typeof PRESETS)[number]["key"];

export type Period = {
  /** «2026-11-01» y «2026-11-15» (ambos incluidos). */
  fromYmd: string;
  toYmd: string;
  /** Inicio (incluido) y fin (excluido) en tiempo real. */
  start: Date;
  end: Date;
  days: number;
  preset: PresetKey | null;
  label: string;
};

function makePeriod(fromYmd: string, toYmd: string, preset: PresetKey | null): Period {
  if (fromYmd > toYmd) [fromYmd, toYmd] = [toYmd, fromYmd];
  const start = ymdStart(fromYmd);
  const end = ymdStart(addDays(toYmd, 1));
  const days = Math.round((end.getTime() - start.getTime()) / DAY_MS);
  return { fromYmd, toYmd, start, end, days, preset, label: preset ? PRESETS.find((p) => p.key === preset)!.label : periodLabel(fromYmd, toYmd) };
}

/** Rango de un atajo («Este mes», «Ayer»…) según la fecha de hoy en Colombia. */
export function presetPeriod(key: PresetKey, now = new Date()): Period {
  const today = bogotaYmd(now);
  const [y, m] = today.split("-").map(Number);
  const first = (yy: number, mm: number) => `${yy}-${String(mm).padStart(2, "0")}-01`;
  switch (key) {
    case "hoy":
      return makePeriod(today, today, key);
    case "ayer": {
      const d = addDays(today, -1);
      return makePeriod(d, d, key);
    }
    case "semana": {
      const dow = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7; // lunes = 0
      return makePeriod(addDays(today, -dow), today, key);
    }
    case "mes":
      return makePeriod(first(y, m), today, key);
    case "mes-pasado": {
      const py = m === 1 ? y - 1 : y;
      const pm = m === 1 ? 12 : m - 1;
      return makePeriod(first(py, pm), addDays(first(y, m), -1), key);
    }
    case "30d":
      return makePeriod(addDays(today, -29), today, key);
    case "anio":
      return makePeriod(`${y}-01-01`, today, key);
  }
}

/** Periodo pedido en la dirección: atajo (`p`) o fechas (`desde`/`hasta`). Por defecto, este mes. */
export function resolvePeriod(sp: { p?: string; desde?: string; hasta?: string }, now = new Date()): Period {
  if (isYmd(sp.desde) || isYmd(sp.hasta)) {
    const from = isYmd(sp.desde) ? sp.desde : (sp.hasta as string);
    const to = isYmd(sp.hasta) ? sp.hasta : bogotaYmd(now);
    return makePeriod(from, to, null);
  }
  const preset = PRESETS.find((p) => p.key === sp.p)?.key ?? "mes";
  return presetPeriod(preset, now);
}

/** Mismo largo, justo antes (para comparar). */
export function previousPeriod(p: Period): Period {
  return makePeriod(addDays(p.fromYmd, -p.days), addDays(p.fromYmd, -1), null);
}

/** «15 nov 2026» o «1 – 15 nov 2026». */
export function periodLabel(fromYmd: string, toYmd: string): string {
  const f = (ymd: string, year = true) => {
    const [y, m, d] = ymd.split("-").map(Number);
    return `${d} ${MONTHS[m - 1]}${year ? ` ${y}` : ""}`;
  };
  if (fromYmd === toYmd) return f(fromYmd);
  const sameYear = fromYmd.slice(0, 4) === toYmd.slice(0, 4);
  return `${f(fromYmd, !sameYear)} – ${f(toYmd)}`;
}

export type SaleRow = {
  paidAt: Date;
  subtotal: number;
  discount: number;
  total: number;
  type: "TOPUP" | "ACCOUNT";
  name: string;
  costCents: number | null;
  /** Tasa del dólar del día de la venta (null: se usa la de hoy). */
  usdtCop: number | null;
  /** De dónde sale el costo: lo que cobró el proveedor, el guardado al vender o el actual del paquete (estimado). */
  costKind?: CostKind;
  provider: string;
  method: string | null;
  chargeCurrency?: string | null;
  /** Correo normalizado (para contar compradores distintos). */
  buyer: string;
};
export type CostKind = "real" | "venta" | "estimado";
export type ExpenseRow = { day: string; category: string; amountCop: number };
export type RefundRow = { refundedAt: Date; total: number; type: "TOPUP" | "ACCOUNT"; costCents: number | null; usdtCop: number | null; delivered: boolean };
export type PrizeRow = { deliveredAt: Date; costCents: number | null; usdtCop: number | null };

export type Bucket = { key: string; label: string; orders: number; salesCop: number; refundsCop: number; netCop: number; costCop: number; profitCop: number };
/** `missingCost`: ventas de recargas de la línea sin ningún costo (su ganancia sale inflada). */
export type Line = { label: string; orders: number; salesCop: number; costCop: number; profitCop: number; missingCost: number };

export type AccountingSummary = {
  orders: number;
  buyers: number;
  /** Precio de lista (antes de descuentos). */
  grossCop: number;
  discountCop: number;
  /** Total cobrado. */
  salesCop: number;
  refunds: number;
  refundsCop: number;
  netCop: number;
  costCents: number;
  costCop: number;
  /** Costo que vuelve por reembolsos de recargas que no se entregaron. */
  costBackCop: number;
  prizes: number;
  prizesCostCop: number;
  feeCop: number;
  /** Ganancia bruta: ventas netas − costo de lo vendido (+ costo que vuelve por reembolsos). */
  grossProfitCop: number;
  /** Gastos del negocio anotados (publicidad, bancos…). */
  expensesCop: number;
  expensesByCategory: Array<{ label: string; count: number; cop: number }>;
  /** Ganancia neta: bruta − comisión − premios − gastos. */
  profitCop: number;
  /** Ganancia neta sobre ventas netas (%), o null sin ventas. */
  marginPct: number | null;
  avgTicketCop: number;
  missingCost: number;
  /** Cuántas ventas de recargas usan cada fuente de costo. */
  costKinds: Record<CostKind, number>;
  granularity: "day" | "month";
  series: Bucket[];
  byPayment: Line[];
  byProduct: Line[];
  byType: Line[];
};

const rowCop = (cents: number | null, rate: number | null, current: number) => (cents ? centsToCop(cents, rate && rate > 0 ? rate : current) : 0);

function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return `${MONTHS_LONG[m - 1]} ${y}`;
}

/** Cubetas vacías del periodo (todos los días o meses, aunque no haya ventas). */
function emptySeries(p: Pick<Period, "fromYmd" | "toYmd" | "days">, granularity: "day" | "month"): Map<string, Bucket> {
  const out = new Map<string, Bucket>();
  const blank = (key: string, label: string): Bucket => ({ key, label, orders: 0, salesCop: 0, refundsCop: 0, netCop: 0, costCop: 0, profitCop: 0 });
  if (granularity === "day") {
    for (let i = 0; i < p.days; i++) {
      const k = addDays(p.fromYmd, i);
      const [, m, d] = k.split("-").map(Number);
      out.set(k, blank(k, `${d} ${MONTHS[m - 1]}`));
    }
  } else {
    let k = p.fromYmd.slice(0, 7);
    const last = p.toYmd.slice(0, 7);
    while (k <= last) {
      out.set(k, blank(k, monthLabel(k)));
      const [y, m] = k.split("-").map(Number);
      k = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
    }
  }
  return out;
}

export function summarizeAccounting(input: {
  period: Pick<Period, "fromYmd" | "toYmd" | "days">;
  sales: SaleRow[];
  refunds: RefundRow[];
  prizes: PrizeRow[];
  /** Gastos del negocio del periodo (día en hora de Colombia). */
  expenses?: ExpenseRow[];
  fee: FeeConfig;
  /** Tasa actual (para pedidos viejos sin tasa guardada). */
  usdtCop: number;
}): AccountingSummary {
  const { sales, refunds, prizes, fee, usdtCop } = input;
  const granularity = input.period.days > 62 ? "month" : "day";
  const series = emptySeries(input.period, granularity);
  const bucketOf = (d: Date) => {
    const ymd = bogotaYmd(d);
    return series.get(granularity === "day" ? ymd : ymd.slice(0, 7));
  };
  const payment = new Map<string, Line>();
  const product = new Map<string, Line>();
  const type = new Map<string, Line>();
  const add = (map: Map<string, Line>, label: string, sale: number, cost: number, profit: number, missing = 0) => {
    const l = map.get(label) ?? { label, orders: 0, salesCop: 0, costCop: 0, profitCop: 0, missingCost: 0 };
    l.orders += 1;
    l.missingCost += missing;
    l.salesCop += sale;
    l.costCop += cost;
    l.profitCop += profit;
    map.set(label, l);
  };

  let grossCop = 0;
  let discountCop = 0;
  let salesCop = 0;
  let costCents = 0;
  let costCop = 0;
  let feeCop = 0;
  let missingCost = 0;
  const costKinds: Record<CostKind, number> = { real: 0, venta: 0, estimado: 0 };
  const buyers = new Set<string>();
  for (const s of sales) {
    const cents = s.type === "TOPUP" ? (s.costCents ?? 0) : 0;
    if (s.type === "TOPUP" && s.costCents == null) missingCost += 1;
    if (s.type === "TOPUP" && s.costCents != null) costKinds[s.costKind ?? "venta"] += 1;
    const cost = rowCop(cents, s.usdtCop, usdtCop);
    const fee1 = feeFor(s.total, fee);
    const profit = s.total - fee1 - cost;
    grossCop += s.subtotal;
    discountCop += s.discount;
    salesCop += s.total;
    costCents += cents;
    costCop += cost;
    feeCop += fee1;
    buyers.add(s.buyer);
    const b = bucketOf(s.paidAt);
    if (b) {
      b.orders += 1;
      b.salesCop += s.total;
      b.costCop += cost;
      b.profitCop += profit;
    }
    const miss = s.type === "TOPUP" && s.costCents == null ? 1 : 0;
    add(payment, paymentLabel(s.provider, s.method, s.chargeCurrency), s.total, cost, profit, miss);
    add(product, s.type === "TOPUP" ? s.name : "Cuentas Free Fire", s.total, cost, profit, miss);
    add(type, s.type === "TOPUP" ? "Recargas de diamantes" : "Cuentas Free Fire", s.total, cost, profit, miss);
  }

  let refundsCop = 0;
  let costBackCop = 0;
  for (const r of refunds) {
    const back = !r.delivered && r.type === "TOPUP" ? rowCop(r.costCents, r.usdtCop, usdtCop) : 0;
    refundsCop += r.total;
    costBackCop += back;
    const b = bucketOf(r.refundedAt);
    if (b) {
      b.refundsCop += r.total;
      b.costCop -= back;
      b.profitCop += back - r.total;
    }
  }

  let prizesCostCop = 0;
  for (const p of prizes) {
    const cost = rowCop(p.costCents, p.usdtCop, usdtCop);
    prizesCostCop += cost;
    const b = bucketOf(p.deliveredAt);
    if (b) {
      b.costCop += cost;
      b.profitCop -= cost;
    }
  }
  let expensesCop = 0;
  const byCategory = new Map<string, { label: string; count: number; cop: number }>();
  for (const e of input.expenses ?? []) {
    expensesCop += e.amountCop;
    const c = byCategory.get(e.category) ?? { label: e.category, count: 0, cop: 0 };
    c.count += 1;
    c.cop += e.amountCop;
    byCategory.set(e.category, c);
    const b = series.get(granularity === "day" ? e.day : e.day.slice(0, 7));
    if (b) b.profitCop -= e.amountCop;
  }
  for (const b of series.values()) b.netCop = b.salesCop - b.refundsCop;

  const netCop = salesCop - refundsCop;
  const grossProfitCop = netCop - costCop + costBackCop;
  const profitCop = grossProfitCop - feeCop - prizesCostCop - expensesCop;
  const sort = (m: Map<string, Line>) => [...m.values()].sort((a, b) => b.salesCop - a.salesCop || a.label.localeCompare(b.label));
  return {
    orders: sales.length,
    buyers: buyers.size,
    grossCop,
    discountCop,
    salesCop,
    refunds: refunds.length,
    refundsCop,
    netCop,
    costCents,
    costCop,
    costBackCop,
    prizes: prizes.length,
    prizesCostCop,
    feeCop,
    grossProfitCop,
    expensesCop,
    expensesByCategory: [...byCategory.values()].sort((a, b) => b.cop - a.cop),
    profitCop,
    marginPct: netCop > 0 ? Math.round((profitCop / netCop) * 1000) / 10 : null,
    avgTicketCop: sales.length ? Math.round(salesCop / sales.length) : 0,
    missingCost,
    costKinds,
    granularity,
    series: [...series.values()],
    byPayment: sort(payment),
    byProduct: sort(product),
    byType: sort(type),
  };
}

/** Cambio porcentual frente al periodo anterior (null si antes no hubo nada). */
export function changePct(now: number, before: number): number | null {
  if (!before) return null;
  return Math.round(((now - before) / Math.abs(before)) * 1000) / 10;
}

/** «2026-11» → primer y último día de ese mes. */
export function monthRange(key: string): { from: string; to: string } {
  const [y, m] = key.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${key}-01`, to: `${key}-${String(last).padStart(2, "0")}` };
}
