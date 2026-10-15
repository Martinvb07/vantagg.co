import "server-only";
import { env } from "@/lib/env";
import { deliverable } from "@/lib/email-utils";
import type { CheckoutOrder, NormalizedPaymentStatus, PaymentProvider, VerifiedPayment, WebhookResult } from "./types";
import { boldOrderNumber, boldReference, verifyBoldSignature } from "./signatures";

/**
 * Bold (Colombia) con su API de links de pago:
 *  - createCheckout crea un link de cobro cerrado (monto fijo) y el cliente paga en checkout.bold.co.
 *  - El webhook llega firmado (x-bold-signature) y trae la referencia del link → número de orden.
 *  - Si el webhook se demora, el estado se consulta por el link (getCheckout) o por la transacción (getPayment).
 * Documentación: developers.bold.co (API Link de pagos y Webhook).
 */
const API = "https://integrations.api.bold.co";

type BoldNotification = {
  id: string;
  type: string;
  subject?: string;
  time?: number;
  data?: {
    payment_id?: string;
    amount?: { currency?: string; total?: number };
    metadata?: { reference?: string | null };
    payment_method?: string | null;
  };
};

type BoldLink = {
  id: string;
  total: number;
  status: string;
  reference: string | null;
  payment_method: string | null;
  transaction_id: string | null;
  is_sandbox?: boolean;
};

const EVENT_STATUS: Record<string, NormalizedPaymentStatus> = {
  SALE_APPROVED: "APPROVED",
  SALE_REJECTED: "DECLINED",
  VOID_APPROVED: "VOIDED",
};

const LINK_STATUS: Record<string, NormalizedPaymentStatus> = {
  PAID: "APPROVED",
  REJECTED: "DECLINED",
  CANCELLED: "DECLINED",
};

/** En modo pruebas Bold firma los webhooks con llave vacía. */
const signingKey = () => (env.bold.testMode ? "" : (env.bold.secretKey ?? ""));

async function boldFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `x-api-key ${env.bold.apiKey}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Bold respondió HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}`);
  return (text ? JSON.parse(text) : {}) as T;
}

function fromNotification(n: BoldNotification): VerifiedPayment | null {
  const status = EVENT_STATUS[n.type];
  const reference = boldOrderNumber(n.data?.metadata?.reference);
  const providerRef = n.data?.payment_id ?? n.subject;
  if (!status || !reference || !providerRef) return null;
  return {
    providerRef,
    reference,
    status,
    amount: Math.round(Number(n.data?.amount?.total ?? 0)),
    currency: n.data?.amount?.currency ?? "COP",
    method: n.data?.payment_method ?? null,
  };
}

/** Última notificación con estado de una transacción (Bold puede enviar varias). */
async function latestForPayment(paymentId: string): Promise<VerifiedPayment | null> {
  const r = await boldFetch<{ notifications?: BoldNotification[] }>(`/payments/webhook/notifications/${encodeURIComponent(paymentId)}`);
  const list = (r.notifications ?? []).filter((n) => EVENT_STATUS[n.type]).sort((a, b) => (b.time ?? 0) - (a.time ?? 0));
  return list.length ? fromNotification(list[0]) : null;
}

