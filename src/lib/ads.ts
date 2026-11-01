/**
 * Eventos de publicidad para Meta Pixel y la etiqueta de Google (solo en el navegador). Cada uno se envía solo
 * si su herramienta está instalada en la página; si no hay ninguna, no hace nada.
 */
import { gtagConsent, gtagEvent } from "./gtag";

type Fbq = (...args: unknown[]) => void;
const fbq = (): Fbq | null => {
  if (typeof window === "undefined") return null;
  const f = (window as unknown as { fbq?: Fbq }).fbq;
  return typeof f === "function" ? f : null;
};

type Item = { id: string; name: string };

/** El cliente aceptó (o rechazó) las cookies de publicidad en el aviso. */
export function adsConsent(granted: boolean) {
  gtagConsent(granted);
  fbq()?.("consent", granted ? "grant" : "revoke");
}

/** Creó el pedido y va a pagar. */
export function trackInitiateCheckout({ value, currency, item }: { value: number; currency: string; item: Item }) {
  gtagEvent("begin_checkout", { currency, value, items: [{ item_id: item.id, item_name: item.name, price: value, quantity: 1 }] });
  fbq()?.("track", "InitiateCheckout", { value, currency, content_ids: [item.id], content_name: item.name, content_type: "product", num_items: 1 });
}

/** Pago confirmado. El número de pedido evita duplicados (eventID en Meta, transaction_id en Google). */
export function trackPurchase({ number, value, currency, item, googleSendTo }: { number: string; value: number; currency: string; item: Item; googleSendTo: string | null }) {
  gtagEvent("purchase", { transaction_id: number, value, currency, items: [{ item_id: item.id, item_name: item.name, price: value, quantity: 1 }] });
  if (googleSendTo) gtagEvent("conversion", { send_to: googleSendTo, value, currency, transaction_id: number });
  fbq()?.("track", "Purchase", { value, currency, content_ids: [item.id], content_name: item.name, content_type: "product", num_items: 1 }, { eventID: number });
}
