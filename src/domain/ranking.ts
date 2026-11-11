/**
 * «Top 3 del mes»: reglas puras (sin base de datos), para usarlas en el servidor y en las pruebas.
 * El mes es el calendario de Colombia (UTC−5, sin horario de verano).
 */

const BOGOTA_OFFSET_MS = 5 * 3600_000;
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export type RankingPeriod = {
  /** «2026-11» */
  key: string;
  /** Inicio (incluido) y fin (excluido) del mes, en hora de Colombia. */
  start: Date;
  end: Date;
  /** «noviembre» */
  month: string;
  year: number;
};

function periodFromParts(year: number, month0: number): RankingPeriod {
  const start = new Date(Date.UTC(year, month0, 1) + BOGOTA_OFFSET_MS);
  const end = new Date(Date.UTC(year, month0 + 1, 1) + BOGOTA_OFFSET_MS);
  return { key: `${year}-${String(month0 + 1).padStart(2, "0")}`, start, end, month: MONTHS[month0], year };
}

/** Mes (de Colombia) al que pertenece una fecha. */
export function periodOf(d: Date = new Date()): RankingPeriod {
  const local = new Date(d.getTime() - BOGOTA_OFFSET_MS);
  return periodFromParts(local.getUTCFullYear(), local.getUTCMonth());
}

export function previousPeriod(p: RankingPeriod): RankingPeriod {
  return periodOf(new Date(p.start.getTime() - 1));
}

/** «2026-11» → mes; null si el texto no es un mes válido. */
export function parsePeriodKey(key: string): RankingPeriod | null {
  const m = /^(\d{4})-(\d{2})$/.exec(key);
  if (!m) return null;
  const month0 = Number(m[2]) - 1;
  if (month0 < 0 || month0 > 11) return null;
  return periodFromParts(Number(m[1]), month0);
}

/** Primera temporada del Top 3 (lanzamiento). Los meses anteriores no fueron concurso: no tienen premios. */
export const FIRST_SEASON = "2026-11";
export const isSeason = (key: string) => key >= FIRST_SEASON;

/** Premios por puesto: cantidad de diamantes del paquete (p. ej. «2180,1060,520»). */
export const DEFAULT_PRIZES = [2180, 1060, 520];

export function parsePrizes(raw: string | null | undefined): number[] {
  const list = (raw ?? "")
    .split(",")
    .map((x) => Number(x.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
  return list.length === 3 ? list : DEFAULT_PRIZES;
}

export function parseMinCop(raw: string | null | undefined): number {
  const n = Number(String(raw ?? "").replace(/\D/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : 120_000;
}

/** «12****89»: solo los dos primeros y los dos últimos dígitos del ID (igual que «Entregas en vivo»). */
export function maskPlayer(id: string | null | undefined): string | null {
  const d = (id ?? "").replace(/\D/g, "");
  if (d.length < 6) return null;
  return `${d.slice(0, 2)}****${d.slice(-2)}`;
}

export type RankEntry = { total: number; lastPaidAt: Date };

/** Más pagado primero; si empatan, gana quien llegó primero a ese monto (su última compra contada es anterior). */
export function compareRank(a: RankEntry, b: RankEntry): number {
  return b.total - a.total || a.lastPaidAt.getTime() - b.lastPaidAt.getTime();
}