export const boldProvider: PaymentProvider = {
  id: "bold",
  displayName: "Bold",
  methodsLabel: "Tarjeta, PSE, Nequi y Botón Bancolombia",

  mode() {
    return env.bold.testMode ? "sandbox" : "production";
  },

  missingConfig() {
    const m: string[] = [];
    if (!env.bold.apiKey) m.push("BOLD_API_KEY");
    if (!env.bold.secretKey && !env.bold.testMode) m.push("BOLD_SECRET_KEY");
    return m;
  },

  isEnabled() {
    return env.paymentProviders.includes("bold") && this.missingConfig().length === 0;
  },

  async createCheckout(order: CheckoutOrder) {
    const reference = boldReference(order.number);
    const description = order.description.replace(/\s+/g, " ").trim().slice(0, 100).padEnd(2, ".");
    const callback = `${env.appUrl}/pedido/${order.number}?t=${order.trackingToken}&from=pago`;
    const payload: Record<string, unknown> = {
      amount_type: "CLOSE",
      amount: { currency: order.currency, total_amount: order.total, tip_amount: 0 },
      reference,
      description,
      // Bold exige https; en desarrollo (http://localhost) el cliente se queda en el recibo de Bold.
      ...(callback.startsWith("https://") ? { callback_url: callback } : {}),
      ...(deliverable(order.customerEmail) ? { payer_email: order.customerEmail } : {}),
      expiration_date: "__EXP__",
    };
    // Bold pide la expiración en nanosegundos (más de 2^53): se inserta como número exacto.
    const expiresNs = (BigInt(order.expiresAt.getTime()) * 1_000_000n).toString();
    const body = JSON.stringify(payload).replace('"__EXP__"', expiresNs);

    const r = await boldFetch<{ payload?: { payment_link?: string; url?: string }; errors?: unknown[] }>("/online/link/v1", { method: "POST", body });
    const url = r.payload?.url ?? "";
    if (r.errors?.length || !r.payload?.payment_link || !url.startsWith("https://checkout.bold.co/")) {
      throw new Error(`Bold no creó el link de pago${r.errors?.length ? `: ${JSON.stringify(r.errors).slice(0, 200)}` : ""}`);
    }
    return { redirectUrl: url, checkoutRef: r.payload.payment_link };
  },

  async handleWebhook({ rawBody, headers }): Promise<WebhookResult> {
    if (!verifyBoldSignature(rawBody, headers.get("x-bold-signature"), signingKey())) {
      return { ok: false, status: 401, reason: "Firma inválida" };
    }
    let n: BoldNotification;
    try {
      n = JSON.parse(rawBody);
    } catch {
      return { ok: false, status: 400, reason: "JSON inválido" };
    }
    const payment = fromNotification(n);
    // Bold puede repetir la misma notificación: se deduplica por transacción + tipo.
    const eventId = payment ? `${payment.providerRef}:${n.type}` : `notif:${n.id ?? "sin-id"}`;
    return { ok: true, eventId, eventType: n.type ?? "unknown", payment, payload: n };
  },

  async getPayment(providerRef) {
    // El endpoint de notificaciones puede no estar habilitado para el comercio (403): la conciliación
    // usa entonces el estado del link (getCheckout), que siempre está disponible.
    return latestForPayment(providerRef).catch(() => null);
  },

  async getCheckout(checkoutRef) {
    const link = await boldFetch<BoldLink>(`/online/link/v1/${encodeURIComponent(checkoutRef)}`);
    const status = LINK_STATUS[link.status];
    const reference = boldOrderNumber(link.reference);
    if (!status || !reference) return null;
    // Con transacción, los datos completos (monto, moneda, medio) vienen de sus notificaciones.
    if (link.transaction_id) {
      const tx = await latestForPayment(link.transaction_id).catch(() => null);
      if (tx) return tx;
    }
    return { providerRef: link.transaction_id ?? link.id, reference, status, amount: Math.round(link.total), currency: "COP", method: link.payment_method };
  },

  async healthCheck() {
    if (this.missingConfig().length) return { ok: false, message: "Credenciales incompletas" };
    try {
      const r = await boldFetch<{ payload?: { payment_methods?: Record<string, unknown> } }>("/online/link/v1/payment_methods");
      const methods = Object.keys(r.payload?.payment_methods ?? {});
      return { ok: true, message: methods.length ? `Conectado con Bold · ${methods.join(", ")}` : "Conectado con Bold" };
    } catch (e) {
      return { ok: false, message: (e as Error).message.slice(0, 160) };
    }
  },
};
