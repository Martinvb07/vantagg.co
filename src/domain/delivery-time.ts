/**
 * Lo que se le dice al cliente sobre el tiempo de entrega de las recargas, igual en todos lados (pago, seguimiento,
 * correos, preguntas frecuentes y términos): casi siempre llegan en segundos, pero a veces se demoran.
 */
export const DELIVERY_MAX = "24 horas";

export const DELIVERY_TIME = {
  /** Antes de pagar. */
  checkout: `Las recargas son automáticas y casi siempre llegan en segundos. A veces, por alta demanda o mantenimiento de Free Fire, pueden demorar hasta ${DELIVERY_MAX}. Si no llega, te devolvemos el dinero.`,
  /** Pagado / entregando. */
  processing: `Casi siempre llega en segundos, pero a veces puede demorar hasta ${DELIVERY_MAX} por alta demanda o mantenimiento de Free Fire. No tienes que hacer nada: te avisamos por correo cuando llegue.`,
  /** Demorada o con error de entrega. */
  delayed: "Tu recarga se está demorando. Pasa a veces por alta demanda o mantenimiento de Free Fire. Ya la estamos revisando y tu pago está seguro: la completamos o te devolvemos el dinero.",
} as const;

/**
 * Fragmentos y cajas Evo («tokens»): no son instantáneos como los diamantes; el pedido se procesa en un plazo de hasta
 * 24 horas hábiles desde el pago. Dentro de ese plazo (la tienda cuenta 24 horas desde el pago) una entrega lenta es
 * normal: no es un error, no se avisa al equipo, no se le escribe al cliente que «se está demorando» y nunca se cancela
 * el pedido. Pasado el plazo, se avisa una sola vez.
 */
export const TOKEN_DELIVERY_MAX_HOURS = 24;
export const TOKEN_DELIVERY_MAX_MS = TOKEN_DELIVERY_MAX_HOURS * 3600_000;
export const TOKEN_DELIVERY_MAX = `${TOKEN_DELIVERY_MAX_HOURS} horas hábiles`;

export const TOKEN_DELIVERY_TIME = {
  /** Etiqueta corta (página de fragmentos). */
  badge: `Entrega en ${TOKEN_DELIVERY_MAX}`,
  /** Descripción del producto (página de fragmentos). */
  description: `Los pedidos de fragmentos y cajas Evo no llegan de manera instantánea: se procesan en un tiempo de hasta ${TOKEN_DELIVERY_MAX} después del pago.`,
  /** Antes de pagar. */
  checkout: `Este pedido no llega de manera instantánea: los fragmentos y las cajas Evo se procesan en un tiempo de hasta ${TOKEN_DELIVERY_MAX} después del pago. Si no llegan en ese plazo, te devolvemos el dinero.`,
  /** Pagado / entregando. */
  processing: `Tu pedido se procesa en un tiempo de hasta ${TOKEN_DELIVERY_MAX} desde el pago: los fragmentos y las cajas Evo no llegan de manera instantánea. No tienes que hacer nada: te avisamos por correo cuando llegue.`,
  /** Pasó el plazo y todavía no llega (o el proveedor no puede entregarla y la revisa el equipo). */
  delayed: "La entrega de tu compra Evo está tardando más de lo previsto. Ya la estamos revisando con prioridad y tu pago está seguro: la completamos o te devolvemos el dinero.",
} as const;
