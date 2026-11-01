"use client";

import { useEffect } from "react";
import { trackPurchase } from "@/lib/ads";

/**
 * Compra confirmada → «Purchase» en Meta Pixel y «purchase» + conversión de compra en Google, una sola vez
 * por pedido y navegador (Meta y Google además descartan repetidos por el número de pedido).
 */
export function PurchaseTracker({ number, value, currency, item, googleSendTo }: { number: string; value: number; currency: string; item: { id: string; name: string }; googleSendTo: string | null }) {
  useEffect(() => {
    const key = `vx_conv_${number}`;
    try {
      if (localStorage.getItem(key)) return;
    } catch {}
    trackPurchase({ number, value, currency, item, googleSendTo });
    try {
      localStorage.setItem(key, "1");
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [number]);
  return null;
}
