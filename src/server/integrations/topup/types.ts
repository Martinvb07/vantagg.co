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

/** Producto del catálogo mayorista ya normalizado (Free Fire, agrupado por región). */
export type WholesaleProduct = { name: string; amount: number | null; unit: string | null; price: number; delivery: string; product_key: string; out_of_stock?: boolean };
export type WholesaleGroup = { key: string; slug: string; products: WholesaleProduct[] };

/** Pedido del proveedor tal como se muestra en el panel. */
export type WholesaleOrder = {
  ref: string;
  reference: string | null;
  status: string;
  /** Estado traducido: "delivered" | "failed" | "pending". */
  outcome: "delivered" | "failed" | "pending";
  product: string | null;
  playerId: string | null;
  price: number | null;
  note: string | null;
  failure: string | null;
  createdAt: string | null;
  test: boolean;
};

/**
 * Proveedor mayorista con saldo prepago (RechargeGame, Central One): catálogo con costos, saldo y
 * pedidos para el panel. Los importes van en `currency` (USDT o USD).
 */
export interface WholesaleApi {
  readonly name: string;
  readonly currency: string;
  /** Cada cuánto se vuelve a descargar el catálogo (costos y existencias). */
  readonly catalogMaxAgeMs: number;
  /** "lookup": el verificador devuelve la región de la cuenta. "per-product": se valida el ID contra un producto. */
  readonly playerCheck: "lookup" | "per-product";
  /** Cómo se recarga saldo (texto para el panel). */
  readonly topUpHint: string;
  ping(): Promise<{ ok: boolean; account: string }>;
  balance(): Promise<{ amount: number; currency: string }>;
  catalog(): Promise<{ currency: string; groups: WholesaleGroup[] }>;
  orders(limit: number): Promise<WholesaleOrder[]>;
}

export interface TopUpProvider {
  readonly id: string;
  readonly displayName: string;
  readonly simulated: boolean;
  /** Presente en proveedores mayoristas con catálogo y saldo propios. */
  readonly wholesale?: WholesaleApi;
  mode(): "sandbox" | "production" | "test";
  missingConfig(): string[];
  isEnabled(): boolean;
  getProducts(): Promise<TopUpProduct[]>;
  /**
   * Verifica el ID; con `region` también confirma que la cuenta sea de esa región. Los proveedores que
   * validan por producto (wholesale.playerCheck = "per-product") usan `productKey`.
   */
  validatePlayer(playerId: string, opts?: { region?: string | null; productKey?: string | null }): Promise<PlayerValidation>;
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
