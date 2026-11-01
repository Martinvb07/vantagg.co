import { NextResponse } from "next/server";
import { safeEqual } from "@/lib/crypto";
import { env } from "@/lib/env";
import { purgeCancelledOrders } from "@/server/retention";
import { saveSettings } from "@/server/settings";

export const dynamic = "force-dynamic";

/**
 * Pedidos cancelados sin pago (flujo manual «Limpiar pedidos cancelados»). Cuerpo: { "dryRun": true } solo cuenta;
 * { "dryRun": false, "enable": true } activa el borrado automático (Panel → Ajustes) y borra ya los que tocan.
 * Requiere: Authorization: Bearer <CRON_SECRET>. Solo devuelve conteos.
 */
export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  if (!env.cronSecret || !safeEqual(auth, `Bearer ${env.cronSecret}`)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as { dryRun?: unknown; enable?: unknown };
  const dryRun = body.dryRun !== false;
  if (!dryRun && body.enable === true) await saveSettings({ purgeCancelled: "true" });
  const r = await purgeCancelledOrders({ dryRun });
  return NextResponse.json({ ok: true, dryRun, due: r.due, kept: r.kept, deleted: r.deleted, enabled: !dryRun && body.enable === true });
}
