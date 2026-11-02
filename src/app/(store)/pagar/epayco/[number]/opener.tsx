"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/primitives";

type EpaycoHandler = { openNew: () => void };
type EpaycoGlobal = { checkout?: { configure: (o: { sessionId: string; external: boolean }) => EpaycoHandler } };

/** Carga el checkout de ePayco y lo abre con la sesión de cobro (en su página, no dentro de la tienda). */
export function EpaycoOpener({ sessionId, script, nonce, orderUrl }: { sessionId: string; script: string; nonce?: string; orderUrl: string }) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const opened = useRef(false);

  const open = useCallback(() => {
    const ePayco = (window as unknown as { ePayco?: EpaycoGlobal }).ePayco;
    if (!ePayco?.checkout) return setState("error");
    try {
      ePayco.checkout.configure({ sessionId, external: true }).openNew();
    } catch {
      setState("error");
    }
  }, [sessionId]);

  useEffect(() => {
    const ready = () => {
      setState("ready");
      if (!opened.current) {
        opened.current = true;
        open();
      }
    };
    if ((window as unknown as { ePayco?: EpaycoGlobal }).ePayco?.checkout) return ready();
    const s = document.createElement("script");
    s.src = script;
    s.async = true;
    if (nonce) s.nonce = nonce;
    s.onload = ready;
    s.onerror = () => setState("error");
    document.head.appendChild(s);
  }, [script, nonce, open]);

  if (state === "error") {
    return (
      <div className="mt-5 space-y-3">
        <Alert tone="danger">No pudimos abrir ePayco. Revisa tu conexión e inténtalo de nuevo; si sigue fallando, elige otro medio de pago desde el pedido.</Alert>
        <Button type="button" className="w-full" onClick={() => location.reload()}>
          Reintentar
        </Button>
        <a href={orderUrl} className="block text-center text-[13px] text-fg-muted underline underline-offset-2">
          Volver al pedido
        </a>
      </div>
    );
  }
  return (
    <div className="mt-5 space-y-2">
      <Button type="button" size="lg" className="h-12 w-full text-[15px]" loading={state === "loading"} onClick={open}>
        <ExternalLink className="size-4" /> Ir a pagar en ePayco
      </Button>
      <p className="text-center text-[12px] text-fg-subtle">{state === "loading" ? "Abriendo la pasarela de pago…" : "Si no se abrió sola, toca el botón."}</p>
    </div>
  );
}
