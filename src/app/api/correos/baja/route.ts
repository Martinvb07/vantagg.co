import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { setMarketingConsent, validUnsubscribe } from "@/server/marketing";

export const dynamic = "force-dynamic";

/**
 * Baja de un clic (RFC 8058): Gmail, Outlook y otros llaman aquí con POST desde el botón «Cancelar suscripción»
 * (cabecera List-Unsubscribe-Post del correo). El enlace firmado identifica a la persona; no hace falta sesión.
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const u = url.searchParams.get("u") ?? "";
  const t = url.searchParams.get("t") ?? "";
  if (!validUnsubscribe(u, t)) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const user = await db.user.findUnique({ where: { id: u }, select: { marketingOptIn: true } });
  if (!user) return NextResponse.json({ error: "invalid" }, { status: 400 });
  if (user.marketingOptIn) await setMarketingConsent(u, false, "correo-un-clic");
  return NextResponse.json({ ok: true });
}

/** Un cliente de correo que abre el enlace (GET) llega a la página de baja, donde la persona confirma. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const { env } = await import("@/lib/env");
  return NextResponse.redirect(`${env.appUrl}/correos/baja?${new URLSearchParams({ u: url.searchParams.get("u") ?? "", t: url.searchParams.get("t") ?? "" }).toString()}`, 303);
}
