import { NextResponse } from "next/server";
import { safeEqual } from "@/lib/crypto";
import { env } from "@/lib/env";
import { sendDelayApologies } from "@/server/notifications";

export const dynamic = "force-dynamic";

/**
 * Disculpas por demora (flujo manual «Disculpas por demora»): a los clientes cuya recarga llegó más de 1 h después de
 * pagar y que aún no recibieron la disculpa. Cuerpo: { "dryRun": true } solo lista; { "dryRun": false } envía.
 * Requiere: Authorization: Bearer <CRON_SECRET>. No devuelve correos: solo el final del número y las horas.
 */
export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  if (!env.cronSecret || !safeEqual(auth, `Bearer ${env.cronSecret}`)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as { dryRun?: unknown; days?: unknown };
  const dryRun = body.dryRun !== false;
  const days = Math.min(Math.max(Number(body.days) || 15, 1), 60);
  const list = await sendDelayApologies({ dryRun, days });
  const fmt = (d: Date) => new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "America/Bogota" }).format(d);
  return NextResponse.json({
    ok: true,
    dryRun,
    count: list.length,
    orders: list.map((o) => ({ order: `…${o.number.slice(-5)}`, paid: fmt(o.paidAt), delivered: fmt(o.deliveredAt), waitedMin: Math.round((o.deliveredAt.getTime() - o.paidAt.getTime()) / 60_000) })),
  });
}
