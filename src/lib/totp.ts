import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Códigos de un solo uso por tiempo (TOTP, RFC 6238): los que generan Google Authenticator,
 * Microsoft Authenticator, Authy, 1Password… SHA-1, 6 dígitos, pasos de 30 s.
 */
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP_SECONDS = 30;

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer {
  const clean = s.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    value = (value << 5) | ALPHABET.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** Secreto nuevo de 160 bits en base32. */
export const generateTotpSecret = () => base32Encode(randomBytes(20));

export const currentStep = (now = Date.now()) => Math.floor(now / 1000 / STEP_SECONDS);

export function totpAt(secretB32: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const h = createHmac("sha1", base32Decode(secretB32)).update(counter).digest();
  const offset = h[h.length - 1] & 0xf;
  const bin = ((h[offset] & 0x7f) << 24) | (h[offset + 1] << 16) | (h[offset + 2] << 8) | h[offset + 3];
  return String(bin % 1_000_000).padStart(6, "0");
}

/**
 * Verifica un código aceptando ±1 paso (desfase de reloj) y rechaza pasos ya usados
 * (`lastStep`) para que un código interceptado no sirva dos veces.
 */
export function verifyTotp(secretB32: string, code: string, lastStep: number | null | undefined, now = Date.now()): { ok: true; step: number } | { ok: false } {
  if (!/^\d{6}$/.test(code)) return { ok: false };
  const step = currentStep(now);
  for (const s of [step, step - 1, step + 1]) {
    if (lastStep != null && s <= lastStep) continue;
    const expected = Buffer.from(totpAt(secretB32, s));
    if (timingSafeEqual(expected, Buffer.from(code))) return { ok: true, step: s };
  }
  return { ok: false };
}

export function otpauthUri(issuer: string, account: string, secretB32: string) {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secretB32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=${STEP_SECONDS}`;
}

/** Códigos de recuperación legibles: ABCD-EFGH (sin caracteres ambiguos). */
export function generateRecoveryCodes(n = 10): string[] {
  const chars = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  return Array.from({ length: n }, () => {
    const b = randomBytes(8);
    const s = Array.from(b, (x) => chars[x % chars.length]).join("");
    return `${s.slice(0, 4)}-${s.slice(4)}`;
  });
}

export const normalizeRecovery = (code: string) => code.toUpperCase().replace(/[^0-9A-Z]/g, "");
