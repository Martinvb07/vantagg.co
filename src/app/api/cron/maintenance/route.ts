import { NextResponse } from "next/server";
import { safeEqual } from "@/lib/crypto";
import { env } from "@/lib/env";
import { expireStaleOrders, pollCancelledPayments, pollPendingDeliveries, pollPendingPayments, retryStuckDeliveries, sendPaymentReminders } from "@/server/orders";
import { activeTopUpProvider } from "@/server/integrations/topup";
import { ensureFreshCatalog } from "@/server/supplier";
import { runEmailAutomations } from "@/server/marketing";
import { purgeCancelledOrders } from "@/server/retention";
import { ensureFxRates } from "@/server/fx";
import { getSettings } from "@/server/settings";

export const dynamic = "force-dynamic";

/**
 * Mantenimiento periódico (cada 1–5 min desde un cron externo o Vercel Cron):
 *  - cancela pedidos sin pago vencidos y libera reservas de cuentas,
 *  - consulta a la pasarela los pagos pendientes recientes (por si el webhook se demora) y, cada 20 min, los pedidos
 *    vencidos en las últimas 12 h (por si el cliente pagó tarde),
 *  - consulta al proveedor las entregas pendientes de confirmación,
 *  - reintenta entregas detenidas por saldo/agotado/red (misma referencia: no cobra dos veces),
 *  - actualiza costos y existencias del catálogo del proveedor (Central One: cada 15 min; RechargeGame: cada 3 h),
 *  - correos automáticos: «comprar de nuevo» y ofertas a quien las aceptó (cada 10 min, de 8 a. m. a 9 p. m.),
 *  - borra los pedidos cancelados sin pago 12 h después de cancelarse, ya enviado el correo «comprar de nuevo» (si está activado).
 * Requiere: Authorization: Bearer <CRON_SECRET>
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  if (!env.cronSecret || !safeEqual(auth, `Bearer ${env.cronSecret}`)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const supplier = !!activeTopUpProvider()?.wholesale;
  // Primero se confirman los pagos que la pasarela ya aprobó; luego se vencen los que siguen sin pagar.
  const paymentsConfirmed = await pollPendingPayments().catch(() => 0);
  const [expired, remindersSent, deliveries, retried, catalogSynced] = await Promise.all([
    expireStaleOrders(),
    sendPaymentReminders().catch(() => 0),
    pollPendingDeliveries(),
    retryStuckDeliveries(),
    supplier ? ensureFreshCatalog() : Promise.resolve(false),
  ]);
  // Pagos que llegaron después de vencer el pedido (los avisos de la pasarela pueden no llegar): cada 20 min.
  const latePayments = await pollCancelledPayments().catch(() => 0);
  // Correos automáticos (comprar de nuevo y ofertas a quien las aceptó): después de vencer pedidos, con su propio límite de frecuencia.
  const emails = await runEmailAutomations().catch((e) => {
    console.error("[correos] fallaron los correos automáticos:", (e as Error).message);
    return null;
  });
  // Tasas de cambio del día para los precios en otros países (cada 12 h).
  await ensureFxRates().catch(() => false);
  // Pedidos cancelados sin pago: se borran 12 h después de cancelarse, ya enviado el correo «comprar de nuevo»; queda el cliente.
  const purged = (await getSettings()).purgeCancelled === "true" ? await purgeCancelledOrders().then((r) => r.deleted).catch((e) => {
    console.error("[pedidos] no se pudieron borrar los cancelados:", (e as Error).message);
    return 0;
  }) : 0;
  return NextResponse.json({ ok: true, expired, paymentsConfirmed, latePayments, remindersSent, deliveriesUpdated: deliveries, deliveriesRetried: retried, catalogSynced, emails: emails && { recovery: emails.recovery, firstPurchase: emails.firstPurchase, winback: emails.winback }, cancelledPurged: purged });
}
