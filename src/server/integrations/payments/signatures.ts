/**
 * Verificación de firmas de webhooks (funciones puras, cubiertas por tests/).
 */
import { createHmac } from "node:crypto";
import { safeEqual } from "@/lib/crypto";

/**
 * Standard Webhooks (https://www.standardwebhooks.com), usado por el proveedor de recargas:
 * firma = base64(HMAC-SHA256(llave, "{webhook-id}.{webhook-timestamp}.{cuerpo}")), llave = base64 de "whsec_…".
 * El encabezado puede traer varias firmas separadas por espacio ("v1,AAA v1,BBB").
 * Se rechazan eventos con más de `toleranceSec` de diferencia (evita reenvíos viejos).
 */
export function verifyStandardWebhook(params: {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
  body: string;
  secret: string;
  nowSec?: number;
  toleranceSec?: number;
}): boolean {
  const { id, timestamp, signature, body, secret } = params;
  if (!id || !timestamp || !signature || !secret) return false;
  const ts = Number(timestamp);
  if (!Number.isInteger(ts)) return false;
  const now = params.nowSec ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > (params.toleranceSec ?? 300)) return false;
  let key: Buffer;
  try {
    key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  } catch {
    return false;
  }
  if (key.length === 0) return false;
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`, "utf8").digest("base64");
  return signature
    .split(" ")
    .map((s) => s.trim())
    .filter((s) => s.startsWith("v1,"))
    .some((s) => safeEqual(s.slice(3), expected));
}

/**
 * Bold: x-bold-signature = HMAC-SHA256(llave secreta, cuerpo en Base64), en hexadecimal.
 * En modo pruebas Bold firma con llave vacía ("").
 */
export function boldWebhookSignature(rawBody: string, secret: string): string {
  return createHmac("sha256", secret).update(Buffer.from(rawBody, "utf8").toString("base64"), "utf8").digest("hex");
}

export function verifyBoldSignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  return safeEqual(boldWebhookSignature(rawBody, secret), header.trim().toLowerCase());
}

/** Referencia única por intento de cobro en Bold: «número de orden» + "_" + marca de tiempo (Bold recomienda no repetir referencias). */
export function boldReference(orderNumber: string, now = Date.now()): string {
  return `${orderNumber}_${now.toString(36)}`.slice(0, 60);
}

/** Recupera el número de orden desde la referencia de Bold (los números de orden no usan "_"). */
export function boldOrderNumber(reference: string | null | undefined): string | null {
  const n = reference?.split("_")[0]?.trim();
  return n ? n : null;
}
