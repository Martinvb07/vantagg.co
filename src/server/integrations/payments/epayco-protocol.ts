/**
 * ePayco: firma de la confirmación, estados y montos (funciones puras, cubiertas por tests/epayco.test.ts).
 *
 *  - La confirmación (url_confirmation) llega con x_signature = SHA-256 de
 *    «P_CUST_ID_CLIENTE^P_KEY^x_ref_payco^x_transaction_id^x_amount^x_currency_code» (valores tal como llegan).
 *  - La consulta de una transacción (secure.epayco.co/validation/v1/reference/{ref_payco}) es pública: por eso,
 *    además del pedido, se exige que la transacción sea de NUESTRO comercio (x_cust_id_cliente). Si no, cualquiera
 *    con otra cuenta de ePayco podría crear un cobro con nuestro número de pedido y hacerlo pasar por pagado.
 *  - Montos: pesos enteros en COP y centavos en USD (US$ 7,99 → 799), igual que el resto de la tienda.
 */
import { createHash } from "node:crypto";
import { safeEqual } from "@/lib/crypto";
import type { NormalizedPaymentStatus, VerifiedPayment } from "./types";

export function epaycoSignature(p: { customerId: string; pKey: string; refPayco: string; transactionId: string; amount: string; currency: string }): string {
  return createHash("sha256").update(`${p.customerId}^${p.pKey}^${p.refPayco}^${p.transactionId}^${p.amount}^${p.currency}`, "utf8").digest("hex");
}

/** Firma de una confirmación de ePayco (parámetros tal como llegaron). */
export function verifyEpaycoSignature(params: Record<string, string | undefined>, keys: { customerId: string; pKey: string }): boolean {
  const sig = (params.x_signature ?? "").trim().toLowerCase();
  const ref = params.x_ref_payco ?? "";
  const tx = params.x_transaction_id ?? "";
  const amount = params.x_amount ?? "";
  const currency = params.x_currency_code ?? "";
  if (!sig || !ref || !tx || !amount || !currency || !keys.customerId || !keys.pKey) return false;
  return safeEqual(epaycoSignature({ customerId: keys.customerId, pKey: keys.pKey, refPayco: ref, transactionId: tx, amount, currency }), sig);
}

/** x_cod_response de ePayco → estado de la tienda. */
export const EPAYCO_STATUS: Record<number, NormalizedPaymentStatus> = {
  1: "APPROVED", // Aceptada
  2: "DECLINED", // Rechazada
  3: "PENDING", // Pendiente
  4: "ERROR", // Fallida
  6: "VOIDED", // Reversada
  7: "PENDING", // Retenida (en revisión)
  8: "PENDING", // Iniciada
  9: "DECLINED", // Expirada
  10: "DECLINED", // Abandonada
  11: "DECLINED", // Cancelada
  12: "DECLINED", // Antifraude
};

export function epaycoStatus(code: unknown): NormalizedPaymentStatus {
  return EPAYCO_STATUS[Number(code)] ?? "PENDING";
}

/** «7.99» USD → 799 · «25000.00» COP → 25000. NaN si no es un monto válido. */
export function toMinorUnits(amount: unknown, currency: string): number {
  const n = Number(String(amount ?? "").trim());
  if (!Number.isFinite(n) || n < 0 || String(amount ?? "").trim() === "") return NaN;
  return currency.toUpperCase() === "USD" ? Math.round(n * 100) : Math.round(n);
}

/** 799 USD → «7.99» · 25000 COP → «25000» (lo que se envía a ePayco). */
export function fromMinorUnits(amount: number, currency: string): string {
  return currency.toUpperCase() === "USD" ? (amount / 100).toFixed(2) : String(Math.round(amount));
}

/** Factura única por intento de cobro: «número de pedido» + "-" + marca de tiempo (los números tienen 3 partes). */
export function epaycoInvoice(orderNumber: string, now = Date.now()): string {
  return `${orderNumber}-${now.toString(36)}`.slice(0, 40);
}

/** Número de pedido de una transacción: x_extra1 (lo enviamos al crear el cobro) o la factura sin su sufijo. */
export function epaycoOrderNumber(extra1: unknown, invoice: unknown): string | null {
  const e = String(extra1 ?? "").trim();
  if (/^[A-Za-z0-9-]{4,40}$/.test(e)) return e;
  const parts = String(invoice ?? "").trim().split("-");
  return parts.length >= 4 ? parts.slice(0, -1).join("-") : null;
}

/** Medio de pago legible a partir de x_franchise (VS, MC, PSE, DP…). */
function methodOf(franchise: unknown): string | null {
  const f = String(franchise ?? "").trim().toUpperCase();
  const names: Record<string, string> = { VS: "VISA", MC: "MASTERCARD", AM: "AMEX", DC: "DINERS", CR: "CREDENCIAL", PSE: "PSE", DP: "DAVIPLATA", NQ: "NEQUI" };
  return f ? (names[f] ?? f).slice(0, 40) : null;
}

/**
 * Transacción de ePayco (confirmación o consulta) → pago de la tienda. null si no es de nuestro comercio, si es de
 * pruebas y la tienda cobra de verdad, o si le faltan datos.
 */
export function parseEpaycoTransaction(d: Record<string, unknown>, cfg: { customerId: string; testMode: boolean }): VerifiedPayment | null {
  if (!cfg.customerId || String(d.x_cust_id_cliente ?? "").trim() !== cfg.customerId) return null;
  const isTest = String(d.x_test_request ?? "").trim().toUpperCase() === "TRUE";
  if (isTest && !cfg.testMode) return null;
  const providerRef = String(d.x_ref_payco ?? "").trim();
  const reference = epaycoOrderNumber(d.x_extra1, d.x_id_invoice ?? d.x_id_factura);
  const currency = String(d.x_currency_code ?? "").trim().toUpperCase();
  const amount = toMinorUnits(d.x_amount, currency);
  if (!providerRef || !reference || !currency || !Number.isFinite(amount)) return null;
  return {
    providerRef,
    reference,
    status: epaycoStatus(d.x_cod_response ?? d.x_cod_respuesta ?? d.x_cod_transaction_state),
    amount,
    currency,
    method: methodOf(d.x_franchise),
  };
}
