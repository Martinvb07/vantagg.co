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
 * Fragmentos y cajas Evo («tokens»): el proveedor los entrega con más calma que los diamantes. Tienen hasta 12 horas
 * desde el pago; dentro de ese plazo una entrega lenta es normal: no es un error, no se avisa al equipo, no se le
 * escribe al cliente que «se está demorando» y nunca se cancela el pedido. Pasado el plazo, se avisa una sola vez.
 */
export const TOKEN_DELIVERY_MAX_HOURS = 12;
export const TOKEN_DELIVERY_MAX_MS = TOKEN_DELIVERY_MAX_HOURS * 3600_000;
export const TOKEN_DELIVERY_MAX = `${TOKEN_DELIVERY_MAX_HOURS} horas`;

export const TOKEN_DELIVERY_TIME = {
  /** Antes de pagar. */
  checkout: `Los fragmentos y las cajas Evo se entregan en un plazo de hasta ${TOKEN_DELIVERY_MAX} después del pago (muchas veces llegan antes). Si no llegan en ese plazo, te devolvemos el dinero.`,
  /** Pagado / entregando. */
  processing: `La entrega de fragmentos y cajas Evo puede tardar hasta ${TOKEN_DELIVERY_MAX} desde el pago: es lo normal para este producto. No tienes que hacer nada: te avisamos por correo cuando llegue.`,
  /** Pasó el plazo y todavía no llega (o el proveedor no puede entregarla y la revisa el equipo). */
  delayed: "La entrega de tu compra Evo está tardando más de lo previsto. Ya la estamos revisando con prioridad y tu pago está seguro: la completamos o te devolvemos el dinero.",
} as const;
