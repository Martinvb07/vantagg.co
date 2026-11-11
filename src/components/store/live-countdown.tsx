"use client";

import { useEffect, useState } from "react";

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return [
    [Math.floor(s / 86_400), "Días"],
    [Math.floor((s % 86_400) / 3_600), "Horas"],
    [Math.floor((s % 3_600) / 60), "Min"],
    [s % 60, "Seg"],
  ] as const;
}

/**
 * Cuenta regresiva en vivo (cada segundo) hasta el cierre de la temporada. El primer dibujo usa la hora del servidor
 * (igual en servidor y navegador); luego sigue con el reloj del navegador. Al llegar a cero recarga la página una sola
 * vez (por temporada) para mostrar la nueva.
 */
export function LiveCountdown({ endsAt, serverNow }: { endsAt: string; serverNow: string }) {
  const end = new Date(endsAt).getTime();
  const [left, setLeft] = useState(() => end - new Date(serverNow).getTime());
  useEffect(() => {
    let reloading = false;
    const tick = () => {
      const ms = end - Date.now();
      setLeft(ms);
      if (ms > 0 || reloading) return;
      reloading = true;
      try {
        const key = `vx_top_cierre:${endsAt}`;
        if (sessionStorage.getItem(key)) return;
        sessionStorage.setItem(key, "1");
      } catch {
        return;
      }
      setTimeout(() => window.location.reload(), 2500);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [end, endsAt]);

  return (
    <dl className="mt-2.5 grid max-w-[400px] grid-cols-4 gap-2 sm:gap-2.5" aria-label="Tiempo para el cierre de la temporada">
      {parts(left).map(([v, l]) => (
        <div key={l} className="flex -skew-x-[10deg] flex-col-reverse rounded-[6px] bg-ink-950/60 px-2.5 py-2.5 ring-1 ring-white/[0.1] sm:px-3">
          <dt className="mt-1 skew-x-[10deg] text-[10px] font-medium uppercase tracking-[0.06em] text-fg-subtle sm:text-[10.5px]">{l}</dt>
          <dd className={`skew-x-[10deg] font-display text-[22px] font-black italic tabular-nums leading-none sm:text-[24px] ${l === "Seg" ? "text-volt-300" : ""}`}>{String(v).padStart(2, "0")}</dd>
        </div>
      ))}
    </dl>
  );
}
