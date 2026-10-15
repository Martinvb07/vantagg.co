import { NextResponse } from "next/server";
import { safeEqual } from "@/lib/crypto";
import { env } from "@/lib/env";
import { expireStaleOrders, pollPendingDeliveries, pollPendingPayments, retryStuckDeliveries } from "@/server/orders";
import { activeTopUpProvider } from "@/server/integrations/topup";
import { ensureFreshCatalog } from "@/server/supplier";

export const dynamic = "force-dynamic";

/**
 * Mantenimiento periódico (cada 1–5 min desde un cron externo o Vercel Cron):
 *  - cancela pedidos sin pago vencidos y libera reservas de cuentas,
 *  - consulta a la pasarela los pagos pendientes recientes (por si el webhook se demora),
 *  - consulta al proveedor las entregas pendientes de confirmación,
 *  - reintenta entregas detenidas por saldo/agotado/red (misma referencia: no cobra dos veces),
 *  - actualiza costos y existencias del catálogo del proveedor cada 3 horas.
 * Requiere: Authorization: Bearer <CRON_SECRET>
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  if (!env.cronSecret || !safeEqual(auth, `Bearer ${env.cronSecret}`)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const supplier = activeTopUpProvider()?.id === "rechargegame";
  // Primero se confirman los pagos que la pasarela ya aprobó; luego se vencen los que siguen sin pagar.
  const paymentsConfirmed = await pollPendingPayments().catch(() => 0);
  const [expired, deliveries, retried, catalogSynced] = await Promise.all([
    expireStaleOrders(),
    pollPendingDeliveries(),
    retryStuckDeliveries(),
    supplier ? ensureFreshCatalog() : Promise.resolve(false),
  ]);
  return NextResponse.json({ ok: true, expired, paymentsConfirmed, deliveriesUpdated: deliveries, deliveriesRetried: retried, catalogSynced });
}
