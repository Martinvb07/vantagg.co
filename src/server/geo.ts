import "server-only";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";
import { cache } from "react";
import { Reader, type CountryResponse } from "mmdb-lib";
import { normalizeCountry } from "@/domain/market";
import { clientIp } from "@/lib/request";

/**
 * País del visitante por su IP, con la base gratuita «IP to Country Lite» de DB-IP (CC BY 4.0) guardada en el
 * servidor: no se consulta a nadie por cada visita y la IP no se guarda. Se puede corregir a mano con el selector
 * de país (cookie «vx_pais»), por ejemplo si usa VPN. Sin la base, el país queda sin detectar (se trata como Colombia).
 */

export const GEO_COOKIE = "vx_pais";
const DB_PATH = process.env.GEOIP_DB || path.join(process.cwd(), ".geo", "dbip-country-lite.mmdb");

let reader: { r: Reader<CountryResponse>; mtime: number } | null = null;

function getReader() {
  try {
    if (!existsSync(DB_PATH)) return null;
    const mtime = statSync(DB_PATH).mtimeMs;
    if (!reader || reader.mtime !== mtime) reader = { r: new Reader(readFileSync(DB_PATH)), mtime };
    return reader.r;
  } catch (e) {
    console.error("[geo] no se pudo leer la base de países:", (e as Error).message);
    return null;
  }
}

const PRIVATE = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fc|fd|fe80|unknown)/i;

export function countryOfIp(ip: string | null | undefined): string | null {
  if (!ip || PRIVATE.test(ip)) return null;
  const r = getReader();
  if (!r) return null;
  try {
    return normalizeCountry(r.get(ip.replace(/^::ffff:/, ""))?.country?.iso_code);
  } catch {
    return null;
  }
}

/** País del visitante: el que eligió en el selector, o el de su IP. null = no se sabe (se trata como Colombia). */
export const visitorCountry = cache(async (): Promise<{ country: string | null; source: "elegido" | "ip" | null }> => {
  const chosen = normalizeCountry((await cookies()).get(GEO_COOKIE)?.value);
  if (chosen) return { country: chosen, source: "elegido" };
  const dev = normalizeCountry(process.env.GEO_COUNTRY);
  if (dev) return { country: dev, source: "ip" };
  const c = countryOfIp(await clientIp());
  return { country: c, source: c ? "ip" : null };
});

export const geoAvailable = () => existsSync(DB_PATH);
