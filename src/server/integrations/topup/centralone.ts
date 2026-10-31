import "server-only";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { verifyCentralOneWebhook } from "../payments/signatures";
import { buildTargetPayload, idempotencyKeyFor, mapCoOrder, normalizeCatalog, targetSchemaOf, type CoCatalogItem, type CoOrder } from "./centralone-core";
import { SupplierError } from "./rechargegame";
import type { PlayerValidation, TopUpProvider, TopUpRequest, TopUpResult, WholesaleApi, WholesaleOrder } from "./types";

/**
 * Proveedor mayorista Central One (API v1, saldo prepago en USD). Servidor a servidor, JSON.
 *  - Catálogo: GET  /catalog (product_id, reseller_price con 4 decimales, target_schema, in_stock)
 *  - ID:       POST /player/validate { product_id, target_payload } → valid | invalid | unverified
 *  - Pedido:   POST /orders con Idempotency-Key = clave de la entrega: reintentar nunca cobra dos veces
 *  - Estado:   GET  /orders/{id} (línea: reserved → completed | failed | refunded | cancelled)
 *  - Webhook:  X-CentralOne-Signature (HMAC-SHA256 con TOPUP_WEBHOOK_SECRET) → /api/webhooks/topup
 * La llave (Authorization: Bearer co_live_…) solo vive en el servidor; nunca llega al navegador ni a los registros.
 * Central One no tiene modo de prueba: los pedidos de prueba de la tienda se simulan aquí sin llamar a la API.
 */

const DEFAULT_BASE = "https://portal.centraloneglobal.com/api/v1";
const baseUrl = () => (env.topup.baseUrl ?? DEFAULT_BASE).replace(/\/+$/, "");
const CATALOG_TTL_MS = 15 * 60_000;
const TEST_REF = "prueba-";

// Códigos de Central One → códigos que la tienda ya entiende (avisos y reintentos automáticos).
const CODE_MAP: Record<string, string> = { insufficient_stock: "out_of_stock", service_unavailable: "http_503", internal_error: "http_500" };

