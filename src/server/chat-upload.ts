import "server-only";
import { CHAT_IMAGE_MAX_BYTES, sniffImage } from "@/lib/image-sniff";
import { cleanBody, type NewAttachment } from "./chat";

export type ChatUpload = { ok: true; caption: string; file: NewAttachment } | { ok: false; error: string };

/**
 * Lee una imagen del chat (multipart: `file`, `caption`, `width`, `height`).
 * El tipo se decide por los bytes reales; solo JPEG, PNG o WebP de hasta 4 MB.
 */
export async function readChatUpload(req: Request): Promise<ChatUpload> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > CHAT_IMAGE_MAX_BYTES + 64 * 1024) return { ok: false, error: "La imagen pesa demasiado (máximo 4 MB)." };
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return { ok: false, error: "No se pudo leer la imagen." };
  }
  const file = form.get("file");
  if (!(file instanceof Blob) || file.size === 0) return { ok: false, error: "Adjunta una imagen." };
  if (file.size > CHAT_IMAGE_MAX_BYTES) return { ok: false, error: "La imagen pesa demasiado (máximo 4 MB)." };
  const data = Buffer.from(await file.arrayBuffer());
  const mime = sniffImage(data);
  if (!mime) return { ok: false, error: "Solo se permiten imágenes JPG, PNG o WebP." };
  const rawCaption = String(form.get("caption") ?? "").trim();
  const caption = rawCaption ? cleanBody(rawCaption) : "";
  if (caption === null) return { ok: false, error: "El texto de la imagen es muy largo (máximo 2000 caracteres)." };
  const num = (k: string) => {
    const n = Number(form.get(k));
    return Number.isInteger(n) && n > 0 ? n : null;
  };
  return { ok: true, caption, file: { mime, data, width: num("width"), height: num("height") } };
}

/** Respuesta segura para servir una imagen del chat (privada, sin caché compartida, sin ejecutar nada). */
export function imageResponse(a: { mime: string; data: Buffer }) {
  const ext = a.mime === "image/png" ? "png" : a.mime === "image/webp" ? "webp" : "jpg";
  return new Response(new Uint8Array(a.data), {
    headers: {
      "Content-Type": a.mime,
      "Content-Length": String(a.data.length),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Content-Disposition": `inline; filename="imagen-chat.${ext}"`,
    },
  });
}
