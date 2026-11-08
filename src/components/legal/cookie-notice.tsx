"use client";

import { useEffect, useState } from "react";
import { Cookie, X } from "lucide-react";
import { CONSENT_KEY } from "@/domain/google-tag";
import { adsConsent } from "@/lib/ads";

const KEY = "vx_cookie_notice";
/** Evento para volver a mostrar la elección (botón «Cambiar mis preferencias» en la política de cookies). */
const REOPEN = "vx:cookie-choice";

/**
 * Aviso de cookies.
 *  - Sin etiqueta de Google: la tienda solo usa cookies técnicas necesarias, no hace falta pedir consentimiento;
 *    igual se informa una vez, sin bloquear la página.
 *  - Con Meta Pixel o la etiqueta de Google (`ads`: sus nombres): se pide permiso para las cookies de medición de
 *    anuncios (Ley 1581: autorización previa, expresa e informada). Hasta que la persona acepta, no se envía nada
 *    a Meta y Google no guarda cookies.
 */
export function CookieNotice({ ads = [] }: { ads?: string[] }) {
  const consent = ads.length > 0;
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      if (!localStorage.getItem(consent ? CONSENT_KEY : KEY)) setShow(true);
    } catch {
      // Sin almacenamiento (modo privado estricto): no se muestra para no repetirlo en cada página.
    }
    const reopen = () => setShow(true);
    window.addEventListener(REOPEN, reopen);
    return () => window.removeEventListener(REOPEN, reopen);
  }, [consent]);
  if (!show) return null;

  const close = () => {
    setShow(false);
    try {
      localStorage.setItem(KEY, "1");
    } catch {}
  };
  const choose = (granted: boolean) => {
    setShow(false);
    adsConsent(granted);
    try {
      localStorage.setItem(CONSENT_KEY, granted ? "granted" : "denied");
      localStorage.setItem(KEY, "1");
    } catch {}
  };

  return (
    <div role="region" aria-label="Aviso de cookies" className="cookie-notice fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 mr-16 animate-fade-up sm:inset-x-auto sm:left-5 sm:mr-0 sm:max-w-[380px] short:bottom-[calc(0.5rem+env(safe-area-inset-bottom))] short:sm:max-w-[600px]">
      <div className="flex items-start gap-3 rounded-[14px] bg-ink-800/95 p-3.5 text-[12.5px] leading-relaxed text-fg-muted shadow-[var(--shadow-lift)] ring-1 ring-white/10 backdrop-blur short:p-2.5">
        <Cookie className="mt-0.5 size-4 shrink-0 text-volt-300" />
        {consent ? (
          <div className="min-w-0 flex-1">
            <p>
              Usamos cookies necesarias para que la tienda funcione y, si aceptas, cookies de {ads.join(" y ")} para medir nuestros anuncios.{" "}
              <a href="/legal/cookies" className="text-fg underline underline-offset-2">
                Más información
              </a>
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={() => choose(true)} className="rounded-full bg-volt-400 px-3 py-1 text-[12px] font-semibold text-volt-ink hover:bg-volt-300">
                Aceptar
              </button>
              <button type="button" onClick={() => choose(false)} className="rounded-full bg-white/10 px-3 py-1 text-[12px] font-semibold text-fg hover:bg-white/15">
                Solo necesarias
              </button>
            </div>
          </div>
        ) : (
          <p className="min-w-0 flex-1">
            Solo usamos cookies necesarias para que la tienda funcione (sesión y carrito). Sin publicidad ni rastreo.{" "}
            <a href="/legal/cookies" className="text-fg underline underline-offset-2">
              Más información
            </a>
            <button type="button" onClick={close} className="mt-2 block rounded-full bg-white/10 px-3 py-1 text-[12px] font-semibold text-fg hover:bg-white/15">
              Entendido
            </button>
          </p>
        )}
        <button
          type="button"
          onClick={consent ? () => choose(false) : close}
          aria-label={consent ? "Cerrar y usar solo las cookies necesarias" : "Cerrar aviso de cookies"}
          className="-m-1 grid size-7 shrink-0 place-items-center rounded-full text-fg-subtle hover:bg-white/10 hover:text-fg"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

/** Botón para cambiar la elección de cookies (vuelve a mostrar el aviso). */
export function CookieChoiceButton() {
  return (
    <button type="button" onClick={() => window.dispatchEvent(new Event(REOPEN))} className="rounded-full bg-white/10 px-3.5 py-1.5 text-[13px] font-semibold text-fg hover:bg-white/15">
      Cambiar mis preferencias de cookies
    </button>
  );
}
