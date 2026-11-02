import { NextResponse } from "next/server";
import { db } from "@/lib/db";
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
  // Resumen de las últimas 24 h (lo que hizo el borrado automático) y clientes guardados; solo conteos.
  const since = new Date(Date.now() - 86400_000);
  const logs = await db.auditLog.findMany({ where: { action: "orders.purge_cancelled", createdAt: { gte: since } }, select: { data: true }, take: 2000 });
  const sum = (k: "deleted" | "customers") => logs.reduce((n, l) => n + (Number((l.data as Record<string, unknown> | null)?.[k]) || 0), 0);
  const [cancelled, savedCustomers, withoutPurchase] = await Promise.all([
    db.order.count({ where: { status: "CANCELLED" } }),
    db.emailContact.count({ where: { unpaidOrders: { gt: 0 } } }),
    db.emailContact.count({ where: { source: "pedido-sin-pagar" } }),
  ]);
  return NextResponse.json({
    ok: true, dryRun, due: r.due, kept: r.kept, waiting: r.waiting, deleted: r.deleted, customers: r.customers, enabled: !dryRun && body.enable === true,
    last24h: { deleted: sum("deleted"), customers: sum("customers") }, cancelled, savedCustomers, withoutPurchase,
  });
}
