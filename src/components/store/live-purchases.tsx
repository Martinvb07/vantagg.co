"use client";

import { useEffect, useRef, useState } from "react";
import { BadgeCheck, ChevronsRight, Gem, Users, Zap } from "lucide-react";
import type { LiveData, LivePurchase } from "@/server/catalog";
import { LogoMark } from "@/components/brand/logo";
import { timeAgo } from "@/components/store/time-ago";
import { cn } from "@/lib/utils";

const REFRESH_MS = 15_000;
const num = new Intl.NumberFormat("es-CO");

/** Color de la gema según el tamaño de la recarga (como las portadas: más diamantes, más brillo). */
const GEM_TONES = ["text-sky-300", "text-cyan-300", "text-indigo-300", "text-violet-300", "text-fuchsia-300", "text-amber-300"];
const gemTone = (d: number) => GEM_TONES[[200, 450, 800, 1800, 4000].filter((t) => d >= t).length];

function speed(sec: number | null) {
  if (sec == null) return null;
  if (sec < 60) return "<1 min";
  const m = Math.round(sec / 60);
  return m < 60 ? `${m} min` : `${Math.round(m / 60)} h`;
}

/** Esquinas tipo visor (HUD) del juego. */
function HudCorners() {
  const c = "pointer-events-none absolute size-5 border-volt-400/70";
  return (
    <>
      <span aria-hidden className={cn(c, "left-3 top-3 border-l-2 border-t-2")} />
      <span aria-hidden className={cn(c, "right-3 top-3 border-r-2 border-t-2")} />
      <span aria-hidden className={cn(c, "bottom-3 left-3 border-b-2 border-l-2")} />
      <span aria-hidden className={cn(c, "bottom-3 right-3 border-b-2 border-r-2")} />
    </>
  );
}

/** Una línea del feed, como el registro de bajas del juego: tienda ▸ botín ▸ jugador. */
function FeedRow({ p, latest, fresh, now, fade }: { p: LivePurchase; latest: boolean; fresh: boolean; now: Date; fade: number }) {
  return (
    <li className={cn("flex justify-end", fresh && "animate-feed-in")} style={{ opacity: latest ? 1 : fade }}>
      <div
        className={cn(
          "flex max-w-full -skew-x-[14deg] items-center border-r-[3px] py-1.5 pl-5 pr-3 sm:pl-8",
          latest ? "border-volt-400 bg-gradient-to-l from-volt-400/25 via-volt-400/10 to-transparent" : "border-white/25 bg-gradient-to-l from-black/70 via-black/45 to-transparent",
        )}
      >
        <div className="flex min-w-0 skew-x-[14deg] items-center gap-2 text-[12.5px] sm:gap-2.5 sm:text-[13.5px]">
          {latest && <span className="hidden shrink-0 font-display text-[12px] font-black italic tracking-wide text-volt-300 min-[420px]:inline">BOOYAH!</span>}
          <LogoMark className="size-5 shrink-0" />
          <ChevronsRight className="hidden size-3.5 shrink-0 text-white/35 min-[400px]:block" />
          {p.diamonds != null ? (
            <span className="flex shrink-0 items-center gap-1 font-display font-extrabold tabular-nums">
              <Gem className={cn("size-4", gemTone(p.diamonds))} strokeWidth={2.3} />
              {num.format(p.diamonds)}
            </span>
          ) : (
            <span className="flex shrink-0 items-center gap-1 font-display font-extrabold">
              <Users className="size-4 text-violet-300" /> Cuenta
            </span>
          )}
          <ChevronsRight className="size-3.5 shrink-0 text-white/35" />
          <span className={cn("truncate font-mono font-semibold", latest ? "text-white" : "text-sky-100/85")}>{p.player ? `ID ${p.player}` : "Jugador verificado"}</span>
          <span className="shrink-0 text-[11px] text-white/40" suppressHydrationWarning>
            {timeAgo(new Date(p.at), now).replace("hace ", "")}
          </span>
        </div>
      </div>
    </li>
  );
}

