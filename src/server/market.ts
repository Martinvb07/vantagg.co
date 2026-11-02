import "server-only";
import { cache } from "react";
import { COUNTRY_NAMES, currencyForCountry, FOREIGN_SURCHARGE_PCT, HOME_COUNTRY } from "@/domain/market";
import { getFx } from "./fx";
import { visitorCountry } from "./geo";
import { getSettings } from "./settings";

/** Lo que la tienda necesita para mostrar precios al visitante según su país (se pasa al navegador). */
export type Market = {
  country: string | null;
  countryName: string | null;
  /** País elegido a mano en el selector (si no, detectado por IP). */
  chosen: boolean;
  /** Colombia (o país desconocido): todo en pesos, sin conversiones. */
  home: boolean;
  /** Moneda local de referencia (MXN, PEN, BRL…). */
  currency: string;
  surchargePct: number;
  copPerUsd: number | null;
  localPerUsd: number | null;
};

export const getMarket = cache(async (): Promise<Market> => {
  const [{ country, source }, fx, s] = await Promise.all([visitorCountry(), getFx(), getSettings()]);
  const currency = currencyForCountry(country);
  const surcharge = Number(s.foreignSurchargePct);
  const copPerUsd = fx?.rates.COP ?? null;
  return {
    country,
    countryName: country ? (COUNTRY_NAMES[country] ?? country) : null,
    chosen: source === "elegido",
    home: !country || country === HOME_COUNTRY || !copPerUsd,
    currency,
    surchargePct: surcharge >= 0 && surcharge <= 50 ? surcharge : FOREIGN_SURCHARGE_PCT,
    copPerUsd,
    localPerUsd: fx?.rates[currency] ?? null,
  };
});
