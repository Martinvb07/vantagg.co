"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Barra fina arriba de la pantalla mientras carga la siguiente sección.
 * Aparece al instante al hacer clic en un enlace interno y se va cuando cambia la ruta.
 */
export function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || !a.href || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      clear();
      setState("loading");
      // Por si la navegación se cancela o no cambia la ruta.
      timers.current.push(setTimeout(() => setState("idle"), 15_000));
    };
    // En captura: los enlaces de Next cancelan el clic (navegan sin recargar) antes de que llegue aquí.
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    setState((s) => {
      if (s !== "loading") return s;
      clear();
      timers.current.push(setTimeout(() => setState("idle"), 300));
      return "done";
    });
  }, [pathname, search]);

  useEffect(() => clear, []);

  if (state === "idle") return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px] overflow-hidden">
      <div
        className={
          state === "loading"
            ? "h-full w-full origin-left animate-navprogress bg-volt-400 shadow-[0_0_10px_var(--color-volt-400)]"
            : "h-full w-full origin-left bg-volt-400 opacity-0 transition-opacity duration-300"
        }
      />
    </div>
  );
}
