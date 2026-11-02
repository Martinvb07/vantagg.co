/**
 * Precios por país (funciones puras, cubiertas por tests/market.test.ts).
 * En Colombia todo es en pesos. Fuera de Colombia el precio es en dólares (lo que cobrará ePayco), con un recargo
 * por la comisión de tarjetas internacionales y la variación del cambio, y la moneda local como referencia (≈).
 */

export const HOME_COUNTRY = "CO";

/** Moneda de referencia de cada país (la que el cliente entiende). Monedas muy inestables → dólares. */
const CURRENCY: Record<string, string> = {
  CO: "COP", MX: "MXN", PE: "PEN", CL: "CLP", AR: "ARS", BO: "BOB", PY: "PYG", UY: "UYU", BR: "BRL",
  EC: "USD", PA: "USD", SV: "USD", PR: "USD", US: "USD", VE: "USD",
  CR: "CRC", GT: "GTQ", HN: "HNL", NI: "NIO", DO: "DOP", CA: "CAD", GB: "GBP", ID: "IDR",
  ES: "EUR", PT: "EUR", FR: "EUR", DE: "EUR", IT: "EUR", NL: "EUR", BE: "EUR", AT: "EUR", IE: "EUR", FI: "EUR", GR: "EUR", LU: "EUR",
};

export function currencyForCountry(country: string | null | undefined): string {
  return (country && CURRENCY[country.toUpperCase()]) || "USD";
}

const LATAM = new Set(["CO", "MX", "PE", "CL", "AR", "BO", "PY", "UY", "EC", "VE", "PA", "CR", "GT", "HN", "NI", "SV", "DO", "PR", "CU"]);
const EUROPE = new Set(["ES", "PT", "FR", "DE", "IT", "NL", "BE", "AT", "IE", "FI", "GR", "LU", "GB", "PL", "SE", "DK", "NO", "CH", "CZ", "RO", "HU", "SK", "SI", "HR", "BG", "LT", "LV", "EE", "CY", "MT"]);

/** Región de Free Fire más probable para un país (solo si la tienda la vende). */
export function regionForCountry(country: string | null | undefined, visible: string[]): string | null {
  const c = (country ?? "").toUpperCase();
  const pick = c === "BR" ? "brazil" : c === "ID" ? "id" : EUROPE.has(c) ? "eu" : LATAM.has(c) ? "latam" : c ? "global" : null;
  return pick && visible.includes(pick) ? pick : null;
}

/** Recargo por defecto fuera de Colombia (%). */
export const FOREIGN_SURCHARGE_PCT = 5;

/**
 * Precio en dólares (centavos) de un precio en pesos: convertido a la tasa del día, más el recargo, redondeado hacia
 * arriba y terminado en 9 (US$ 1,09 · US$ 45,39). Nunca por debajo del precio en pesos convertido.
 */
export function usdPriceCents(cop: number, copPerUsd: number, surchargePct = FOREIGN_SURCHARGE_PCT): number {
  if (!(copPerUsd > 0) || !(cop > 0)) return 0;
  const cents = Math.ceil(((cop / copPerUsd) * (100 + surchargePct)) / 100 * 100);
  return Math.ceil((cents + 1) / 10) * 10 - 1;
}

/** Monto aproximado en la moneda local (unidades) a partir de un precio en dólares (centavos). */
export function localFromUsd(usdCents: number, ratePerUsd: number): number {
  return (usdCents / 100) * ratePerUsd;
}

/** «US$ 1,09», «MXN 19», «R$ 5,90»… Monedas con montos grandes sin decimales. */
export function formatCurrency(amount: number, currency: string): string {
  const noDecimals = ["COP", "CLP", "PYG", "IDR", "CRC", "ARS", "HUF"].includes(currency) || amount >= 1000;
  const prefix: Record<string, string> = { USD: "US$", BRL: "R$", EUR: "€", GBP: "£" };
  const n = new Intl.NumberFormat("es-CO", { minimumFractionDigits: noDecimals ? 0 : 2, maximumFractionDigits: noDecimals ? 0 : 2 }).format(amount);
  return `${prefix[currency] ?? currency} ${n}`;
}

export const COUNTRY_NAMES: Record<string, string> = {
  CO: "Colombia", MX: "México", PE: "Perú", CL: "Chile", AR: "Argentina", BO: "Bolivia", PY: "Paraguay", UY: "Uruguay", EC: "Ecuador",
  VE: "Venezuela", PA: "Panamá", CR: "Costa Rica", GT: "Guatemala", HN: "Honduras", NI: "Nicaragua", SV: "El Salvador", DO: "República Dominicana",
  PR: "Puerto Rico", BR: "Brasil", US: "Estados Unidos", CA: "Canadá", ES: "España", GB: "Reino Unido", ID: "Indonesia",
};

/** País válido (dos letras) o null. */
export function normalizeCountry(v: string | null | undefined): string | null {
  const c = (v ?? "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(c) ? c : null;
}
