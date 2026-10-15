import { readFile } from "node:fs/promises";
import path from "node:path";
import { uploadsDir } from "@/server/storage";

export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", avif: "image/avif" };

/**
 * Imágenes subidas en modo local (avatares, cuentas, banners). Next.js solo sirve desde public/ lo que existía
 * al compilar; esta ruta entrega también lo subido después, leyendo de UPLOADS_DIR.
 * Solo imágenes con nombre aleatorio, sin salir de la carpeta.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const parts = (await params).path;
  if (!parts?.length || parts.some((p) => !/^[A-Za-z0-9._-]+$/.test(p) || p.startsWith("."))) return new Response("Not found", { status: 404 });
  const ext = parts[parts.length - 1].split(".").pop()?.toLowerCase() ?? "";
  const type = TYPES[ext];
  if (!type) return new Response("Not found", { status: 404 });
  const base = path.resolve(uploadsDir());
  const file = path.resolve(base, ...parts);
  if (!file.startsWith(base + path.sep)) return new Response("Not found", { status: 404 });
  try {
    const data = await readFile(file);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": type,
        "Content-Length": String(data.length),
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
