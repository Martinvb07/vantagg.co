import "server-only";
import { db } from "@/lib/db";
import { bogotaYmd } from "@/domain/accounting";
import { getSettings, saveSettings } from "./settings";

/**
 * Tasas de cambio del día (base: dólar), de la fuente pública open.er-api.com. Se actualizan cada 12 horas desde el
 * mantenimiento automático y se guardan en Ajustes, así ninguna visita espera a un servicio externo.
 */

const MAX_AGE_MS = 12 * 3600_000;
const KEEP = ["COP", "MXN", "PEN", "CLP", "ARS", "BOB", "PYG", "UYU", "BRL", "CRC", "GTQ", "HNL", "NIO", "DOP", "CAD", "GBP", "EUR", "IDR", "USD"];

export type FxRates = { at: string; rates: Record<string, number> };

export function parseFx(raw: string | undefined): FxRates | null {
  try {
    const j = JSON.parse(raw || "") as FxRates;
    return j && typeof j.at === "string" && j.rates && Number(j.rates.COP) > 1000 ? j : null;
  } catch {
    return null;
  }
}

export async function getFx(): Promise<FxRates | null> {
  return parseFx((await getSettings()).fxRates);
}

/** Guarda la tasa del dólar de hoy (hora de Colombia) en el historial diario. */
async function saveDay(rates: Record<string, number>, at: Date) {
  const cop = Number(rates.COP);
  if (!(cop > 1000 && cop < 20_000)) return;
  const day = bogotaYmd(at);
  await db.fxDay.upsert({ where: { day }, create: { day, copPerUsd: cop, source: "mercado" }, update: { copPerUsd: cop, source: "mercado" } });
}

/** Actualiza las tasas si tienen más de 12 horas. Nunca lanza error. */
export async function ensureFxRates(now = new Date()): Promise<boolean> {
  const current = await getFx();
  if (current && now.getTime() - new Date(current.at).getTime() < MAX_AGE_MS) {
    // El historial del día se llena aunque la tasa aún esté vigente (p. ej. justo después de este cambio).
    if (bogotaYmd(new Date(current.at)) === bogotaYmd(now) && !(await db.fxDay.findUnique({ where: { day: bogotaYmd(now) } }).catch(() => true))) {
      await saveDay(current.rates, now).catch(() => {});
    }
    return false;
  }
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", { cache: "no-store", signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = (await res.json()) as { result?: string; rates?: Record<string, number> };
    if (j.result !== "success" || !j.rates || !(j.rates.COP > 1000)) throw new Error("Respuesta inesperada");
    const rates = Object.fromEntries(KEEP.filter((c) => j.rates![c] > 0).map((c) => [c, j.rates![c]]));
    await saveSettings({ fxRates: JSON.stringify({ at: now.toISOString(), rates }) });
    await saveDay(rates, now).catch((e) => console.error("[tasas] no se pudo guardar el día:", (e as Error).message));
    return true;
  } catch (e) {
    console.error("[tasas] no se pudieron actualizar:", (e as Error).message);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Tasa de cada día (para la contabilidad): la de mercado guardada ese día o, para días pasados, la TRM oficial.
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;
const addDays = (ymd: string, n: number) => new Date(new Date(`${ymd}T12:00:00Z`).getTime() + n * DAY_MS).toISOString().slice(0, 10);

/** Tasa del dólar ahora: la de mercado del día; si no hay, la configurada en Proveedor. */
export async function currentUsdCop(): Promise<{ rate: number; source: "mercado" | "configurada"; at: string | null }> {
  const fx = await getFx();
  if (fx && Number(fx.rates.COP) > 1000) return { rate: Number(fx.rates.COP), source: "mercado", at: fx.at };
  const s = await getSettings();
  return { rate: Number(s.usdtCop) > 0 ? Number(s.usdtCop) : 3400, source: "configurada", at: null };
}

/**
 * Tasas de los días entre `fromYmd` y `toYmd`: la del día si existe; si no, la del último día anterior con tasa
 * (fines de semana, festivos). Días sin ninguna tasa previa quedan fuera (quien llame usa la de hoy).
 */
export async function dayRates(fromYmd: string, toYmd: string): Promise<Map<string, { rate: number; source: string }>> {
  const rows = await db.fxDay.findMany({ where: { day: { gte: addDays(fromYmd, -20), lte: toYmd } }, orderBy: { day: "asc" } });
  const out = new Map<string, { rate: number; source: string }>();
  let last: { rate: number; source: string } | null = null;
  let i = 0;
  for (let d = addDays(fromYmd, -20); d <= toYmd; d = addDays(d, 1)) {
    while (i < rows.length && rows[i].day <= d) {
      last = { rate: rows[i].copPerUsd, source: rows[i].source };
      i++;
    }
    if (last && d >= fromYmd) out.set(d, last);
  }
  return out;
}

const TRM_URL = "https://www.datos.gov.co/resource/32sa-8pi3.json";
const HISTORY_RETRY_MS = 6 * 3600_000;

/**
 * Rellena los días pasados sin tasa (desde la primera venta) con la TRM oficial (datos.gov.co). No toca los días que ya
 * tienen la tasa de mercado. Se intenta como mucho cada 6 horas; nunca lanza error.
 */
export async function ensureFxHistory(now = new Date(), opts: { from?: string } = {}): Promise<number> {
  try {
    const s = await getSettings();
    if (s.fxHistoryAt && now.getTime() - new Date(s.fxHistoryAt).getTime() < HISTORY_RETRY_MS) return 0;
    let from = opts.from;
    if (!from) {
      const first = await db.order.findFirst({ where: { isTest: false, paidAt: { not: null } }, orderBy: { paidAt: "asc" }, select: { paidAt: true } });
      if (!first?.paidAt) return 0;
      from = bogotaYmd(first.paidAt);
    }
    const today = bogotaYmd(now);
    const have = new Set((await db.fxDay.findMany({ where: { day: { gte: from } }, select: { day: true } })).map((r) => r.day));
    const missing: string[] = [];
    for (let d = from; d < today; d = addDays(d, 1)) if (!have.has(d)) missing.push(d);
    if (!missing.length) return 0;
    await saveSettings({ fxHistoryAt: now.toISOString() });
    const qs = new URLSearchParams({ $select: "valor,vigenciadesde,vigenciahasta", $where: `vigenciahasta >= '${missing[0]}T00:00:00.000'`, $order: "vigenciadesde ASC", $limit: "2000" });
    const res = await fetch(`${TRM_URL}?${qs}`, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows = ((await res.json()) as Array<{ valor?: string; vigenciadesde?: string; vigenciahasta?: string }>)
      .map((r) => ({ rate: Number(String(r.valor ?? "").replace(/,/g, "")), from: String(r.vigenciadesde ?? "").slice(0, 10), to: String(r.vigenciahasta ?? "").slice(0, 10) }))
      .filter((r) => r.rate > 1000 && r.rate < 20_000 && /^\d{4}-\d{2}-\d{2}$/.test(r.from) && /^\d{4}-\d{2}-\d{2}$/.test(r.to));
    let saved = 0;
    for (const day of missing) {
      const trm = rows.find((r) => r.from <= day && day <= r.to);
      if (!trm) continue;
      await db.fxDay.create({ data: { day, copPerUsd: trm.rate, source: "TRM" } }).then(() => saved++, () => {});
    }
    return saved;
  } catch (e) {
    console.error("[tasas] no se pudo completar el historial:", (e as Error).message);
    return 0;
  }
}
