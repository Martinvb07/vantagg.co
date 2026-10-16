import { getCurrentUser } from "@/lib/auth";
import { getBrand } from "@/server/notifications";
import { EMAIL_PREVIEWS } from "@/server/email-previews";

export const dynamic = "force-dynamic";

/** Vista previa de una plantilla con datos de ejemplo (solo administradores). */
export async function GET(req: Request) {
  const user = await getCurrentUser().catch(() => null);
  if (!user || user.role !== "ADMIN" || !user.totpEnabledAt) return new Response("No autorizado", { status: 401 });
  const key = new URL(req.url).searchParams.get("t");
  const preview = EMAIL_PREVIEWS.find((p) => p.key === key);
  if (!preview) return new Response("Plantilla no encontrada", { status: 404 });
  const email = preview.render(await getBrand());
  return new Response(email.html, { headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
      "Content-Security-Policy": "default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; frame-ancestors 'self'; sandbox",
    } });
}
