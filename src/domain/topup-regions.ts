/**
 * Regiones de recarga del proveedor mayorista y reglas de precio (funciones puras, cubiertas por tests/).
 * El slug es el del proveedor ("latam", "brazil"…); el nombre que se muestra va en español.
 */

export const DEFAULT_TOPUP_REGION = "latam";

const REGION_META: Record<string, { label: string; flag?: string }> = {
  latam: { label: "Latinoamérica" },
  brazil: { label: "Brasil", flag: "BR" },
  eu: { label: "Europa", flag: "EU" },
  mena: { label: "Medio Oriente" },
  cis: { label: "CIS (Rusia y vecinos)" },
  indonesia: { label: "Indonesia", flag: "ID" },
  philippines: { label: "Filipinas", flag: "PH" },
  singapore: { label: "Singapur", flag: "SG" },
  "singapore-malaysia": { label: "Singapur / Malasia", flag: "MY" },
  "sg-my-kh-first-recharge-bonus": { label: "SG/MY/KH · primera recarga" },
  taiwan: { label: "Taiwán", flag: "TW" },
  thailand: { label: "Tailandia", flag: "TH" },
  vietnam: { label: "Vietnam", flag: "VN" },
  cambodia: { label: "Camboya", flag: "KH" },
  bangladesh: { label: "Bangladesh", flag: "BD" },
};

/** Orden fijo de regiones: primero las de los clientes de la tienda (Latinoamérica, Brasil), luego alfabético. */
export function compareRegions(a: { slug: string; label: string }, b: { slug: string; label: string }): number {
  const rank = (slug: string) => (slug === DEFAULT_TOPUP_REGION ? 0 : slug === "brazil" ? 1 : 2);
  return rank(a.slug) - rank(b.slug) || a.label.localeCompare(b.label, "es");
}

export function regionLabel(slug: string | null | undefined, fallback?: string | null): string {
  if (!slug) return fallback ?? "—";
  return REGION_META[slug]?.label ?? fallback ?? slug;
}

export function regionFlag(slug: string | null | undefined): string | null {
  return (slug && REGION_META[slug]?.flag) || null;
}

/** Compara el nombre de región que devuelve el verificador ("LATAM", "Brazil") con un slug o nombre del catálogo. */
export function sameRegion(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return norm(a) === norm(b);
}

/**
 * El proveedor vende el total (ej. 110) y Garena lo anuncia como base + bonus (100 + 10).
 * Paquetes estándar: separación conocida. Los demás: el 10 % del total se muestra como bonus.
 * El cliente siempre ve también el total que recibe.
 */
const STANDARD_SPLIT: Record<number, [number, number]> = {
  110: [100, 10],
  341: [310, 31],
  572: [520, 52],
  1166: [1060, 106],
  2398: [2180, 218],
  6160: [5600, 560],
};

export function splitBonus(amount: number): { diamonds: number; bonusDiamonds: number } {
  const s = STANDARD_SPLIT[amount];
  if (s) return { diamonds: s[0], bonusDiamonds: s[1] };
  const bonus = Math.round(amount * 0.1);
  return { diamonds: amount - bonus, bonusDiamonds: bonus };
}

/** Costo del proveedor convertido a pesos (redondeado al peso). */
export function costInCop(costCents: number, usdtCop: number): number {
  return Math.round((costCents / 100) * usdtCop);
}

/** Precio psicológico: $150.000 → $149.999 (solo precios redondos desde $1.000). */
export function charmPrice(price: number): number {
  return price >= 1000 && price % 500 === 0 ? price - 1 : price;
}

/** Precio sugerido: costo en pesos + margen, redondeado hacia arriba a $500 y terminado en 9 (ej. $3.499). */
export function suggestedPrice(costCents: number, usdtCop: number, marginPct: number): number {
  const raw = (costCents / 100) * usdtCop * (1 + marginPct / 100);
  return charmPrice(Math.max(500, Math.ceil(raw / 500) * 500));
}

/** Margen sobre el precio de venta, en %. null si no se conoce el costo. */
export function marginOf(priceCop: number, costCents: number | null | undefined, usdtCop: number): number | null {
  if (costCents == null || !priceCop) return null;
  return Math.round(((priceCop - costInCop(costCents, usdtCop)) / priceCop) * 1000) / 10;
}

export function parseRegionList(value: string | null | undefined): string[] {
  const list = (value ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => /^[a-z0-9-]{2,60}$/.test(s));
  return [...new Set(list)];
}

/** Clave de producto del proveedor para Free Fire: "topup/free-fire/<región>/<nombre>". */
export function isFreeFireProductKey(key: string | null | undefined): key is string {
  return !!key && /^topup\/free-fire\/[a-z0-9-]+\/.+/.test(key);
}

/** Margen mínimo (%) para no vender a pérdida: cubre comisión de la pasarela y variaciones del USDT. */
export const MIN_MARGIN_PCT = 10;

export type LatamReference = { amount: number; price: number; costCents: number | null };

/**
 * Precio de un paquete de otra región con la lógica de LATAM:
 *  - se compara con el escalón de LATAM de la misma cantidad (o el más cercano),
 *  - se busca el mismo margen que ese escalón deja hoy,
 *  - sin pasar el precio de LATAM (mismo escalón, o el mismo precio por diamante si la cantidad no existe allá),
 *  - con un margen mínimo para no perder plata (si el tope no lo permite, el precio sube lo justo).
 * Redondeo a $500 y precio psicológico ($149.999).
 */
export function regionalPrice(input: { amount: number; costCents: number; usdtCop: number; latam: LatamReference[]; minMarginPct?: number }) {
  const { amount, costCents, usdtCop, latam } = input;
  const minMargin = (input.minMarginPct ?? MIN_MARGIN_PCT) / 100;
  const cost = (costCents / 100) * usdtCop;
  const refs = latam.filter((r) => r.amount > 0 && r.price > 0);
  if (refs.length === 0) return null;
  const exact = refs.find((r) => r.amount === amount);
  const ref = exact ?? refs.reduce((best, r) => (Math.abs(Math.log(r.amount / amount)) < Math.abs(Math.log(best.amount / amount)) ? r : best));
  const refMargin = ref.costCents != null ? (ref.price - costInCop(ref.costCents, usdtCop)) / ref.price : 0.3;
  const ceiling = exact ? exact.price : Math.floor(((ref.price / ref.amount) * amount) / 500) * 500;
  const target = Math.ceil(cost / (1 - Math.max(refMargin, minMargin)) / 500) * 500;
  const floor = Math.ceil(cost / (1 - minMargin) / 500) * 500;
  let price = Math.min(target, ceiling);
  const aboveLatam = price < floor;
  if (aboveLatam) price = floor;
  price = charmPrice(Math.max(500, price));
  return { price, ref: { amount: ref.amount, price: ref.price }, exact: !!exact, ceiling, aboveLatam, marginPct: Math.round(((price - cost) / price) * 1000) / 10 };
}
