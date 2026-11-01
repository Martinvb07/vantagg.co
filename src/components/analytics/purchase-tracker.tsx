"use client";

import { useEffect } from "react";
import { gtagEvent } from "@/lib/gtag";

/**
 * Compra confirmada → evento «purchase» (Analytics) y la conversión de compra de Google Ads, una sola vez
 * por pedido y navegador (Google además descarta repetidos por el número de pedido).
 */
export function PurchaseTracker({ number, value, currency, item, sendTo }: { number: string; value: number; currency: string; item: { id: string; name: string }; sendTo: string | null }) {
  useEffect(() => {
    const key = `vx_conv_${number}`;
    try {
      if (localStorage.getItem(key)) return;
    } catch {}
    gtagEvent("purchase", { transaction_id: number, value, currency, items: [{ item_id: item.id, item_name: item.name, price: value, quantity: 1 }] });
    if (sendTo) gtagEvent("conversion", { send_to: sendTo, value, currency, transaction_id: number });
    try {
      localStorage.setItem(key, "1");
    } catch {}
  }, [number, value, currency, item.id, item.name, sendTo]);
  return null;
}