/**
 * «Entregas en vivo» con el lenguaje del juego: un registro tipo kill feed con las últimas 10 entregas
 * completadas (pedidos reales) y contadores estilo HUD. Se actualiza sola cada 15 s con la pestaña a
 * la vista; las entregas nuevas entran deslizándose como en partida. Sin datos personales.
 */
export function LivePurchases({ initial }: { initial: LiveData }) {
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
        const next = (await res.json()) as LiveData;
        if (stop || !Array.isArray(next?.items)) return;
        const added = next.items.filter((i) => !known.current.has(i.key)).map((i) => i.key);
        next.items.forEach((i) => known.current.add(i.key));
        setData(next);
        if (added.length) setFresh(new Set(added));
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
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const { items, stats } = data;
  if (items.length === 0) return null;

  const hud = [
    stats.today > 0 && { icon: BadgeCheck, value: num.format(stats.today), label: stats.today === 1 ? "Entrega hoy" : "Entregas hoy" },
    stats.diamonds30d > 0 && { icon: Gem, value: num.format(stats.diamonds30d), label: "Diamantes en 30 días" },
    stats.avgDeliverySec != null && { icon: Zap, value: speed(stats.avgDeliverySec)!, label: "Tiempo de entrega" },
  ].filter(Boolean) as Array<{ icon: typeof Gem; value: string; label: string }>;

  return (
    <section
      aria-labelledby="entregas-en-vivo"
      className="relative overflow-hidden rounded-[22px] bg-ink-900 bg-[linear-gradient(rgb(255_255_255/0.025)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.025)_1px,transparent_1px)] bg-[size:26px_26px] ring-1 ring-white/[0.07]"
    >
      <div aria-hidden className="pointer-events-none absolute -left-24 -top-28 size-80 rounded-full bg-volt-400/[0.09] blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-32 right-0 size-80 rounded-full bg-sky-500/[0.08] blur-3xl" />
      <HudCorners />

      <div className="relative grid gap-7 px-5 py-7 sm:px-8 sm:py-9 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center lg:gap-10">
        <div>
          <p className="flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-subtle">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-bad-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-bad-400" />
            </span>
            Transmisión en vivo
          </p>
          <h2 id="entregas-en-vivo" className="mt-3 font-display text-[40px] font-black uppercase italic leading-[0.88] tracking-tight sm:text-[52px]">
            <span className="text-volt-400 drop-shadow-[0_0_24px_rgb(200_240_79/0.35)]">Booyah</span>
            <br />
            <span className="text-[24px] sm:text-[30px]">en tiempo real</span>
          </h2>
          <p className="mt-3 max-w-[360px] text-[13.5px] leading-relaxed text-fg-muted">Cada línea es una recarga real que ya llegó al ID del jugador. Así se ve una entrega en VANTAGG.</p>

          {hud.length > 0 && (
            <dl className="mt-6 grid grid-cols-3 gap-2 lg:max-w-[400px]">
              {hud.map(({ icon: Icon, value, label }) => (
                <div key={label} className="-skew-x-[10deg] rounded-[6px] bg-white/[0.04] px-3 py-2.5 ring-1 ring-white/[0.08]">
                  <div className="skew-x-[10deg]">
                    <dd className="flex items-center gap-1.5 font-display text-[18px] font-black italic tabular-nums leading-none sm:text-[22px]">
                      <Icon className="size-4 shrink-0 text-volt-300" />
                      {value}
                    </dd>
                    <dt className="mt-1.5 text-[10.5px] font-medium uppercase leading-tight tracking-[0.06em] text-fg-subtle">{label}</dt>
                  </div>
                </div>
              ))}
            </dl>
          )}
        </div>

        {/* Registro de entregas: la más reciente arriba; las anteriores se van apagando como en partida */}
        <div>
          <p className="mb-2.5 flex items-center justify-end gap-2 font-mono text-[10.5px] font-semibold uppercase tracking-[0.2em] text-fg-subtle">
            Registro de entregas <span className="h-px w-8 bg-white/15" />
          </p>
          <ol className="space-y-1.5 overflow-hidden" aria-live="polite">
            {items.map((p, i) => (
              <FeedRow key={p.key} p={p} latest={i === 0} fresh={fresh.has(p.key)} now={now} fade={Math.max(0.35, 1 - i * 0.08)} />
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
