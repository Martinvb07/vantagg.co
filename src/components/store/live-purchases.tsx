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

/** Curva cerrada irregular (curva de nivel) alrededor de un punto; determinista, igual en servidor y navegador. */
function contour(cx: number, cy: number, r: number, seed: number) {
  const pts: string[] = [];
  for (let i = 0; i <= 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    const k = r * (1 + 0.16 * Math.sin(3 * a + seed) + 0.09 * Math.sin(5 * a + seed * 2.3) + 0.05 * Math.cos(7 * a + seed));
    pts.push(`${(cx + Math.cos(a) * k * 1.35).toFixed(1)},${(cy + Math.sin(a) * k).toFixed(1)}`);
  }
  return `M${pts.join("L")}Z`;
}

// Relieve del mapa: tres «cerros» con varias curvas de nivel cada uno.
const CONTOURS = [
  [230, 120, 1.1],
  [1010, 470, 2.4],
  [600, 330, 4.2],
].flatMap(([cx, cy, seed]) => [40, 80, 125, 175, 230].map((r, i) => ({ d: contour(cx, cy, r, seed + i * 0.35), strong: i === 0 })));

// Zona segura (círculo blanco) y posición de cada entrega dentro de ella, sacada de su clave.
const ZONE = { cx: 610, cy: 330, r: 205 };
function pinFor(key: string) {
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const a = ((h % 360) * Math.PI) / 180;
  const d = 30 + ((h >>> 9) % 1000) / 1000 * (ZONE.r - 60);
  return { x: ZONE.cx + Math.cos(a) * d, y: ZONE.cy + Math.sin(a) * d };
}

/**
 * Fondo: mapa de battle royale. Curvas de nivel, la zona azul afuera del círculo seguro, la ruta del
 * avión y un marcador por cada entrega (el más reciente late).
 */
function MapBackdrop({ items }: { items: LivePurchase[] }) {
  return (
    <svg aria-hidden viewBox="0 0 1200 600" preserveAspectRatio="xMidYMid slice" className="pointer-events-none absolute inset-0 size-full">
      <defs>
        <radialGradient id="lp-land" cx="35%" cy="30%" r="90%">
          <stop offset="0" stopColor="#13201a" />
          <stop offset="0.55" stopColor="#0d1414" />
          <stop offset="1" stopColor="#0a0e16" />
        </radialGradient>
        <mask id="lp-outside">
          <rect width="1200" height="600" fill="#fff" />
          <circle cx={ZONE.cx} cy={ZONE.cy} r={ZONE.r} fill="#000" />
        </mask>
        <pattern id="lp-storm" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
          <rect width="14" height="14" fill="#1d4ed8" fillOpacity="0.07" />
          <rect width="2" height="14" fill="#60a5fa" fillOpacity="0.07" />
        </pattern>
      </defs>
      <rect width="1200" height="600" fill="url(#lp-land)" />
      {CONTOURS.map((c, i) => (
        <path key={i} d={c.d} fill="none" stroke="#d6f5c8" strokeOpacity={c.strong ? 0.16 : 0.08} strokeWidth={c.strong ? 1.6 : 1.1} />
      ))}
      {/* Zona: afuera azul con trama, borde blanco */}
      <rect width="1200" height="600" fill="url(#lp-storm)" mask="url(#lp-outside)" />
      <circle cx={ZONE.cx} cy={ZONE.cy} r={ZONE.r} fill="none" stroke="#e0f2fe" strokeOpacity="0.45" strokeWidth="2" />
      <circle cx={ZONE.cx} cy={ZONE.cy} r={ZONE.r + 7} fill="none" stroke="#3b82f6" strokeOpacity="0.35" strokeWidth="10" />
      {/* Ruta del avión */}
      <path d="M-20 60 L1220 560" stroke="#fff" strokeOpacity="0.16" strokeWidth="2" strokeDasharray="10 12" />
      <path d="M1188 547 l14 6 l-12 9" fill="none" stroke="#fff" strokeOpacity="0.3" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Un marcador por entrega (solo en pantallas anchas: en celular quedarían bajo el texto) */}
      <g className="max-lg:hidden">
      {items.map((p, i) => {
        const { x, y } = pinFor(p.key);
        return (
          <g key={p.key} opacity={i === 0 ? 1 : Math.max(0.3, 0.85 - i * 0.07)}>
            {i === 0 && (
              <circle cx={x} cy={y} r="8" fill="none" stroke="#c8f04f" strokeWidth="2">
                <animate attributeName="r" from="8" to="34" dur="1.8s" repeatCount="indefinite" />
                <animate attributeName="stroke-opacity" from="0.8" to="0" dur="1.8s" repeatCount="indefinite" />
              </circle>
            )}
            <circle cx={x} cy={y} r={i === 0 ? 7 : 4.5} fill={i === 0 ? "#c8f04f" : "#e2e8f0"} stroke="#0a0e16" strokeWidth="2" />
          </g>
        );
      })}
      </g>
    </svg>
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
      className="relative overflow-hidden rounded-[22px] bg-ink-900 ring-1 ring-white/[0.07]"
    >
      <MapBackdrop items={items} />
      {/* Oscurece debajo del texto para que se lea sobre el mapa */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-r from-ink-950/85 via-ink-950/40 to-transparent max-lg:bg-gradient-to-b max-lg:from-ink-950/80 max-lg:via-ink-950/50 max-lg:to-ink-950/70" />
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
