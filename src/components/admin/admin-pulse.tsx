"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

type Counts = { orders: number; claims: number; tickets: number; chats: number; ordersVersion?: string };

/** Inicio y el listado de pedidos se actualizan solos cuando entra un pedido o cambia el estado de alguno. */
const showsOrders = (p: string) => p === "/admin" || p === "/admin/pedidos";

/** Hay un campo con el cursor (buscador, filtros, notas): no se recarga para no borrar lo que se escribe. */
const typing = () => {
  const a = document.activeElement as HTMLElement | null;
  return !!a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.tagName === "SELECT" || a.isContentEditable);
};

const total = (c: Counts) => c.orders + c.claims + c.tickets + c.chats;

/** Aviso corto con Web Audio (sin archivos). El navegador lo permite tras la primera interacción. */
function chime() {
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;
    [880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + i * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.08, now + i * 0.14 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.14 + 0.22);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + i * 0.14);
      osc.stop(now + i * 0.14 + 0.25);
    });
    setTimeout(() => void ctx.close(), 800);
  } catch {
    /* sin audio disponible */
  }
}

/**
 * Vigila los pendientes del panel: actualiza el título de la pestaña, refresca
 * el panel cuando algo cambia (en Inicio y Pedidos, también con cada pedido nuevo o
 * actualizado) y suena cuando llega un chat o una cuenta por entregar.
 */
export function AdminPulse({ initial }: { initial: Counts }) {
  const router = useRouter();
  const pathname = usePathname();
  const last = useRef<Counts>(initial);
  const path = useRef(pathname);
  path.current = pathname;

  const setTitle = (c: Counts) => {
    const n = total(c);
    const base = document.title.replace(/^\(\d+\)\s*/, "");
    document.title = n > 0 ? `(${n}) ${base}` : base;
  };

  useEffect(() => {
    const t = setTimeout(() => setTitle(last.current), 50);
    return () => clearTimeout(t);
  }, [pathname]);

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const res = await fetch("/api/admin/pulse", { cache: "no-store" });
        if (res.ok) {
          let c = (await res.json()) as Counts;
          const prev = last.current;
          if (c.chats > prev.chats) chime();
          if (c.ordersVersion !== prev.ordersVersion && showsOrders(path.current)) {
            // Inicio y Pedidos se recargan enteros: el refresco interno de Next a veces recibe los datos nuevos y no
            // los muestra, y el listado se quedaba sin los pedidos nuevos. Si estás escribiendo, espera al siguiente turno.
            if (!typing()) {
              window.location.reload();
              return;
            }
            c = { ...c, ordersVersion: prev.ordersVersion };
          } else if (total(c) !== total(prev) || c.chats !== prev.chats) router.refresh();
          last.current = c;
          setTitle(c);
        }
      } catch {
        /* sin conexión */
      }
      if (!stop) timer = setTimeout(tick, document.visibilityState === "visible" ? 15_000 : 60_000);
    };
    timer = setTimeout(tick, 15_000);
    // Al volver a la pestaña se revisa enseguida (no espera el siguiente turno).
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      clearTimeout(timer);
      void tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stop = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);

  return null;
}
