import type { VerifiedPayment } from "./types";

/**
 * Un aviso de «pago aprobado» solo vale si la pasarela, consultada directamente, reporta un cobro APROBADO
 * para la misma orden, con el mismo monto y moneda. Así, una firma válida por sí sola (p. ej. con una llave
 * secreta filtrada) no basta para marcar pagado un pedido que nadie pagó.
 */
export function gatewayConfirms(claim: VerifiedPayment, fromGateway: VerifiedPayment[]): boolean {
  return fromGateway.some((v) => v.status === "APPROVED" && v.reference === claim.reference && v.amount === claim.amount && v.currency === claim.currency);
}
