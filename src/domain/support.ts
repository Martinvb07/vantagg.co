/** Temas de las solicitudes de soporte (Centro de ayuda y Mi cuenta → Soporte). */
export const SUPPORT_TOPICS = [
  { v: "pedido", l: "Mi pedido" },
  { v: "pago", l: "Pago" },
  { v: "entrega", l: "Entrega" },
  { v: "cuenta", l: "Cuenta comprada" },
  { v: "reembolso", l: "Reembolso" },
  { v: "otro", l: "Otra duda" },
] as const;

export type SupportTopic = (typeof SUPPORT_TOPICS)[number]["v"];

export const topicLabel = (v: string) => SUPPORT_TOPICS.find((t) => t.v === v)?.l ?? v;

/** Estados vistos por el cliente (el panel usa sus propias etiquetas internas). */
export const TICKET_STATUS = {
  OPEN: { l: "Recibida", tone: "warning" },
  IN_PROGRESS: { l: "En revisión", tone: "info" },
  RESOLVED: { l: "Resuelta", tone: "success" },
  CLOSED: { l: "Cerrada", tone: "neutral" },
} as const;

/** Referencia corta que ve el cliente (#AB12CD34). */
export const ticketRef = (id: string) => id.slice(-8).toUpperCase();
