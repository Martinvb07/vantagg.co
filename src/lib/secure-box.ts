import "server-only";
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { env, getAuthSecret } from "./env";

/**
 * Cifrado de datos sensibles en reposo (AES-256-GCM).
 * Clave maestra: DATA_ENCRYPTION_KEY si existe; si no, derivada de AUTH_SECRET.
 * Cada uso (chat, 2FA…) deriva su propia subclave con HKDF.
 * Formato guardado: "v1.<iv>.<tag>.<texto cifrado>" en base64url.
 * Si cambias la clave maestra, lo cifrado con la anterior deja de poder leerse.
 */
export type SealPurpose = "order-chat:v1" | "totp:v1" | "chat-file:v1";

const keys = new Map<SealPurpose, Buffer>();

function key(purpose: SealPurpose): Buffer {
  let k = keys.get(purpose);
  if (!k) {
    k = Buffer.from(hkdfSync("sha256", env.dataKey ?? getAuthSecret(), "vanta-data", purpose, 32));
    keys.set(purpose, k);
  }
  return k;
}

export function sealText(plain: string, purpose: SealPurpose = "order-chat:v1"): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(purpose), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ct.toString("base64url")].join(".");
}

/** Devuelve null si el texto fue alterado o se cifró con otra clave. */
export function openText(sealed: string, purpose: SealPurpose = "order-chat:v1"): string | null {
  const [v, iv, tag, ct] = sealed.split(".");
  if (v !== "v1" || !iv || !tag || ct == null) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(purpose), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** Cifra un archivo: [versión 1 byte | iv 12 | tag 16 | contenido]. */
export function sealBytes(plain: Buffer, purpose: SealPurpose = "chat-file:v1"): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(purpose), iv);
  const ct = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([Buffer.from([1]), iv, cipher.getAuthTag(), ct]);
}

/** Devuelve null si el archivo fue alterado o se cifró con otra clave. */
export function openBytes(sealed: Uint8Array, purpose: SealPurpose = "chat-file:v1"): Buffer | null {
  const buf = Buffer.from(sealed);
  if (buf.length < 29 || buf[0] !== 1) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(purpose), buf.subarray(1, 13));
    decipher.setAuthTag(buf.subarray(13, 29));
    return Buffer.concat([decipher.update(buf.subarray(29)), decipher.final()]);
  } catch {
    return null;
  }
}
