import "server-only";
import { expireStaleOrders, pollCancelledPayments, pollPendingDeliveries, pollPendingPayments, retryStuckDeliveries, sendPaymentReminders } from "./orders";
import { activeTopUpProvider } from "./integrations/topup";
import { ensureFreshCatalog } from "./supplier";
import { runEmailAutomations } from "./marketing";
import { purgeCancelledOrders } from "./retention";
import { ensureFxRates } from "./fx";
import { getSettings } from "./settings";

/**
 * Mantenimiento periódico (lo llama la tarea programada cada 2 min y, si esa tarea se detiene, el vigilante de la
 * propia tienda):
 *  - consulta a la pasarela los pagos pendientes recientes (por si el aviso no llega) y, cada 20 min, los pedidos
 *    vencidos en las últimas 12 h (por si el cliente pagó tarde); luego cancela los pedidos sin pago vencidos,
 *  - consulta al proveedor las entregas pendientes y reintenta las detenidas (misma referencia: no cobra dos veces),
 *  - actualiza el catálogo del proveedor, los correos automáticos, las tasas de cambio y borra cancelados viejos.
 * Una sola corrida a la vez: si llega otra mientras corre, comparte su resultado.
 */
export type MaintenanceResult = Awaited<ReturnType<typeof run>>;

let running: Promise<MaintenanceResult> | null = null;
const startedAt = Date.now();
let lastRunAt = 0;
let lastCronAt = 0;

/** Cuándo corrió por última vez (cualquiera) y cuándo la llamó la tarea programada (0 = aún no desde que arrancó). */
export function maintenanceStatus() {
  return { startedAt, lastRunAt, lastCronAt };
}

export function runMaintenance(source: "cron" | "vigilante"): Promise<MaintenanceResult> {
  if (source === "cron") lastCronAt = Date.now();
  if (!running) {
    running = run().finally(() => {
      lastRunAt = Date.now();
      running = null;
    });
  }
  return running;
}

async function run() {
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
  return { ok: true as const, expired, paymentsConfirmed, latePayments, remindersSent, deliveriesUpdated: deliveries, deliveriesRetried: retried, catalogSynced, emails: emails && { recovery: emails.recovery, firstPurchase: emails.firstPurchase, winback: emails.winback }, cancelledPurged: purged };
}
