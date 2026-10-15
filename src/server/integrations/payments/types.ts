export type ProviderMode = "sandbox" | "production";
export type NormalizedPaymentStatus = "PENDING" | "APPROVED" | "DECLINED" | "VOIDED" | "ERROR";

/** Datos mínimos de la orden que una pasarela necesita para iniciar el cobro. */
export type CheckoutOrder = {
  number: string; // referencia única de la orden
  total: number; // COP enteros
  currency: string;
  description: string;
  customerEmail: string;
  trackingToken: string;
  expiresAt: Date;
};

/** Pago consultado o verificado directamente con la pasarela. Nunca proviene del navegador. */
export type VerifiedPayment = {
  providerRef: string;
  reference: string; // número de orden
  status: NormalizedPaymentStatus;
  amount: number; // COP enteros
  currency: string;
  method?: string | null;
};

export type WebhookResult =
  | { ok: false; status: number; reason: string }
  | { ok: true; eventId: string; eventType: string; payment: VerifiedPayment | null; payload: unknown };

export interface PaymentProvider {
  readonly id: string;
  readonly displayName: string;
  /** Medios que ofrece la pasarela, solo informativo para el cliente. */
  readonly methodsLabel: string;
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
