export type ProviderMode = "sandbox" | "production";
export type NormalizedPaymentStatus = "PENDING" | "APPROVED" | "DECLINED" | "VOIDED" | "ERROR";

/**
 * Montos de cobro: en pesos (COP) son pesos enteros; en dólares (USD) son centavos (US$ 7,99 → 799).
 * Así un mismo número entero sirve para comparar lo cobrado con lo esperado sin decimales.
 */
export type CheckoutOrder = {
  number: string; // referencia única de la orden
  total: number; // monto a cobrar (COP enteros o centavos de USD)
  currency: string; // "COP" o "USD"
  description: string;
  customerEmail: string;
  trackingToken: string;
  expiresAt: Date;
  /** IP del comprador (algunas pasarelas la piden para su antifraude). */
  customerIp?: string | null;
};

/** Pago consultado o verificado directamente con la pasarela. Nunca proviene del navegador. */
export type VerifiedPayment = {
  providerRef: string;
  reference: string; // número de orden
  status: NormalizedPaymentStatus;
  amount: number; // COP enteros o centavos de USD (ver CheckoutOrder)
  currency: string;
  method?: string | null;
  /**
   * El pago se hizo a más tardar en esta fecha (p. ej. cuando venció el link de pago de Bold). Si la tienda lo confirma
   * después (aviso que no llegó), se guarda esta fecha como «pagado» para que el pedido cuadre con la pasarela.
   */
  paidBefore?: Date | null;
};

export type WebhookResult =
  | { ok: false; status: number; reason: string }
  | { ok: true; eventId: string; eventType: string; payment: VerifiedPayment | null; payload: unknown };

export interface PaymentProvider {
  readonly id: string;
  readonly displayName: string;
  /** Medios que ofrece la pasarela, solo informativo para el cliente. */
  readonly methodsLabel: string;
  /** Monedas en las que puede cobrar (Bold: solo pesos). */
  readonly currencies: readonly string[];
  /**
   * true: la consulta directa de la transacción (getPayment) es la fuente de verdad, y un aviso «aprobado» solo cuenta
   * si esa consulta lo confirma (pasarelas cuyo cobro no se conoce hasta que el cliente paga, como ePayco).
   */
  readonly confirmByPayment?: boolean;
  mode(): ProviderMode;
  /** Variables faltantes. Vacía = configurada. */
  missingConfig(): string[];
  isEnabled(): boolean;
  /** checkoutRef: id del cobro en la pasarela (p. ej. link de Bold) para conciliarlo si el webhook no llega. */
  createCheckout(order: CheckoutOrder): Promise<{ redirectUrl: string; checkoutRef?: string }>;
  /** Valida la firma y devuelve el pago confirmado contra la API de la pasarela. */
  handleWebhook(input: { rawBody: string; headers: Headers; url: URL }): Promise<WebhookResult>;
  /** Consulta directa de una transacción (conciliación). */
  getPayment(providerRef: string): Promise<VerifiedPayment | null>;
  /** Busca transacciones por número de orden (conciliación desde el panel). */
  findByReference?(reference: string): Promise<VerifiedPayment[]>;
  /** Estado de un cobro iniciado (checkoutRef devuelto por createCheckout). */
  getCheckout?(checkoutRef: string): Promise<VerifiedPayment | null>;
  /** Verificación ligera de conectividad/credenciales para el panel. */
  healthCheck(): Promise<{ ok: boolean; message: string }>;
}
