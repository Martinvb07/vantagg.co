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
