import "server-only";
import { env } from "@/lib/env";
import { deliverable } from "@/lib/email-utils";
import type { CheckoutOrder, PaymentProvider, VerifiedPayment, WebhookResult } from "./types";
import { epaycoInvoice, epaycoStatus, fromMinorUnits, parseEpaycoTransaction, verifyEpaycoSignature } from "./epayco-protocol";

/**
 * ePayco (Colombia), al lado de Bold: cobra en pesos y también en dólares (clientes de otros países).
 *  - createCheckout crea una sesión de cobro (apify.epayco.co) con el monto fijado por la tienda; el cliente pasa por
 *    /pagar/epayco/{pedido}, que abre el checkout de ePayco con esa sesión.
 *  - La confirmación llega firmada (x_signature) a /api/webhooks/epayco y solo se aplica si la consulta directa de la
 *    transacción a ePayco la confirma (misma orden, monto, moneda y comercio).
 *  - Al volver, ePayco agrega ?ref_payco=… a la dirección de respuesta: con esa referencia se consulta el estado.
 * La referencia de ePayco (ref_payco) solo se conoce cuando el cliente paga; antes, el cobro es la sesión.
 */
const APIFY = "https://apify.epayco.co";
const VALIDATION = "https://secure.epayco.co/validation/v1/reference/";
export const EPAYCO_CHECKOUT_SCRIPT = "https://checkout.epayco.co/checkout.js";

/** Prefijo del cobro iniciado (sesión de checkout): no se puede consultar, solo identifica el intento. */
export const EPAYCO_SESSION_PREFIX = "session:";

const cfg = () => ({ customerId: env.epayco.customerId ?? "", testMode: env.epayco.testMode });

let token: { value: string; until: number } | null = null;

async function login(fresh = false): Promise<string> {
  if (!fresh && token && token.until > Date.now()) return token.value;
  const basic = Buffer.from(`${env.epayco.publicKey}:${env.epayco.privateKey}`).toString("base64");
  const res = await fetch(`${APIFY}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Basic ${basic}` },
    body: "{}",
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  const j = (await res.json().catch(() => ({}))) as { token?: string; bearer_token?: string };
  const t = j.token ?? j.bearer_token;
  if (!res.ok || !t) throw new Error(`ePayco no aceptó las llaves de la API (HTTP ${res.status})`);
  token = { value: t, until: Date.now() + 10 * 60_000 };
  return t;
}

type ApifyResponse = { success?: boolean; textResponse?: string; titleResponse?: string; data?: { sessionId?: string; errors?: Array<{ errorMessage?: string; codError?: string }> } };

async function apify(path: string, body: unknown): Promise<ApifyResponse> {
  for (const fresh of [false, true]) {
    const res = await fetch(`${APIFY}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${await login(fresh)}` },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (res.status === 401 && !fresh) continue; // sesión vencida: se pide otra una vez
    const j = (await res.json().catch(() => ({}))) as ApifyResponse;
    if (!res.ok && !j.textResponse) throw new Error(`ePayco respondió HTTP ${res.status}`);
    return j;
  }
  throw new Error("ePayco rechazó la autenticación");
}

