"use client";

import { useEffect, useRef, useState } from "react";
import { BadgeCheck, Clock3, Gem, Trophy, Users, Zap } from "lucide-react";
import type { LivePurchase, LiveStats } from "@/server/catalog";
import { timeAgo } from "@/components/store/time-ago";
import { cn } from "@/lib/utils";

const REFRESH_MS = 15_000;
const num = new Intl.NumberFormat("es-CO");

/** Color de la gema según el tamaño del paquete (igual idea que las portadas: más diamantes, más brillo). */
const TIERS = [
  "from-sky-400/25 to-sky-600/10 text-sky-300 ring-sky-400/25",
  "from-cyan-400/25 to-cyan-600/10 text-cyan-300 ring-cyan-400/25",
  "from-indigo-400/25 to-indigo-600/10 text-indigo-300 ring-indigo-400/25",
  "from-violet-400/25 to-violet-600/10 text-violet-300 ring-violet-400/25",
  "from-fuchsia-400/25 to-fuchsia-600/10 text-fuchsia-300 ring-fuchsia-400/25",
  "from-amber-300/30 to-amber-600/10 text-amber-200 ring-amber-300/35",
];
const tier = (d: number | null) => (d == null ? 3 : [200, 450, 800, 1800, 4000].filter((t) => d >= t).length);

/** Puesto del ranking: oro, plata y bronce para los tres primeros. */
const MEDALS = ["bg-gradient-to-b from-amber-200 to-amber-500 text-amber-950", "bg-gradient-to-b from-slate-100 to-slate-400 text-slate-900", "bg-gradient-to-b from-orange-300 to-orange-700 text-orange-950"];

function speed(sec: number | null) {
  if (sec == null) return null;
  if (sec < 60) return "en menos de 1 min";
  const m = Math.round(sec / 60);
  if (m < 60) return `en ${m} min`;
  return `en ${Math.round(m / 60)} h`;
}

function GemTile({ p, big }: { p: LivePurchase; big?: boolean }) {
  const Icon = p.kind === "ACCOUNT" ? Users : Gem;
  return (
    <span className={cn("grid shrink-0 place-items-center bg-gradient-to-b ring-1", TIERS[p.kind === "ACCOUNT" ? 3 : tier(p.diamonds)], big ? "size-16 rounded-[18px]" : "size-11 rounded-[13px]")}>
      <Icon className={big ? "size-8 drop-shadow-[0_0_12px_currentColor]" : "size-5"} strokeWidth={2} />
    </span>
  );
}

function Title({ p, big }: { p: LivePurchase; big?: boolean }) {
  if (p.diamonds == null) return <span className={cn("font-display font-bold", big ? "text-[22px]" : "text-[15px]")}>Cuenta Free Fire</span>;
  return (
    <span className="flex items-baseline gap-1.5">
      <span className={cn("font-display font-extrabold tabular-nums tracking-tight", big ? "text-[30px] leading-none lg:text-[46px]" : "text-[16px]")}>{num.format(p.diamonds)}</span>
      <span className={cn("font-medium text-fg-muted", big ? "text-[14px]" : "text-[12.5px]")}>diamantes</span>
    </span>
  );
}

/**
 * «Entregas en vivo»: ranking de las últimas 10 entregas completadas (pedidos reales), con cifras de
 * confianza. Se actualiza sola cada 15 s mientras la pestaña está a la vista. Sin datos personales.
 */
