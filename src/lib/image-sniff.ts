/**
 * Tipo real de una imagen según sus primeros bytes (no se confía en el nombre ni en el
 * Content-Type del navegador). Solo JPEG, PNG y WebP; SVG nunca (puede llevar scripts).
 */
export type ChatImageMime = "image/jpeg" | "image/png" | "image/webp";

export function sniffImage(buf: Uint8Array): ChatImageMime | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 && buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a) return "image/png";
  const ascii = (a: number, b: number) => String.fromCharCode(...buf.subarray(a, b));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}

/** Tamaño máximo de una imagen del chat ya comprimida (el navegador la reduce antes de subirla). */
export const CHAT_IMAGE_MAX_BYTES = 4 * 1024 * 1024;
