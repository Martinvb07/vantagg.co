/**
 * Medios de pago que se muestran al cliente. Son informativos: el cobro lo
 * procesa la pasarela habilitada, que debe soportarlos. Bold en línea: tarjetas, Nequi, PSE y Botón Bancolombia
 * (Bre-B no aparece en su checkout ni en su API de links; actívalo en Ajustes solo si Bold lo habilita).
 */
export const PAYMENT_METHODS = [
  { id: "debito", label: "Tarjeta débito" },
  { id: "credito", label: "Tarjeta crédito" },
  { id: "nequi", label: "Nequi" },
  { id: "pse", label: "PSE" },
  { id: "bancolombia", label: "Botón Bancolombia" },
  { id: "breb", label: "Bre-B" },
] as const;
export type PaymentMethodId = (typeof PAYMENT_METHODS)[number]["id"];

export const DEFAULT_PAYMENT_METHODS = "debito,credito,nequi,pse,bancolombia";

export function parsePaymentMethods(csv: string | null | undefined): PaymentMethodId[] {
  const ids = (csv ?? DEFAULT_PAYMENT_METHODS).split(",").map((s) => s.trim());
  return PAYMENT_METHODS.filter((m) => ids.includes(m.id)).map((m) => m.id);
}

/** "Tarjeta débito, Tarjeta crédito, Nequi y PSE" */
export function paymentMethodsSentence(ids: PaymentMethodId[]): string {
  const labels = PAYMENT_METHODS.filter((m) => ids.includes(m.id)).map((m) => m.label);
  if (labels.length <= 1) return labels.join("");
  return `${labels.slice(0, -1).join(", ")} y ${labels[labels.length - 1]}`;
}
