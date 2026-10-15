import "server-only";
import { env } from "@/lib/env";
import { sameRegion } from "@/domain/topup-regions";
import { verifyStandardWebhook } from "../payments/signatures";
import type { PlayerValidation, TopUpProduct, TopUpProvider, TopUpRequest, TopUpResult, TopUpStatus } from "./types";

/**
 * Proveedor mayorista RechargeGame (API /v1, saldo prepago en USDT).
 *  - Pedido:  POST /v1/orders { product_key, player_id, buyer_ref, region, test } → { order_id, status }
 *  - Estado:  GET  /v1/orders/{order_id}  (pending → delivered | failed)
 *  - Webhook: Standard Webhooks firmado con TOPUP_WEBHOOK_SECRET (whsec_…) → /api/webhooks/topup
 *  - Región:  GET  /v1/region-check?game=free-fire&uid=…&region=…
 * `buyer_ref` = clave de idempotencia de la entrega: reenviar el mismo pedido nunca cobra dos veces.
 * La clave (X-API-Key) solo se usa en el servidor; nunca llega al navegador ni a los registros.
 */

const GAME = "free-fire";
const baseUrl = () => (env.topup.baseUrl ?? "https://api.rechargegame.games").replace(/\/+$/, "");

export class SupplierError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

type RemoteOrder = {
  order_id: string;
  buyer_ref?: string | null;
  status: string;
  product?: string;
  product_key?: string | null;
  region?: string | null;
  player_id?: string | null;
  delivery_note?: string | null;
  failure_reason?: string | null;
  price_usdt?: string | number | null;
  balance_after?: string | number | null;
  test?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type CatalogProduct = { name: string; amount: number | null; unit: string | null; price: number; delivery: string; product_key: string; out_of_stock?: boolean };
export type CatalogGroup = { key: string; slug: string; products: CatalogProduct[] };

async function call<T>(path: string, init: RequestInit & { auth?: boolean } = {}): Promise<T> {
  const { auth = true, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(`${baseUrl()}${path}`, {
      ...rest,
      headers: { Accept: "application/json", ...(rest.body ? { "Content-Type": "application/json" } : {}), ...(auth ? { "X-API-Key": env.topup.apiKey ?? "" } : {}) },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
  } catch (e) {
    throw new SupplierError("network", 0, `Sin respuesta del proveedor (${(e as Error).name === "TimeoutError" ? "tiempo agotado" : "red"})`);
  }
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* respuesta no JSON */
  }
  if (!res.ok) {
    const err = (json as { error?: { code?: string; message?: string } } | null)?.error;
    // Solo el código y un mensaje corto: nunca encabezados ni la clave.
    throw new SupplierError(err?.code ?? `http_${res.status}`, res.status, (err?.message ?? `HTTP ${res.status}`).slice(0, 300));
  }
  return json as T;
}

function mapStatus(s: string | undefined): TopUpStatus {
  const v = (s ?? "").toLowerCase();
  if (v === "delivered") return "SUCCESS";
  if (v === "failed") return "FAILED";
  return "PENDING";
}

function toResult(o: RemoteOrder): TopUpResult {
  const status = mapStatus(o.status);
  const message = status === "FAILED" ? (o.failure_reason ?? "El proveedor no pudo completar la recarga.") : status === "SUCCESS" ? (o.delivery_note ?? undefined) : undefined;
  return { status, providerRef: o.order_id, message: message ?? undefined, simulated: o.test === true };
}

/** Nombre del producto a partir de la clave ("topup/free-fire/latam/110 Diamonds" → "110 Diamonds"). */
const productName = (key: string) => key.split("/").slice(3).join("/");

// ---------------------------------------------------------------------
// Consultas para el panel (saldo, catálogo, pedidos)
// ---------------------------------------------------------------------

export const supplierApi = {
  ping: () => call<{ ok: boolean; buyer: string }>("/v1/ping"),
  balance: () => call<{ balance_usdt: string; ledger?: Array<{ at: number; kind: string; amount: string; balance_after: string; ref?: string; note?: string }> }>("/v1/balance"),
  catalog: async (): Promise<{ currency: string; groups: CatalogGroup[] }> => {
    const r = await call<{ currency: string; categories: Array<{ slug: string; groups: CatalogGroup[] }> }>(`/v1/products?game=${GAME}`);
    const cat = r.categories.find((c) => c.slug === GAME);
    if (!cat) throw new SupplierError("not_found", 404, "El proveedor no lista Free Fire.");
    return { currency: r.currency, groups: cat.groups };
  },
  orders: (limit = 20) => call<{ orders: RemoteOrder[] }>(`/v1/orders?limit=${limit}`),
};

// Verificación de región: el proveedor limita a 20 consultas/min por IP; se guarda 10 min en memoria.
const regionCache = new Map<string, { at: number; value: PlayerValidation }>();

export const rechargeGameProvider: TopUpProvider = {
  id: "rechargegame",
  displayName: "RechargeGame (mayorista)",
  simulated: false,

  mode() {
    return env.topup.apiKey?.startsWith("gv_live_") ? "production" : "sandbox";
  },

  missingConfig() {
    return env.topup.apiKey ? [] : ["TOPUP_API_KEY"];
  },

  isEnabled() {
    return env.topup.provider === "rechargegame" && !!env.topup.apiKey;
  },

  async getProducts(): Promise<TopUpProduct[]> {
    const { currency, groups } = await supplierApi.catalog();
    return groups.flatMap((g) =>
      g.products.map((p) => ({ sku: p.product_key, name: `${p.name} · ${g.key}`, diamonds: p.amount ?? 0, cost: p.price, currency, available: !p.out_of_stock })),
    );
  },

  /**
   * Verificador del proveedor (sin clave). Se consulta SIN región: responde la región real de la cuenta
   * («LATAM», «Brazil», «EU», «Indonesia»…), EXISTS (existe pero no sabe la región) o UID_NOT_FOUND.
   * La comparación con la región elegida se hace aquí; un mismo ID se consulta una sola vez cada 10 min.
   */
  async validatePlayer(playerId, opts): Promise<PlayerValidation> {
    let base = regionCache.get(playerId);
    if (!base || Date.now() - base.at > 10 * 60_000) {
      let r: { status?: string; region?: string | null; nickname?: string | null };
      try {
        r = await call(`/v1/region-check?game=${GAME}&uid=${encodeURIComponent(playerId)}&region=`, { auth: false });
      } catch (e) {
        const code = e instanceof SupplierError ? e.code : "";
        if (code === "invalid_uid") return { valid: false, verifiable: true, message: "El ID debe tener solo números (entre 6 y 12)." };
        // Error temporal (límite de consultas, red): no se guarda en caché.
        return { valid: true, verifiable: false, regionMatch: "unknown", message: "No pudimos verificar el ID en este momento. Intenta de nuevo en unos segundos." };
      }
      const status = (r.status ?? "").toUpperCase();
      let value: PlayerValidation;
      if (status === "UID_NOT_FOUND") {
        value = { valid: false, verifiable: true, message: "No encontramos ese ID de jugador. Revísalo e intenta de nuevo." };
      } else if (status === "OK" || status === "WRONG_REGION" || status === "NO_LOCK" || status === "EXISTS") {
        // EXISTS: la cuenta existe pero el proveedor no puede saber su región (región null).
        value = { valid: true, verifiable: true, nickname: r.nickname ?? null, region: r.region ?? null };
      } else {
        // UNVERIFIED / UNSUPPORTED: no se pudo confirmar ahora; tampoco se guarda.
        return { valid: true, verifiable: false, nickname: r.nickname ?? null, region: null, regionMatch: "unknown", message: "El proveedor no pudo confirmar la región de esta cuenta ahora mismo. Intenta de nuevo en unos minutos." };
      }
      base = { at: Date.now(), value };
      regionCache.set(playerId, base);
      if (regionCache.size > 2000) regionCache.delete(regionCache.keys().next().value!);
    }
    const v = base.value;
    const asked = opts?.region ?? null;
    return { ...v, regionMatch: !v.valid ? undefined : v.region && asked ? (sameRegion(v.region, asked) ? "ok" : "wrong") : "unknown" };
  },

  async createTopUp(req: TopUpRequest) {
    if (!req.sku) throw new SupplierError("unknown_product", 422, "El paquete no está vinculado a un producto del proveedor.");
    const o = await call<RemoteOrder>("/v1/orders", {
      method: "POST",
      body: JSON.stringify({
        product: productName(req.sku),
        product_key: req.sku,
        region: req.region ?? undefined,
        quantity: 1,
        player_id: req.playerId,
        buyer_ref: req.idempotencyKey,
        note: `Pedido ${req.orderNumber}`,
        test: req.test === true,
      }),
    });
    return toResult(o);
  },

  async processDelivery(providerRef) {
    // Un solo paso: el pedido ya quedó creado; se consulta el estado actual.
    return this.getTransactionStatus(providerRef);
  },

  async getTransactionStatus(providerRef) {
    return toResult(await call<RemoteOrder>(`/v1/orders/${encodeURIComponent(providerRef)}`));
  },

  async findByReference(idempotencyKey, test) {
    const r = await call<{ orders: RemoteOrder[] }>(`/v1/orders?buyer_ref=${encodeURIComponent(idempotencyKey)}`);
    const o = r.orders.find((x) => x.buyer_ref === idempotencyKey && (test === undefined || !!x.test === test));
    return o ? toResult(o) : null;
  },

  async handleWebhook({ rawBody, headers }) {
    if (!env.topup.webhookSecret) return { ok: false, status: 404, reason: "Webhook sin configurar" };
    const valid = verifyStandardWebhook({
      id: headers.get("webhook-id"),
      timestamp: headers.get("webhook-timestamp"),
      signature: headers.get("webhook-signature"),
      body: rawBody,
      secret: env.topup.webhookSecret,
    });
    if (!valid) return { ok: false, status: 401, reason: "Firma inválida" };
    let body: { type?: string; data?: { order_id?: string; buyer_ref?: string } };
    try {
      body = JSON.parse(rawBody);
    } catch {
      return { ok: false, status: 400, reason: "JSON inválido" };
    }
    const eventId = headers.get("webhook-id")!;
    if (body.type === "webhook.test") return { ok: true, ignored: true, eventId };
    const orderId = body.data?.order_id;
    const ref = body.data?.buyer_ref;
    if (!orderId || !ref) return { ok: false, status: 400, reason: "Evento incompleto" };
    // No se confía en el cuerpo: se consulta el estado real al proveedor.
    const confirmed = await this.getTransactionStatus(orderId);
    return { ok: true, eventId, idempotencyKey: ref, result: confirmed, payload: { type: body.type, order_id: orderId, buyer_ref: ref } };
  },

  async healthCheck() {
    if (this.missingConfig().length) return { ok: false, message: "Falta TOPUP_API_KEY" };
    try {
      const [p, b] = await Promise.all([supplierApi.ping(), supplierApi.balance()]);
      return { ok: p.ok, message: `Conectado como ${p.buyer} · saldo ${b.balance_usdt} USDT` };
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    }
  },
};
