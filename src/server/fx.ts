import "server-only";
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

/** Actualiza las tasas si tienen más de 12 horas. Nunca lanza error. */
export async function ensureFxRates(now = new Date()): Promise<boolean> {
  const current = await getFx();
  if (current && now.getTime() - new Date(current.at).getTime() < MAX_AGE_MS) return false;
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", { cache: "no-store", signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = (await res.json()) as { result?: string; rates?: Record<string, number> };
    if (j.result !== "success" || !j.rates || !(j.rates.COP > 1000)) throw new Error("Respuesta inesperada");
    const rates = Object.fromEntries(KEEP.filter((c) => j.rates![c] > 0).map((c) => [c, j.rates![c]]));
    await saveSettings({ fxRates: JSON.stringify({ at: now.toISOString(), rates }) });
    return true;
  } catch (e) {
    console.error("[tasas] no se pudieron actualizar:", (e as Error).message);
    return false;
  }
}
