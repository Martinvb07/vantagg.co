import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

export function hmacSha256Hex(secret: string, input: string): string {
  return createHmac("sha256", secret).update(input, "utf8").digest("hex");
}

/** Comparación en tiempo constante de dos cadenas (hex/base64/etc.). */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

const ORDER_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // sin 0/O/1/I/L ambiguos

/** Número de pedido legible: VX-7K2M-9QHT */
export function generateOrderNumber(prefix = "VX"): string {
  const bytes = randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) out += ORDER_ALPHABET[bytes[i] % ORDER_ALPHABET.length];
  return `${prefix}-${out.slice(0, 4)}-${out.slice(4)}`;
}
