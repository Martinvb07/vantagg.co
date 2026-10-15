import "server-only";
import { headers } from "next/headers";
import { sha256Hex } from "./crypto";
import { env } from "./env";

/**
 * IP del cliente detrás de un proxy de confianza (Vercel, Nginx…). Se toma el ÚLTIMO
 * valor de X-Forwarded-For porque lo agrega el proxy; los primeros los puede inventar
 * el cliente para saltarse los límites. Con Cloudflare, define TRUSTED_IP_HEADER=cf-connecting-ip.
 * Solo se persiste como hash.
 */
export function ipFromHeaders(h: Headers): string {
  if (env.trustedIpHeader) {
    const v = h.get(env.trustedIpHeader)?.trim();
    if (v) return v.slice(0, 64);
  }
  const xff = h.get("x-forwarded-for")?.split(",").map((s) => s.trim()).filter(Boolean);
  if (xff?.length) return xff[xff.length - 1].slice(0, 64);
  return h.get("x-real-ip")?.trim().slice(0, 64) || "unknown";
}

export async function clientIp(): Promise<string> {
  return ipFromHeaders(await headers());
}

export async function clientIpHash(): Promise<string> {
  return sha256Hex(`${await clientIp()}|${env.authSecret ?? "dev"}`).slice(0, 32);
}

/**
 * Protección CSRF para rutas API que mutan estado con cookies:
 * el Origin debe coincidir con el host de la petición o con APP_URL.
 * (Las Server Actions de Next ya realizan esta verificación.)
 */
export function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    const o = new URL(origin);
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    if (host && o.host === host) return true;
    return o.host === new URL(env.appUrl).host;
  } catch {
    return false;
  }
}
