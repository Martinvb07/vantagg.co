"use client";

import { useEffect, useRef, useState } from "react";
import { BadgeCheck, Crown, Gem, Sparkles, Users, Zap } from "lucide-react";
import type { LiveData, LivePurchase } from "@/server/catalog";
import { DiamondCover, tierFor } from "@/components/brand/covers";
import { timeAgo } from "@/components/store/time-ago";
import { cn } from "@/lib/utils";

const REFRESH_MS = 15_000;
const num = new Intl.NumberFormat("es-CO");

function speed(sec: number | null) {
  if (sec == null) return null;
  if (sec < 60) return "< 1 min";
  const m = Math.round(sec / 60);
  return m < 60 ? `${m} min` : `${Math.round(m / 60)} h`;
}

/** Misma portada que los paquetes de la tienda; las cuentas usan un sello propio. */
function Cover({ p, className }: { p: LivePurchase; className?: string }) {
  if (p.diamonds == null)
    return (
      <div className={cn("grid aspect-square place-items-center bg-gradient-to-b from-violet-500/30 to-ink-900 text-violet-200", className)} aria-hidden>
        <Users className="size-1/3" />
      </div>
    );
  const base = p.diamonds - (p.bonus ?? 0);
  return <DiamondCover tier={tierFor(base)} diamonds={base} bonus={p.bonus ?? 0} className={className} />;
}

// Podio: oro al centro (más alto), plata a la izquierda, bronce a la derecha.
const PODIUM = [
  { place: 1, ring: "ring-amber-300/70 shadow-[0_18px_50px_-18px_rgb(251_191_36/0.55)]", base: "h-16 sm:h-20 from-amber-300/35 via-amber-500/15", medal: "from-amber-200 to-amber-500 text-amber-950", label: "text-amber-200" },
  { place: 2, ring: "ring-slate-200/40", base: "h-10 sm:h-14 from-slate-200/25 via-slate-400/10", medal: "from-slate-100 to-slate-400 text-slate-900", label: "text-slate-200" },
  { place: 3, ring: "ring-orange-400/40", base: "h-7 sm:h-10 from-orange-400/25 via-orange-600/10", medal: "from-orange-300 to-orange-700 text-orange-950", label: "text-orange-200" },
];

/**
 * «Entregas en vivo»: podio con las recargas más grandes de la semana y una cinta que corre con las
 * últimas 10 entregas completadas (pedidos reales). Se actualiza sola cada 15 s con la pestaña a la
 * vista; cuando entra una entrega nueva aparece un aviso arriba. Sin datos personales.
 */
