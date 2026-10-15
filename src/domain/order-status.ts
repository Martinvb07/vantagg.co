export const ORDER_STATUSES = [
  "PENDING_PAYMENT",
  "PAID",
  "PROCESSING",
  "DELIVERED",
  "DELIVERY_FAILED",
  "REFUND_REQUESTED",
  "REFUNDED",
  "CANCELLED",
] as const;
export type OrderStatusValue = (typeof ORDER_STATUSES)[number];

export type StatusTone = "neutral" | "info" | "accent" | "success" | "warning" | "danger";

export const ORDER_STATUS_META: Record<OrderStatusValue, { label: string; tone: StatusTone; customer: string }> = {
  PENDING_PAYMENT: {
    label: "Pendiente de pago",
    tone: "warning",
    customer: "Tu pedido está creado. Aún no recibimos la confirmación del pago por parte de la pasarela.",
  },
  PAID: {
    label: "Pago confirmado",
    tone: "info",
    customer: "La pasarela confirmó tu pago. Estamos preparando la entrega.",
  },
  PROCESSING: {
    label: "En procesamiento",
    tone: "accent",
    customer: "La entrega está en curso con nuestro proveedor.",
  },
  DELIVERED: {
    label: "Entregado",
    tone: "success",
    customer: "El proveedor confirmó la entrega de tu pedido.",
  },
  DELIVERY_FAILED: {
    label: "Error de entrega",
    tone: "danger",
    customer: "Hubo un problema con la entrega. Nuestro equipo lo está revisando; tu pago está registrado.",
  },
  REFUND_REQUESTED: {
    label: "Reembolso solicitado",
    tone: "warning",
    customer: "Se registró una solicitud de reembolso para este pedido.",
  },
  REFUNDED: {
    label: "Reembolsado",
    tone: "neutral",
    customer: "El reembolso de este pedido fue procesado.",
  },
  CANCELLED: {
    label: "Cancelado",
    tone: "neutral",
    customer: "Este pedido fue cancelado y no se realizó ningún cobro asociado a él.",
  },
};

/**
 * Transiciones que un miembro del equipo puede ejecutar manualmente.
 * PAID nunca aparece como destino: solo un webhook verificado (o la
 * consulta directa a la pasarela) puede marcar un pedido como pagado.
 */
export const MANUAL_TRANSITIONS: Partial<Record<OrderStatusValue, OrderStatusValue[]>> = {
  PENDING_PAYMENT: ["CANCELLED"],
  PAID: ["REFUND_REQUESTED"],
  PROCESSING: ["REFUND_REQUESTED"],
  DELIVERY_FAILED: ["REFUND_REQUESTED"],
  DELIVERED: ["REFUND_REQUESTED"],
  REFUND_REQUESTED: ["REFUNDED"],
};

export function canTransitionManually(from: OrderStatusValue, to: OrderStatusValue): boolean {
  return MANUAL_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Línea de tiempo pública para el seguimiento del cliente. */
export const HAPPY_PATH: OrderStatusValue[] = ["PENDING_PAYMENT", "PAID", "PROCESSING", "DELIVERED"];

export function timelineIndex(status: OrderStatusValue): number {
  const i = HAPPY_PATH.indexOf(status);
  if (i >= 0) return i;
  if (status === "DELIVERY_FAILED") return 2;
  return -1;
}

/** Estados que cuentan como venta: el pago fue confirmado por la pasarela y no se reembolsó. */
export const REVENUE_STATUSES = ["PAID", "PROCESSING", "DELIVERED", "DELIVERY_FAILED", "REFUND_REQUESTED"] as const satisfies readonly OrderStatusValue[];