export function LivePurchases({ initial }: { initial: { items: LivePurchase[]; stats: LiveStats } }) {
  const [data, setData] = useState(initial);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(() => new Date());
  const known = useRef(new Set(initial.items.map((i) => i.key)));

  useEffect(() => {
    let stop = false;
    const load = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/compras-recientes", { cache: "no-store" });
        if (!res.ok) return;
        const next = (await res.json()) as typeof initial;
        if (stop || !Array.isArray(next?.items)) return;
        const added = next.items.filter((i) => !known.current.has(i.key)).map((i) => i.key);
        next.items.forEach((i) => known.current.add(i.key));
        setData(next);
        if (added.length) setFresh(new Set(added));
      } catch {
        // Sin conexión: se mantiene la lista actual y se reintenta en el próximo ciclo.
      }
      setNow(new Date());
    };
    const timer = setInterval(load, REFRESH_MS);
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stop = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const { items, stats } = data;
  if (items.length === 0) return null;
  const [top, ...rest] = items;

  const tiles = [
    stats.today > 0 && { icon: BadgeCheck, value: num.format(stats.today), label: stats.today === 1 ? "entrega hoy" : "entregas hoy" },
    stats.diamonds30d > 0 && { icon: Gem, value: num.format(stats.diamonds30d), label: "diamantes en 30 días" },
    stats.avgDeliverySec != null && { icon: Zap, value: speed(stats.avgDeliverySec)!.replace(/^en /, ""), label: "entrega típica" },
  ].filter(Boolean) as Array<{ icon: typeof Gem; value: string; label: string }>;

  return (
    <section aria-labelledby="entregas-en-vivo" className="relative overflow-hidden rounded-[24px] bg-ink-850 p-4 ring-1 ring-white/[0.07] sm:p-6">
      {/* Brillo de fondo */}
      <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-volt-400/[0.07] blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-20 size-72 rounded-full bg-sky-500/[0.06] blur-3xl" />

      <div className="relative flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-ok-400/12 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-ok-400 ring-1 ring-ok-400/25">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-ok-400 opacity-75" />
              <span className="relative inline-flex size-1.5 rounded-full bg-ok-400" />
            </span>
            En vivo
          </span>
          <h2 id="entregas-en-vivo" className="mt-2 flex items-center gap-2 font-display text-[22px] font-bold tracking-tight sm:text-[26px]">
            <Trophy className="size-6 text-amber-300" /> Entregas completadas
          </h2>
          <p className="mt-1 text-[13px] text-fg-muted">Pedidos reales entregados al ID del jugador. Se actualiza solo.</p>
        </div>
      </div>

      {tiles.length > 0 && (
        <div className={cn("relative mt-4 grid gap-2 sm:gap-3", tiles.length === 3 ? "grid-cols-3" : tiles.length === 2 ? "grid-cols-2" : "grid-cols-1")}>
          {tiles.map(({ icon: Icon, value, label }) => (
            <div key={label} className="rounded-[14px] bg-white/[0.03] px-3 py-2.5 ring-1 ring-white/[0.06] sm:px-4 sm:py-3">
              <Icon className="size-4 text-volt-300" />
              <p className="mt-1.5 truncate font-display text-[17px] font-bold tabular-nums leading-tight sm:text-[20px]">{value}</p>
              <p className="text-[11px] leading-tight text-fg-subtle sm:text-[12px]">{label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="relative mt-4 grid gap-3 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-4">
        {/* #1: la entrega más reciente, destacada */}
        <article
          key={top.key}
          className={cn(
            "relative flex flex-col justify-between overflow-hidden rounded-[18px] bg-gradient-to-br from-amber-300/[0.12] via-ink-800 to-ink-800 p-4 ring-1 ring-amber-300/30 sm:p-5",
            fresh.has(top.key) && "animate-fade-up",
          )}
        >
          <div className="flex items-center justify-between">
            <span className={cn("grid size-8 place-items-center rounded-full font-display text-[14px] font-extrabold shadow-[0_4px_14px_-4px_rgb(251_191_36/0.6)]", MEDALS[0])}>1</span>
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-200/90">Última entrega</span>
          </div>
          <Gem aria-hidden className="pointer-events-none absolute -bottom-10 -right-10 hidden size-56 rotate-12 text-amber-200/[0.06] lg:block" strokeWidth={1.2} />
          <div className="mt-4 flex items-center gap-4 lg:my-auto lg:flex-col lg:items-start lg:gap-5 lg:py-6">
            <GemTile p={top} big />
            <div className="min-w-0">
              <Title p={top} big />
              {top.bonus ? <p className="mt-1 text-[12.5px] font-semibold text-volt-300">incluye +{num.format(top.bonus)} de bonus</p> : null}
              {top.player && <p className="mt-1 font-mono text-[12.5px] text-fg-muted">ID {top.player}</p>}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-white/[0.07] pt-3 text-[12.5px]">
            <span className="inline-flex items-center gap-1.5 font-semibold text-ok-400">
              <BadgeCheck className="size-4" /> Entregado {speed(top.deliverySec) ?? ""}
            </span>
            <span className="inline-flex items-center gap-1 text-fg-subtle" suppressHydrationWarning>
              <Clock3 className="size-3.5" /> {timeAgo(new Date(top.at), now)}
            </span>
          </div>
        </article>

        {/* #2 en adelante */}
        {rest.length > 0 && (
          <ol className="grid grid-cols-[minmax(0,1fr)] gap-1.5" aria-live="polite">
            {rest.map((p, i) => {
              const pos = i + 2;
              return (
                <li
                  key={p.key}
                  className={cn(
                    "flex items-center gap-3 rounded-[14px] bg-white/[0.025] px-2.5 py-2 ring-1 ring-white/[0.05] transition-colors sm:px-3",
                    pos <= 3 && "bg-white/[0.04] ring-white/[0.09]",
                    fresh.has(p.key) && "animate-fade-up ring-volt-400/30",
                  )}
                >
                  <span className={cn("grid size-7 shrink-0 place-items-center rounded-full font-display text-[12.5px] font-extrabold tabular-nums", pos <= 3 ? MEDALS[pos - 1] : "bg-white/[0.06] text-fg-muted")}>{pos}</span>
                  <GemTile p={p} />
                  <span className="min-w-0 flex-1">
                    <Title p={p} />
                    <span className="block truncate text-[12px] text-fg-subtle">
                      {p.player ? <span className="font-mono">ID {p.player}</span> : "Comprador verificado"}
                      {p.bonus ? <span className="hidden text-volt-300/90 sm:inline"> · +{num.format(p.bonus)} bonus</span> : null}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-ok-400">
                      <BadgeCheck className="size-3.5" />
                      <span className="hidden min-[400px]:inline">Entregado</span>
                    </span>
                    <span className="block text-[11.5px] text-fg-subtle" suppressHydrationWarning>
                      {timeAgo(new Date(p.at), now)}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}