export function LivePurchases({ initial }: { initial: LiveData }) {
  const [data, setData] = useState(initial);
  const [flash, setFlash] = useState<LivePurchase | null>(null);
  const [now, setNow] = useState(() => new Date());
  const known = useRef(new Set(initial.items.map((i) => i.key)));

  useEffect(() => {
    let stop = false;
    let hide: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/compras-recientes", { cache: "no-store" });
        if (!res.ok) return;
        const next = (await res.json()) as LiveData;
        if (stop || !Array.isArray(next?.items)) return;
        const added = next.items.filter((i) => !known.current.has(i.key));
        next.items.forEach((i) => known.current.add(i.key));
        setData(next);
        if (added.length) {
          setFlash(added[0]);
          clearTimeout(hide);
          hide = setTimeout(() => setFlash(null), 6000);
        }
      } catch {
        // Sin conexión: se mantiene lo actual y se reintenta en el próximo ciclo.
      }
      setNow(new Date());
    };
    const timer = setInterval(load, REFRESH_MS);
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stop = true;
      clearInterval(timer);
      clearTimeout(hide);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const { items, podium, stats } = data;
  if (items.length === 0) return null;

  const stat = [
    stats.today > 0 && { icon: BadgeCheck, value: num.format(stats.today), label: stats.today === 1 ? "entrega hoy" : "entregas hoy" },
    stats.diamonds30d > 0 && { icon: Gem, value: num.format(stats.diamonds30d), label: "diamantes · 30 días" },
    stats.avgDeliverySec != null && { icon: Zap, value: speed(stats.avgDeliverySec)!, label: "entrega típica" },
  ].filter(Boolean) as Array<{ icon: typeof Gem; value: string; label: string }>;

  // Orden visual del podio: 2 · 1 · 3.
  const slots = [podium[1], podium[0], podium[2]].map((p, i) => (p ? { p, cfg: PODIUM[[1, 0, 2][i]] } : null));

  return (
    <section
      aria-labelledby="entregas-en-vivo"
      className="relative overflow-hidden rounded-[24px] bg-[radial-gradient(120%_80%_at_50%_0%,rgb(37_99_235/0.22),transparent_60%),linear-gradient(180deg,#0b1430,#0b0f1a)] ring-1 ring-white/[0.08]"
    >
      {/* Haces de luz como en las portadas */}
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.07] [background:linear-gradient(115deg,transparent_40%,#fff_40%,#fff_46%,transparent_46%,transparent_58%,#fff_58%,#fff_61%,transparent_61%)]" />

      <div className="relative px-4 pt-5 sm:px-7 sm:pt-7">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-ok-400/12 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.16em] text-ok-400 ring-1 ring-ok-400/30">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-ok-400 opacity-75" />
                <span className="relative inline-flex size-1.5 rounded-full bg-ok-400" />
              </span>
              En vivo
            </span>
            <h2 id="entregas-en-vivo" className="mt-2.5 font-display text-[26px] font-extrabold uppercase italic leading-[0.95] tracking-tight sm:text-[34px]">
              Entregas <span className="text-volt-400">completadas</span>
            </h2>
            <p className="mt-1.5 text-[13px] text-sky-100/60">Recargas reales que ya llegaron al ID del jugador.</p>
          </div>
          {stat.length > 0 && (
            <dl className="flex w-full divide-x divide-white/10 rounded-[14px] bg-white/[0.04] py-2.5 ring-1 ring-white/[0.07] backdrop-blur sm:w-auto">
              {stat.map(({ icon: Icon, value, label }) => (
                <div key={label} className="flex min-w-0 flex-1 flex-col-reverse px-3 sm:flex-none sm:px-5">
                  <dt className="mt-0.5 text-[11px] leading-tight text-sky-100/55 sm:text-[11.5px]">{label}</dt>
                  <dd className="flex items-center gap-1.5 font-display text-[18px] font-bold tabular-nums sm:text-[20px]">
                    <Icon className="size-3.5 shrink-0 text-volt-300" /> {value}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        {/* Aviso de entrega nueva */}
        <div aria-live="polite" className="relative mt-4 h-0">
          {flash && (
            <p key={flash.key} className="absolute inset-x-0 top-0 z-10 mx-auto flex w-fit max-w-full animate-pop-in items-center gap-2 rounded-full bg-volt-400 px-3.5 py-1.5 text-[12.5px] font-semibold text-volt-ink shadow-[0_10px_30px_-8px_rgb(200_240_79/0.7)]">
              <Sparkles className="size-3.5 shrink-0" />
              <span className="truncate">
                ¡Nueva entrega! {flash.diamonds != null ? `${num.format(flash.diamonds)} diamantes` : "Cuenta Free Fire"}
                {flash.player ? ` · ID ${flash.player}` : ""}
              </span>
            </p>
          )}
        </div>

        {/* Podio de la semana */}
        {podium.length > 0 && (
          <div className="mt-9 sm:mt-10">
            <p className="mb-4 flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-amber-200/80">
              <Crown className="size-3.5" /> Top de la semana
            </p>
            <ol className="mx-auto grid max-w-[620px] grid-cols-3 items-end gap-2.5 sm:gap-5">
              {slots.map((s, i) =>
                s ? (
                  <li key={s.p.key} className={cn("flex flex-col items-center text-center", s.cfg.place === 1 ? "order-2" : i === 0 ? "order-1" : "order-3")}>
                    <div className={cn("relative w-full", s.cfg.place === 1 ? "max-w-[190px]" : "max-w-[150px]")}>
                      <span className={cn("absolute -left-2 -top-2 z-10 grid size-7 place-items-center rounded-full bg-gradient-to-b font-display text-[13px] font-extrabold shadow-lg ring-2 ring-ink-950 sm:size-8", s.cfg.medal)}>
                        {s.cfg.place === 1 ? <Crown className="size-3.5 sm:size-4" /> : s.cfg.place}
                      </span>
                      <Cover p={s.p} className={cn("w-full rounded-[14px] ring-2", s.cfg.ring, s.cfg.place === 1 && "animate-float")} />
                    </div>
                    <p className={cn("mt-2.5 font-display font-extrabold tabular-nums leading-none", s.cfg.place === 1 ? "text-[19px] sm:text-[24px]" : "text-[15px] sm:text-[19px]")}>
                      {s.p.diamonds != null ? num.format(s.p.diamonds) : "Cuenta"}
                      <Gem className={cn("ml-1 inline size-3.5 -translate-y-px sm:size-4", s.cfg.label)} />
                    </p>
                    <p className="mt-1 truncate font-mono text-[11px] text-sky-100/55 sm:text-[12px]">{s.p.player ? `ID ${s.p.player}` : "Verificado"}</p>
                    {/* Escalón del podio */}
                    <div className={cn("mt-2.5 grid w-full place-items-center rounded-t-[12px] bg-gradient-to-b to-transparent", s.cfg.base)}>
                      <span className={cn("font-display text-[22px] font-black italic opacity-80 sm:text-[30px]", s.cfg.label)}>{s.cfg.place}</span>
                    </div>
                  </li>
                ) : (
                  <li key={`vacio-${i}`} className={i === 0 ? "order-1" : "order-3"} aria-hidden />
                ),
              )}
            </ol>
          </div>
        )}
      </div>

      {/* Cinta en vivo: últimas 10 entregas, corre sola (se detiene al pasar el dedo o el mouse) */}
      <div className="relative mt-0 border-t border-white/[0.08] bg-black/25 py-3">
        <p className="sr-only">Últimas entregas</p>
        <div className="group overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_6%,#000_94%,transparent)] motion-reduce:overflow-x-auto">
          <ul className="flex w-max animate-marquee gap-2.5 px-2 group-hover:[animation-play-state:paused] motion-reduce:animate-none">
            {[...items, ...items].map((p, i) => (
              <li
                key={`${p.key}-${i}`}
                aria-hidden={i >= items.length || undefined}
                className="flex shrink-0 items-center gap-2.5 rounded-full bg-white/[0.05] py-1 pl-1 pr-3.5 ring-1 ring-white/[0.08]"
              >
                <Cover p={p} className="size-9 rounded-full" />
                <span className="leading-tight">
                  <span className="block text-[13px] font-bold tabular-nums">
                    {p.diamonds != null ? `${num.format(p.diamonds)} diamantes` : "Cuenta Free Fire"}
                  </span>
                  <span className="block text-[11px] text-sky-100/55" suppressHydrationWarning>
                    {p.player ? <span className="font-mono">ID {p.player}</span> : "Verificado"} · {timeAgo(new Date(p.at), now)}
                  </span>
                </span>
                <BadgeCheck className="size-4 text-ok-400" aria-label="Entregado" />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
