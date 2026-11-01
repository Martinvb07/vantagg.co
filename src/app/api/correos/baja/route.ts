import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { setContactConsent, setMarketingConsent, validUnsubscribe } from "@/server/marketing";

export const dynamic = "force-dynamic";

/** ?u=<cuenta> o ?c=<contacto sin cuenta>, con la firma ?t=. */
function target(url: URL) {
  const c = url.searchParams.get("c");
  return { who: c ? ("c" as const) : ("u" as const), id: c ?? url.searchParams.get("u") ?? "", t: url.searchParams.get("t") ?? "" };
}

/**
 * Baja de un clic (RFC 8058): Gmail, Outlook y otros llaman aquí con POST desde el botón «Cancelar suscripción»
 * (cabecera List-Unsubscribe-Post del correo). El enlace firmado identifica a la persona; no hace falta sesión.
 */
export async function POST(req: Request) {
  const { who, id, t } = target(new URL(req.url));
  if (!validUnsubscribe(id, t, who)) return NextResponse.json({ error: "invalid" }, { status: 400 });
  if (who === "u") {
    const user = await db.user.findUnique({ where: { id }, select: { marketingOptIn: true } });
    if (!user) return NextResponse.json({ error: "invalid" }, { status: 400 });
    if (user.marketingOptIn) await setMarketingConsent(id, false, "correo-un-clic");
  } else {
    const contact = await db.emailContact.findUnique({ where: { id }, select: { optIn: true } });
    if (!contact) return NextResponse.json({ error: "invalid" }, { status: 400 });
    if (contact.optIn) await setContactConsent(id, false, "correo-un-clic");
  }
  return NextResponse.json({ ok: true });
}

/** Un cliente de correo que abre el enlace (GET) llega a la página de baja, donde la persona confirma. */
export async function GET(req: Request) {
  const { who, id, t } = target(new URL(req.url));
  return NextResponse.redirect(`${env.appUrl}/correos/baja?${new URLSearchParams({ [who]: id, t }).toString()}`, 303);
}
