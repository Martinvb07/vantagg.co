export type TopUpProduct = {
  sku: string;
  name: string;
  diamonds: number;
  cost?: number | null; // costo mayorista informado por el proveedor
  currency?: string | null;
  available: boolean;
};

export type PlayerValidation = {
  /** false = el proveedor afirma que el ID no existe. */
  valid: boolean;
  /** false = el proveedor no permite verificar IDs; se pide confirmación manual al cliente. */
  verifiable: boolean;
  nickname?: string | null;
  region?: string | null;
  /** Región pedida vs. región real del ID: "ok", "wrong" (es de otra región) o "unknown". */
  regionMatch?: "ok" | "wrong" | "unknown";
  message?: string;
};

export type TopUpRequest = {
  idempotencyKey: string; // estable por orden: reintentos nunca duplican la recarga
  orderNumber: string;
  playerId: string;
  sku: string | null;
  diamonds: number;
  /** Región del juego tal como la nombra el proveedor (ej. "LATAM"). */
  region?: string | null;
  /** Pedido de prueba: el proveedor no cobra ni entrega. */
  test?: boolean;
};

export type TopUpStatus = "PENDING" | "SUCCESS" | "FAILED";

export type TopUpResult = {
  status: TopUpStatus;
  providerRef: string | null;
  message?: string;
  /** true = no se entregó nada real (proveedor de prueba). */
  simulated: boolean;
};

export type TopUpWebhookResult =
  | { ok: false; status: number; reason: string }
  | { ok: true; ignored: true; eventId: string }
  | { ok: true; ignored?: false; eventId: string; idempotencyKey: string; result: TopUpResult; payload: unknown };

export interface TopUpProvider {
  readonly id: string;
  readonly displayName: string;
  readonly simulated: boolean;
  mode(): "sandbox" | "production" | "test";
  missingConfig(): string[];
  isEnabled(): boolean;
  getProducts(): Promise<TopUpProduct[]>;
  /** Verifica el ID; con `region` también confirma que la cuenta sea de esa región. */
  validatePlayer(playerId: string, opts?: { region?: string | null }): Promise<PlayerValidation>;
  /** Registra la transacción en el proveedor (no entrega todavía en APIs de dos pasos). */
  createTopUp(req: TopUpRequest): Promise<TopUpResult>;
  /** Ejecuta/confirma la entrega de una transacción creada. */
  processDelivery(providerRef: string, req: TopUpRequest): Promise<TopUpResult>;
  getTransactionStatus(providerRef: string): Promise<TopUpResult>;
  handleWebhook(input: { rawBody: string; headers: Headers }): Promise<TopUpWebhookResult>;
  healthCheck(): Promise<{ ok: boolean; message: string }>;
  /** Busca una transacción por nuestra referencia (para no duplicar tras un corte de red). */
  findByReference?(idempotencyKey: string, test?: boolean): Promise<TopUpResult | null>;
}
