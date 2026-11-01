import { NextResponse } from "next/server";
import { safeEqual } from "@/lib/crypto";
import { env } from "@/lib/env";
import { sendReminders, type ReminderKind } from "@/server/reminders";

export const dynamic = "force-dynamic";

/**
 * Recordatorios por correo en lote (lo mismo que Panel → Pedidos → Recordatorios), para el flujo manual
 * «Recordatorios a clientes». Cuerpo: { "kinds": ["payment", "recovery"], "days": 30, "dryRun": true }.
 * Requiere: Authorization: Bearer <CRON_SECRET>. La respuesta solo trae conteos (ningún correo ni dato del cliente).
 */
export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  if (!env.cronSecret || !safeEqual(auth, `Bearer ${env.cronSecret}`)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as { kinds?: unknown; days?: unknown; dryRun?: unknown };
  const kinds = (Array.isArray(body.kinds) ? body.kinds : []).filter((k): k is ReminderKind => k === "payment" || k === "recovery");
  const days = typeof body.days === "number" && [7, 14, 30, 60, 90].includes(body.days) ? body.days : null;
  if (!kinds.length || !days) return NextResponse.json({ error: "kinds (payment, recovery) y days (7, 14, 30, 60 o 90) son obligatorios." }, { status: 400 });
  const r = await sendReminders({ kinds, days, dryRun: body.dryRun !== false, limit: 300 });
  return NextResponse.json({ ok: true, dryRun: body.dryRun !== false, payment: r.payment, recovery: { candidates: r.recovery.candidates, sent: r.recovery.sent, skipped: r.recovery.skipped } });
}