async function call<T>(path: string, init: RequestInit & { idempotencyKey?: string; timeoutMs?: number } = {}): Promise<T> {
  const { idempotencyKey, timeoutMs = 20_000, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(`${baseUrl()}${path}`, {
      ...rest,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${env.topup.apiKey ?? ""}`,
        ...(rest.body ? { "Content-Type": "application/json" } : {}),
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    throw new SupplierError("network", 0, `Sin respuesta de Central One (${(e as Error).name === "TimeoutError" ? "tiempo agotado" : "red"})`);
  }
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* respuesta no JSON */
  }
  if (!res.ok) {
    const err = (json as { error?: { code?: string; message?: string; request_id?: string; fields?: Array<{ field?: string; reason?: string }> } } | null)?.error;
    const raw = err?.code ?? `http_${res.status}`;
    const code = CODE_MAP[raw] ?? (res.status >= 500 ? `http_${res.status}` : raw);
    const fields = err?.fields?.length ? ` (${err.fields.map((f) => `${f.field}: ${f.reason}`).join(", ")})` : "";
    const reqId = err?.request_id ?? res.headers.get("x-request-id");
    // Solo el código y un mensaje corto (más el request_id para soporte): nunca encabezados ni la llave.
    throw new SupplierError(code, res.status, `${err?.message ?? `HTTP ${res.status}`}${fields}${reqId ? ` · request_id ${reqId}` : ""}`.slice(0, 400));
  }
  return json as T;
}

// Copia del catálogo en memoria (para armar target_payload sin pedirlo en cada compra).
let catalogCache: { at: number; items: CoCatalogItem[] } | null = null;
async function catalogItems(force = false): Promise<CoCatalogItem[]> {
  if (!force && catalogCache && Date.now() - catalogCache.at < CATALOG_TTL_MS) return catalogCache.items;
  const r = await call<{ items: CoCatalogItem[] }>("/catalog");
  catalogCache = { at: Date.now(), items: r.items ?? [] };
  return catalogCache.items;
}

async function catalogItem(productId: string): Promise<CoCatalogItem> {
  let item = (await catalogItems()).find((i) => i.product_id === productId);
  if (!item) item = (await catalogItems(true)).find((i) => i.product_id === productId);
  if (!item) throw new SupplierError("unknown_product", 404, "Central One ya no ofrece este producto. Sincroniza el catálogo en Panel → Proveedor y saldo.");
  return item;
}

async function payloadFor(productId: string, playerId: string, regionName?: string | null) {
  const item = await catalogItem(productId);
  const payload = buildTargetPayload(targetSchemaOf(item), playerId, regionName ?? item.region);
  if (!payload) throw new SupplierError("unsupported_target", 422, "Este producto pide datos que la tienda no maneja (además del ID del jugador).");
  return payload;
}

const outcomeOf = (o: CoOrder): WholesaleOrder["outcome"] => {
  const s = mapCoOrder(o).status;
  return s === "SUCCESS" ? "delivered" : s === "FAILED" ? "failed" : "pending";
};

const wholesale: WholesaleApi = {
  name: "Central One",
  currency: "USD",
  catalogMaxAgeMs: 15 * 60_000,
  playerCheck: "per-product",
  topUpHint: "Recarga saldo desde el portal de Central One (Binance Pay, USDT, transferencia o Zeno). Mantén al menos el valor de tu paquete más grande.",
  async ping() {
    const r = await call<{ ok: boolean }>("/ping");
    return { ok: r.ok === true, account: "Central One" };
  },
  async balance() {
    const b = await call<{ available_balance: string; currency: string }>("/balance");
    return { amount: Number(b.available_balance), currency: b.currency || "USD" };
  },
  async catalog() {
    const items = await catalogItems(true);
    return normalizeCatalog(items);
  },
  async orders(limit) {
    const r = await call<{ orders: CoOrder[] }>(`/orders?limit=${Math.min(50, Math.max(1, limit))}`);
    return (r.orders ?? []).map((o) => ({
      ref: o.id,
      reference: o.reference_code ?? null,
      status: o.status,
      outcome: outcomeOf(o),
      product: o.line_count && o.line_count > 1 ? `${o.line_count} productos` : null,
      playerId: null,
      price: o.total_sale_amount != null ? Number(o.total_sale_amount) : null,
      note: o.reseller_note ?? null,
      failure: o.failure ? (o.failure.message_es ?? o.failure.code ?? null) : null,
      createdAt: o.created_at ?? null,
      test: false,
    }));
  },
};

// Validación de IDs: Central One permite 30 por minuto para toda la cuenta. Se guarda 10 min por producto e ID.
const playerCache = new Map<string, { at: number; value: PlayerValidation }>();

export const centralOneProvider: TopUpProvider = {
  id: "centralone",
  displayName: "Central One (mayorista)",
  simulated: false,
  wholesale,
  // Un pedido «failed» de Central One no siempre es definitivo: se espera antes de comprar de nuevo.
  retryCooldownMs: 15 * 60_000,

  mode() {
    return env.topup.apiKey?.startsWith("co_live_") ? "production" : "sandbox";
  },

  missingConfig() {
    return env.topup.apiKey ? [] : ["TOPUP_API_KEY"];
  },

  isEnabled() {
    return env.topup.provider === "centralone" && !!env.topup.apiKey;
  },

  async getProducts() {
    const { currency, groups } = await wholesale.catalog();
    return groups.flatMap((g) => g.products.map((p) => ({ sku: p.product_key, name: `${p.name} · ${g.key}`, diamonds: p.amount ?? 0, cost: p.price, currency, available: !p.out_of_stock })));
  },

  async validatePlayer(playerId, opts): Promise<PlayerValidation> {
    const productKey = opts?.productKey;
    if (!productKey) return { valid: true, verifiable: false, regionMatch: "unknown", message: "No hay un paquete disponible para comprobar el ID ahora mismo." };
    const cacheKey = `${productKey}:${playerId}`;
    const hit = playerCache.get(cacheKey);
    if (hit && Date.now() - hit.at < 10 * 60_000) return hit.value;
    let r: { status?: string; reason?: string; player?: { name?: string | null } | null };
    try {
      r = await call("/player/validate", { method: "POST", body: JSON.stringify({ product_id: productKey, target_payload: await payloadFor(productKey, playerId, opts?.region) }), timeoutMs: 8_000 });
    } catch {
      // Límite de consultas, red o producto que no pide datos: no se pudo comprobar (no es «no existe»).
      return { valid: true, verifiable: false, regionMatch: "unknown", message: "No pudimos verificar el ID en este momento. Intenta de nuevo en unos segundos." };
    }
    let value: PlayerValidation;
    if (r.status === "valid") value = { valid: true, verifiable: true, nickname: r.player?.name ?? null, region: opts?.region ?? null, regionMatch: "ok" };
    else if (r.status === "invalid") value = { valid: false, verifiable: true, message: "No encontramos ese ID de jugador en esta región. Revísalo e intenta de nuevo." };
    else return { valid: true, verifiable: false, regionMatch: "unknown", message: r.reason === "not_supported" ? undefined : "No pudimos verificar el ID en este momento. Intenta de nuevo en unos segundos." };
    playerCache.set(cacheKey, { at: Date.now(), value });
    if (playerCache.size > 2000) playerCache.delete(playerCache.keys().next().value!);
    return value;
  },

  async createTopUp(req: TopUpRequest): Promise<TopUpResult> {
    if (!req.sku) throw new SupplierError("unknown_product", 422, "El paquete no está vinculado a un producto de Central One.");
    // Siempre se comprueba con el catálogo real que el producto existe y que sus datos del jugador se pueden armar.
    const target_payload = await payloadFor(req.sku, req.playerId, req.region);
    // Pedido de prueba (pago en modo prueba o TOPUP_TEST_MODE): llega hasta aquí, pero no se compra nada real.
    if (req.test) return { status: "SUCCESS", providerRef: `${TEST_REF}${req.idempotencyKey}`.slice(0, 190), simulated: true, message: "Entrega simulada: pedido de prueba, no se compró en Central One." };
    const r = await call<{ order: CoOrder }>("/orders", {
      method: "POST",
      idempotencyKey: idempotencyKeyFor(req.idempotencyKey),
      body: JSON.stringify({ items: [{ catalog_item_id: req.sku, quantity: 1, target_payload }], note: `Pedido ${req.orderNumber} · ${req.idempotencyKey}`.slice(0, 500) }),
    });
    return mapCoOrder(r.order);
  },

  async processDelivery(providerRef) {
    // Un solo paso: el pedido ya quedó creado; se consulta el estado actual.
    return this.getTransactionStatus(providerRef);
  },

  async getTransactionStatus(providerRef) {
    if (providerRef.startsWith(TEST_REF)) return { status: "SUCCESS", providerRef, simulated: true };
    const r = await call<{ order: CoOrder }>(`/orders/${encodeURIComponent(providerRef)}`);
    return mapCoOrder(r.order);
  },

  async handleWebhook({ rawBody, headers }) {
    if (!env.topup.webhookSecret) return { ok: false, status: 404, reason: "Webhook sin configurar" };
    const valid = verifyCentralOneWebhook({
      timestamp: headers.get("x-centralone-timestamp"),
      signature: headers.get("x-centralone-signature"),
      previousSignature: headers.get("x-centralone-signature-previous"),
      body: rawBody,
      secret: env.topup.webhookSecret,
    });
    if (!valid) return { ok: false, status: 401, reason: "Firma inválida" };
    let body: { event_id?: string; event?: string; order?: { reference_code?: string; idempotency_key?: string; status?: string } };
    try {
      body = JSON.parse(rawBody);
    } catch {
      return { ok: false, status: 400, reason: "JSON inválido" };
    }
    const eventId = body.event_id ?? headers.get("x-centralone-event-id") ?? "";
    if (!eventId) return { ok: false, status: 400, reason: "Evento sin id" };
    const key = body.order?.idempotency_key;
    // Solo interesan los cierres de pedidos; saldo, catálogo y pruebas se confirman (2xx) sin hacer nada.
    if (!body.event?.startsWith("order.") || !key) return { ok: true, ignored: true, eventId };
    // El aviso no trae el id del pedido: se busca la entrega por su clave y se consulta el estado real.
    const delivery = await db.delivery.findFirst({ where: { idempotencyKey: key }, select: { providerRef: true } });
    if (!delivery?.providerRef) return { ok: true, ignored: true, eventId };
    const confirmed = await this.getTransactionStatus(delivery.providerRef);
    return { ok: true, eventId, idempotencyKey: key, result: confirmed, payload: { event: body.event, reference_code: body.order?.reference_code, idempotency_key: key } };
  },

  async healthCheck() {
    if (this.missingConfig().length) return { ok: false, message: "Falta TOPUP_API_KEY" };
    try {
      const [p, b] = await Promise.all([wholesale.ping(), wholesale.balance()]);
      return { ok: p.ok, message: `Conectado a Central One · saldo disponible ${b.amount.toFixed(2)} ${b.currency}` };
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    }
  },
};
