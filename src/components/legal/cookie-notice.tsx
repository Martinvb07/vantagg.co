"use client";

import { useEffect, useState } from "react";
import { Cookie, X } from "lucide-react";

const KEY = "vx_cookie_notice";

/**
 * Aviso de cookies: la tienda solo usa cookies técnicas necesarias (sin analítica ni publicidad), por lo
 * que no hace falta pedir consentimiento; igual se informa una vez, sin bloquear la página.
 */
export function CookieNotice() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setShow(true);
    } catch {
      // Sin almacenamiento (modo privado estricto): no se muestra para no repetirlo en cada página.
    }
  }, []);
  if (!show) return null;
  const close = () => {
    setShow(false);
    try {
      localStorage.setItem(KEY, "1");
    } catch {}
  };
  return (
    <div role="region" aria-label="Aviso de cookies" className="cookie-notice fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 mr-16 animate-fade-up sm:inset-x-auto sm:left-5 sm:mr-0 sm:max-w-[380px]">
      <div className="flex items-start gap-3 rounded-[14px] bg-ink-800/95 p-3.5 text-[12.5px] leading-relaxed text-fg-muted shadow-[var(--shadow-lift)] ring-1 ring-white/10 backdrop-blur">
        <Cookie className="mt-0.5 size-4 shrink-0 text-volt-300" />
        <p className="min-w-0 flex-1">
          Solo usamos cookies necesarias para que la tienda funcione (sesión y carrito). Sin publicidad ni rastreo.{" "}
          <a href="/legal/cookies" className="text-fg underline underline-offset-2">
            Más información
          </a>
          <button type="button" onClick={close} className="mt-2 block rounded-full bg-white/10 px-3 py-1 text-[12px] font-semibold text-fg hover:bg-white/15">
            Entendido
          </button>
        </p>
        <button type="button" onClick={close} aria-label="Cerrar aviso de cookies" className="-m-1 grid size-7 shrink-0 place-items-center rounded-full text-fg-subtle hover:bg-white/10 hover:text-fg">
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
