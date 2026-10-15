/**
 * Catálogos fijos de Free Fire usados por filtros, fichas y panel.
 * Las cuentas guardan el `id` del rango y el `code` de la región.
 */
export const FF_RANKS = [
  { id: "BRONCE", label: "Bronce" },
  { id: "PLATA", label: "Plata" },
  { id: "ORO", label: "Oro" },
  { id: "PLATINO", label: "Platino" },
  { id: "DIAMANTE", label: "Diamante" },
  { id: "HEROICO", label: "Heroico" },
  { id: "GRAN_MAESTRO", label: "Gran Maestro" },
] as const;
export type RankId = (typeof FF_RANKS)[number]["id"];

export const FF_REGIONS = [
  { code: "BR", label: "Brasil", flag: "BR" },
  { code: "LATAM", label: "Latinoamérica Norte", flag: null },
  { code: "SAC", label: "Latinoamérica Sur", flag: null },
  { code: "NA", label: "Norteamérica", flag: null },
  { code: "EU", label: "Europa", flag: "EU" },
  { code: "ID", label: "Indonesia", flag: "ID" },
  { code: "TH", label: "Tailandia", flag: "TH" },
  { code: "VN", label: "Vietnam", flag: "VN" },
  { code: "IND", label: "India", flag: "IN" },
  { code: "TW", label: "Taiwán", flag: "TW" },
  { code: "PK", label: "Pakistán", flag: "PK" },
  { code: "BD", label: "Bangladesh", flag: "BD" },
  { code: "MEA", label: "Medio Oriente y África", flag: null },
] as const;
export type RegionCode = (typeof FF_REGIONS)[number]["code"];

const RANK_ALIASES: Record<string, RankId> = {
  BRONCE: "BRONCE", BRONZE: "BRONCE",
  PLATA: "PLATA", SILVER: "PLATA",
  ORO: "ORO", GOLD: "ORO",
  PLATINO: "PLATINO", PLATINUM: "PLATINO",
  DIAMANTE: "DIAMANTE", DIAMOND: "DIAMANTE",
  HEROICO: "HEROICO", HEROIC: "HEROICO", MAESTRO: "HEROICO", MASTER: "HEROICO",
  GRAN_MAESTRO: "GRAN_MAESTRO", GRANMAESTRO: "GRAN_MAESTRO", GRANDMASTER: "GRAN_MAESTRO", GRAND_MASTER: "GRAN_MAESTRO",
};

/** Normaliza texto libre ("Gran Maestro", "heroic") al id del rango. */
export function toRankId(input: string | null | undefined): RankId | null {
  if (!input) return null;
  const key = input.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim().replace(/\s+/g, "_");
  return RANK_ALIASES[key] ?? RANK_ALIASES[key.replace(/_/g, "")] ?? null;
}

export function rankLabel(id: string | null | undefined): string | null {
  const r = FF_RANKS.find((x) => x.id === toRankId(id));
  return r?.label ?? (id || null);
}

export function regionInfo(code: string | null | undefined) {
  return FF_REGIONS.find((r) => r.code === code) ?? null;
}

/** Límites del filtro de precio (COP). */
export const PRICE_MIN = 50_000;
export const PRICE_MAX = 10_000_000;
export const PRICE_STEP = 50_000;