export const epaycoProvider: PaymentProvider = {
  id: "epayco",
  displayName: "ePayco",
  methodsLabel: "Tarjeta, PSE y Daviplata",
  currencies: ["COP", "USD"],
  confirmByPayment: true,

  mode() {
    return env.epayco.testMode ? "sandbox" : "production";
  },

  missingConfig() {
    const m: string[] = [];
    if (!env.epayco.publicKey) m.push("EPAYCO_PUBLIC_KEY");
    if (!env.epayco.privateKey) m.push("EPAYCO_PRIVATE_KEY");
    if (!env.epayco.customerId) m.push("EPAYCO_P_CUST_ID_CLIENTE");
    if (!env.epayco.pKey) m.push("EPAYCO_P_KEY");
    return m;
  },

  isEnabled() {
    return env.paymentProviders.includes("epayco") && this.missingConfig().length === 0;
  },

  async createCheckout(order: CheckoutOrder) {
    if (!this.currencies.includes(order.currency)) throw new Error(`ePayco no cobra en ${order.currency}`);
    const description = order.description.replace(/\s+/g, " ").trim().slice(0, 100) || "Pedido";
    const email = deliverable(order.customerEmail) ? order.customerEmail : null;
    const body: Record<string, unknown> = {
      checkout_version: "2",
      name: description.slice(0, 60),
      description,
      invoice: epaycoInvoice(order.number),
      currency: order.currency,
      amount: fromMinorUnits(order.total, order.currency),
      taxBase: "0",
      tax: "0",
      country: "CO",
      lang: "ES",
      test: env.epayco.testMode ? "true" : "false",
      ip: order.customerIp || "127.0.0.1",
      // Rutas sin «?»: ePayco agrega ?ref_payco=… a la de respuesta.
      response: `${env.appUrl}/pagar/epayco/retorno/${encodeURIComponent(order.number)}/${encodeURIComponent(order.trackingToken)}`,
      confirmation: `${env.appUrl}/api/webhooks/epayco`,
      extra1: order.number,
      // Pagos en efectivo (Efecty, Gana…) tardan horas o días: el pedido vence antes. Solo medios inmediatos.
      methodsDisable: ["CASH", "SP"],
      ...(email ? { emailBilling: email, billing: { email } } : {}),
    };
    const r = await apify("/payment/session/create", body);
    const sessionId = r.data?.sessionId;
    if (r.success !== true || !sessionId) {
      const details = (r.data?.errors ?? []).map((e) => e.errorMessage).filter(Boolean).join("; ");
      throw new Error(`ePayco no creó el cobro: ${(r.textResponse ?? r.titleResponse ?? "sin detalle").slice(0, 160)}${details ? ` (${details.slice(0, 200)})` : ""}`);
    }
    return {
      redirectUrl: `${env.appUrl}/pagar/epayco/${encodeURIComponent(order.number)}?t=${encodeURIComponent(order.trackingToken)}`,
      checkoutRef: `${EPAYCO_SESSION_PREFIX}${sessionId}`,
    };
  },

  async handleWebhook({ rawBody, headers, url }): Promise<WebhookResult> {
    // ePayco envía la confirmación como formulario (POST) o en la dirección (GET/POST con parámetros).
    const params: Record<string, string> = Object.fromEntries(url.searchParams);
    if (rawBody.trim()) {
      if ((headers.get("content-type") ?? "").includes("json")) {
        try {
          for (const [k, v] of Object.entries(JSON.parse(rawBody) as Record<string, unknown>)) if (v != null && typeof v !== "object") params[k] = String(v);
        } catch {
          return { ok: false, status: 400, reason: "JSON inválido" };
        }
      } else {
        for (const [k, v] of new URLSearchParams(rawBody)) params[k] = v;
      }
    }
    if (!verifyEpaycoSignature(params, { customerId: env.epayco.customerId ?? "", pKey: env.epayco.pKey ?? "" })) {
      return { ok: false, status: 401, reason: "Firma inválida" };
    }
    const code = params.x_cod_response ?? params.x_cod_respuesta ?? params.x_cod_transaction_state ?? "";
    const payment = parseEpaycoTransaction(params, cfg());
    const eventId = `${params.x_ref_payco}:${epaycoStatus(code)}:${code}`;
    return { ok: true, eventId, eventType: `ePayco ${code || "sin código"}`, payment, payload: params };
  },

  async getPayment(providerRef): Promise<VerifiedPayment | null> {
    if (!/^[A-Za-z0-9-]{1,40}$/.test(providerRef)) return null;
    const res = await fetch(`${VALIDATION}${encodeURIComponent(providerRef)}`, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`ePayco respondió HTTP ${res.status} al consultar la transacción`);
    const j = (await res.json().catch(() => ({}))) as { success?: boolean; data?: Record<string, unknown> };
    if (!j.success || !j.data) return null;
    return parseEpaycoTransaction(j.data, cfg());
  },

  async getCheckout(checkoutRef) {
    // La sesión no se puede consultar; las referencias de ePayco (ref_payco) sí.
    if (checkoutRef.startsWith(EPAYCO_SESSION_PREFIX)) return null;
    return this.getPayment(checkoutRef);
  },

  async healthCheck() {
    if (this.missingConfig().length) return { ok: false, message: "Credenciales incompletas" };
    try {
      await login(true);
      return { ok: true, message: `Conectado con ePayco${env.epayco.testMode ? " (modo pruebas, sin cobros reales)" : ""}` };
    } catch (e) {
      return { ok: false, message: (e as Error).message.slice(0, 160) };
    }
  },
};
