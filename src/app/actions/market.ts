"use server";

import { cookies } from "next/headers";
import { normalizeCountry } from "@/domain/market";
import { GEO_COOKIE } from "@/server/geo";

/** País elegido a mano para los precios (vacío = volver a la detección automática). */
export async function setCountryAction(country: string) {
  const jar = await cookies();
  const c = normalizeCountry(country);
  if (!c) {
    jar.delete(GEO_COOKIE);
    return;
  }
  jar.set(GEO_COOKIE, c, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 365 * 86400 });
}
