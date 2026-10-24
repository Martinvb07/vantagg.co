import "server-only";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";

/**
 * Almacenamiento de imágenes configurable:
 *  - Sin variables STORAGE_* → disco local: UPLOADS_DIR (en producción, un disco persistente) o public/uploads.
 *    Se sirven por /uploads/... (ruta propia, así también funcionan los archivos subidos después de compilar).
 *  - Con variables → cualquier servicio compatible con S3 (firma AWS SigV4).
 */
const MAX_BYTES = 5 * 1024 * 1024;
const TYPES: Record<string, { ext: string; magic: (b: Buffer) => boolean }> = {
  "image/jpeg": { ext: "jpg", magic: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  "image/png": { ext: "png", magic: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  "image/webp": { ext: "webp", magic: (b) => b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP" },
  "image/avif": { ext: "avif", magic: (b) => b.subarray(4, 12).toString().startsWith("ftypavi") },
};

/** Carpeta de imágenes en modo local. */
export function uploadsDir(): string {
  return process.env.UPLOADS_DIR?.trim() || path.join(process.cwd(), "public", "uploads");
}

export function storageMode(): "s3" | "local" {
  const s = env.storage;
  return s.endpoint && s.accessKey && s.secretKey && s.bucket && s.publicUrl ? "s3" : "local";
}

export function storageMissingConfig(): string[] {
  const s = env.storage;
  const m: string[] = [];
  if (!s.endpoint) m.push("STORAGE_ENDPOINT");
  if (!s.accessKey) m.push("STORAGE_ACCESS_KEY");
  if (!s.secretKey) m.push("STORAGE_SECRET_KEY");
  if (!s.bucket) m.push("STORAGE_BUCKET");
  if (!s.publicUrl) m.push("STORAGE_PUBLIC_URL");
  return m;
}

export class UploadError extends Error {}

export async function saveImage(file: File, opts: { folder?: "products" | "avatars"; maxBytes?: number } = {}): Promise<string> {
  const max = opts.maxBytes ?? MAX_BYTES;
  const type = TYPES[file.type];
  if (!type) throw new UploadError("Formato no permitido. Usa JPG, PNG, WebP o AVIF.");
  if (file.size > max) throw new UploadError(`La imagen supera ${Math.round(max / 1024 / 1024)} MB.`);
  const buf = Buffer.from(await file.arrayBuffer());
  if (!type.magic(buf)) throw new UploadError("El contenido del archivo no coincide con su formato.");

  const key = `${opts.folder ?? "products"}/${new Date().toISOString().slice(0, 7)}/${randomBytes(12).toString("hex")}.${type.ext}`;
  if (storageMode() === "s3") {
    await s3Put(key, buf, file.type);
    return `${env.storage.publicUrl!.replace(/\/$/, "")}/${key}`;
  }
  const dest = path.join(uploadsDir(), key);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, buf);
  return `/uploads/${key}`;
}

// --- S3 SigV4 (PUT Object, estilo path) ---------------------------------
const sha256 = (d: Buffer | string) => createHash("sha256").update(d).digest("hex");
const hmac = (k: Buffer | string, d: string) => createHmac("sha256", k).update(d).digest();

async function s3Put(key: string, body: Buffer, contentType: string) {
  const s = env.storage;
  const endpoint = new URL(s.endpoint!);
  const url = new URL(`${endpoint.origin}/${s.bucket}/${key}`);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256(body);
  const headers: Record<string, string> = {
    host: url.host,
    "content-type": contentType,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
  const signedHeaders = Object.keys(headers).sort().join(";");
  const canonicalHeaders = Object.keys(headers).sort().map((h) => `${h}:${headers[h]}\n`).join("");
  const canonicalUri = url.pathname.split("/").map(encodeURIComponent).join("/");
  const canonicalRequest = ["PUT", canonicalUri, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const scope = `${dateStamp}/${s.region}/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256(canonicalRequest)].join("\n");
  const kDate = hmac(`AWS4${s.secretKey}`, dateStamp);
  const kSigning = hmac(hmac(hmac(kDate, s.region), "s3"), "aws4_request");
  const signature = createHmac("sha256", kSigning).update(stringToSign).digest("hex");

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      ...headers,
      Authorization: `AWS4-HMAC-SHA256 Credential=${s.accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
    body: new Uint8Array(body),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new UploadError(`El almacenamiento rechazó la subida (HTTP ${res.status}).`);
}

/**
 * Borra del disco local una foto de perfil subida por el cliente (al eliminar su cuenta).
 * Solo actúa sobre /uploads/avatars/AAAA-MM/<archivo> (como los guarda saveImage); en S3 o con otra ruta no hace nada.
 */
export async function deleteLocalAvatar(url: string | null | undefined): Promise<void> {
  if (!url || storageMode() !== "local" || !/^\/uploads\/avatars\/\d{4}-\d{2}\/[a-f0-9]+\.(jpg|png|webp|avif)$/.test(url)) return;
  await unlink(path.join(uploadsDir(), url.slice("/uploads/".length))).catch(() => {});
}
