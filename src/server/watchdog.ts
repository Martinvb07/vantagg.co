import "server-only";
import { db } from "@/lib/db";
import { maintenanceStatus, runMaintenance } from "./maintenance";
import { addEvent, pollPendingDeliveries, pollPendingPayments } from "./orders";
import { notifyOrder, notifyStaffOrderAlert, notifyStaffSystemAlert } from "./notifications";
import { enabledPaymentProviders } from "./integrations/payments";

/**
 * Vigilante de la tienda: corre dentro del servidor (no depende de la tarea programada ni de los avisos de la pasarela).
 *  1. Cada 20 s confirma con la pasarela los pagos de la última media hora → la entrega sale en segundos.
 *  2. Si la tarea programada deja de llamar al mantenimiento (+6 min), lo hace la tienda cada 2 min y avisa al equipo.
 *  3. Recarga pagada y sin entregar hace +5 min → aviso al equipo y al cliente («tu pago está seguro»), uno por pedido.
 *     Las entregas en curso se consultan al proveedor cada 30 s (se completan sin esperar el mantenimiento).
 *  4. Cada 10 min comprueba que la tienda pueda consultar a la pasarela; si falla dos veces seguidas, avisa.
 */
const TICK_MS = 20_000;
const CRON_STALE_MS = 6 * 60_000;
const SELF_EVERY_MS = 2 * 60_000;
const STUCK_MS = 5 * 60_000;
const GATEWAY_EVERY_MS = 10 * 60_000;

let busy = false;
let lastSelfRun = 0;
let lastStuckCheck = 0;
let lastDeliveryPoll = 0;
let lastGatewayCheck = 0;
const gatewayFailures = new Map<string, number>();

export function startWatchdog() {
  const g = globalThis as { __vxWatchdog?: ReturnType<typeof setInterval> };
  if (g.__vxWatchdog) return;
  g.__vxWatchdog = setInterval(() => void watchdogTick().catch((e) => console.error("[vigilante]", (e as Error).message)), TICK_MS);
  g.__vxWatchdog.unref?.();
  console.log("[vigilante] activo: pagos cada 20 s, mantenimiento de respaldo y avisos al equipo");
}

export async function watchdogTick(now = Date.now()) {
  if (busy) return;
  busy = true;
  try {
    await pollPendingPayments({ sinceMs: 30 * 60_000 }).catch(() => 0);

    const st = maintenanceStatus();
    const lastCron = Math.max(st.lastCronAt, st.startedAt);
    if (now - lastCron > CRON_STALE_MS) {
      if (now - lastSelfRun >= SELF_EVERY_MS) {
        lastSelfRun = now;
        await runMaintenance("vigilante").catch((e) => console.error("[vigilante] mantenimiento:", (e as Error).message));
      }
      const mins = Math.round((now - lastCron) / 60_000);
      await notifyStaffSystemAlert(
        "cron",
        "El mantenimiento automático no está corriendo",
        `La tarea programada del servidor no llama a la tienda desde hace ${mins} min. Mientras tanto la tienda hace el mantenimiento por su cuenta (pagos, entregas y vencimientos), así que las ventas siguen saliendo.`,
        "Para volver a programarla basta un deploy (lo hace solo) o correr «Diagnóstico de pedidos sin pagar» para revisarla.",
      ).catch(() => {});
    }

    if (now - lastDeliveryPoll >= 30_000) {
      lastDeliveryPoll = now;
      await pollPendingDeliveries().catch(() => 0);
    }

    if (now - lastStuckCheck >= 60_000) {
      lastStuckCheck = now;
      await alertStuckPaid(now);
    }

    if (now - lastGatewayCheck >= GATEWAY_EVERY_MS) {
      lastGatewayCheck = now;
      await checkGateways();
    }
  } finally {
    busy = false;
  }
}

/** Recargas pagadas que no se han entregado en 5 min (las cuentas se entregan a mano: no cuentan). */
async function alertStuckPaid(now: number) {
  const orders = await db.order.findMany({
    where: { type: "TOPUP", isTest: false, status: { in: ["PAID", "PROCESSING"] }, events: { some: { type: "PAYMENT_CONFIRMED", createdAt: { lt: new Date(now - STUCK_MS) } } } },
    select: { id: true, status: true, events: { where: { type: "PAYMENT_CONFIRMED" }, orderBy: { createdAt: "asc" }, select: { createdAt: true }, take: 1 } },
    take: 20,
  });
  for (const o of orders) {
    const mins = Math.round((now - (o.events[0]?.createdAt.getTime() ?? now)) / 60_000);
    await notifyStaffOrderAlert(
      o.id,
      "stuck",
      "Pago sin entregar",
      `El cliente pagó y la recarga lleva ${mins} min sin entregarse (estado: ${o.status === "PAID" ? "pagado" : "en proceso con el proveedor"}). La tienda la sigue reintentando sola.`,
      "Revisa el saldo y el estado en el proveedor; si hace falta, usa «Reintentar entrega» en el pedido.",
    ).catch(() => {});
    // Al cliente: que sepa que su pago está seguro y que lo estamos resolviendo (una sola vez).
    if (!(await db.orderEvent.count({ where: { orderId: o.id, type: "DELIVERY_ISSUE" } }))) {
      await addEvent(o.id, "DELIVERY_ISSUE", "La entrega se está demorando. Nuestro equipo ya la está revisando; tu pago está seguro.", "SYSTEM", { public: true }).catch(() => {});
    }
    await notifyOrder(o.id, "delivery_failed").catch(() => {});
  }
}

/** ¿La tienda puede consultar a la pasarela? (sin consulta no se pueden confirmar pagos si el aviso no llega). */
async function checkGateways() {
  for (const p of enabledPaymentProviders()) {
    const h = await p.healthCheck().catch((e) => ({ ok: false, message: (e as Error).message }));
    if (h.ok) {
      gatewayFailures.set(p.id, 0);
      continue;
    }
    const n = (gatewayFailures.get(p.id) ?? 0) + 1;
    gatewayFailures.set(p.id, n);
    if (n >= 2) {
      await notifyStaffSystemAlert(
        `pasarela-${p.id}`,
        `La tienda no puede consultar a ${p.displayName}`,
        `Dos revisiones seguidas fallaron (${String(h.message).slice(0, 160)}). Sin esa consulta los pagos solo se confirman con los avisos de ${p.displayName}, y esos avisos no están llegando.`,
        "Revisa la llave de la pasarela en el servidor o si la pasarela tiene una caída.",
      ).catch(() => {});
    }
  }
}
