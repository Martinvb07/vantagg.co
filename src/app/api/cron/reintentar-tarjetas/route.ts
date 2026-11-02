import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { safeEqual } from "@/lib/crypto";
import { env } from "@/lib/env";
import { retryDelivery, verifyDeliveryWithProvider } from "@/server/orders";

export const dynamic = "force-dynamic";

/**
 * Tarjetas y pases pagados que no se entregaron (flujo manual «Reintentar entregas de tarjetas»):
 *  1. Si el pedido usó un producto de Global y su paquete ahora usa el de su región, se cambia al de la región.
 *  2. Si está en proceso, se consulta al proveedor: si allá falló, pasa a «Entrega fallida».
 *  3. Si está en «Entrega fallida», se reintenta: antes se confirma con el proveedor que la orden anterior falló
 *     (nunca se compra dos veces) y se compra con el producto correcto.
 * Cuerpo: { "dryRun": true } solo informa. Requiere: Authorization: Bearer <CRON_SECRET>. Sin costos ni datos de clientes.
 */
export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  if (!env.cronSecret || !safeEqual(auth, `Bearer ${env.cronSecret}`)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { dryRun?: unknown };
  const dryRun = body.dryRun === true;
  const actor = "SYSTEM:reintentar-tarjetas";

  const orders = await db.order.findMany({
    where: { type: "TOPUP", isTest: false, status: { in: ["PAID", "PROCESSING", "DELIVERY_FAILED"] }, createdAt: { gte: new Date(Date.now() - 14 * 86400_000) } },
    include: { delivery: true, package: { select: { providerSku: true, region: true, diamonds: true } } },
    orderBy: { createdAt: "asc" },
    take: 50,
  });
  const cards = orders.filter((o) => ((o.itemSnapshot as { diamonds?: number }).diamonds ?? 0) === 0);
  const globalKeys = new Set((await db.supplierProduct.findMany({ where: { regionSlug: "global" }, select: { productKey: true } })).map((p) => p.productKey));
  const results: Array<{ number: string; item: string; before: string; after: string; message: string }> = [];

  for (const o of cards) {
    const snap = o.itemSnapshot as Record<string, unknown> & { sku?: string; name?: string };
    const item = String(snap.name ?? "Tarjeta");
    const notes: string[] = [];
    // 1) Producto correcto: el que usa hoy su paquete (si el pedido quedó con el de Global).
    const target = o.package?.providerSku;
    if (target && snap.sku && snap.sku !== target && globalKeys.has(snap.sku) && o.package?.region !== "global") {
      if (!dryRun) await db.order.update({ where: { id: o.id }, data: { itemSnapshot: { ...snap, sku: target } as Prisma.InputJsonObject } });
      notes.push("ahora usa el producto de su región");
    }
    if (dryRun) {
      results.push({ number: o.number, item, before: o.status, after: o.status, message: [...notes, `entrega: ${o.delivery?.status ?? "sin intento"}`].join(" · ") });
      continue;
    }
    // 2) En proceso (o pagado con un intento): se pregunta al proveedor el estado real.
    if (o.status === "PROCESSING" || (o.status === "PAID" && o.delivery)) {
      const v = await verifyDeliveryWithProvider(o.id, actor);
      notes.push(v.message);
    }
    // 3) Entrega fallida (o pagado sin intento): se reintenta con el producto correcto.
    const now = await db.order.findUniqueOrThrow({ where: { id: o.id }, include: { delivery: true } });
    if (now.status === "DELIVERY_FAILED" || (now.status === "PAID" && !now.delivery)) {
      // Como el botón manual: sin espera; antes se confirma con el proveedor que la orden anterior falló.
      const r = await retryDelivery(o.id, actor, { manual: true });
      notes.push(r.message);
    }
    const after = (await db.order.findUniqueOrThrow({ where: { id: o.id }, select: { status: true } })).status;
    results.push({ number: o.number, item, before: o.status, after, message: notes.join(" · ") });
  }
  return NextResponse.json({ ok: true, dryRun, found: cards.length, results });
}
