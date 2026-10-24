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

/** Esquinas tipo visor (HUD) del juego. */
function HudCorners() {
  const c = "pointer-events-none absolute size-4 border-volt-400/70 sm:size-5";
  return (
    <>
      <span aria-hidden className={cn(c, "left-2.5 top-2.5 border-l-2 border-t-2 sm:left-3 sm:top-3")} />
      <span aria-hidden className={cn(c, "right-2.5 top-2.5 border-r-2 border-t-2 sm:right-3 sm:top-3")} />
      <span aria-hidden className={cn(c, "bottom-2.5 left-2.5 border-b-2 border-l-2 sm:bottom-3 sm:left-3")} />
      <span aria-hidden className={cn(c, "bottom-2.5 right-2.5 border-b-2 border-r-2 sm:bottom-3 sm:right-3")} />
    </>
  );
}

/** Una línea del feed, como el registro de bajas del juego: tienda ▸ botín ▸ jugador. */
function FeedRow({ p, latest, fresh, now, fade, mobileHidden }: { p: LivePurchase; latest: boolean; fresh: boolean; now: Date; fade: number; mobileHidden?: boolean }) {
  const when = timeAgo(new Date(p.at), now).replace("hace ", "");
  const amount = p.diamonds != null ? num.format(p.diamonds) : null;
  return (
    <li className={cn("lg:flex lg:justify-end", mobileHidden && "max-lg:hidden", fresh && "animate-feed-in")} style={{ opacity: latest ? 1 : fade }}>
      {/* Celular: tarjeta de dos líneas con aire */}
      <div
        className={cn(
          "flex items-center gap-3.5 rounded-[14px] border-l-[3px] px-4 py-3.5 lg:hidden",
          latest ? "border-volt-400 bg-gradient-to-r from-volt-400/20 via-volt-400/[0.07] to-ink-950/40" : "border-white/20 bg-ink-950/55",
        )}
      >
        <span className={cn("grid size-11 shrink-0 place-items-center rounded-[12px] bg-white/[0.06] ring-1 ring-white/10", latest && "bg-volt-400/15 ring-volt-400/30")}>
          {amount ? <Gem className={cn("size-5", gemTone(p.diamonds!))} strokeWidth={2.3} /> : <Users className="size-5 text-violet-300" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-1.5">
            <span className="font-display text-[17px] font-extrabold tabular-nums leading-none">{amount ?? "Cuenta"}</span>
            <span className="text-[12.5px] text-fg-muted">{amount ? "diamantes" : "Free Fire"}</span>
          </span>
          <span className="mt-1.5 block truncate font-mono text-[12px] text-sky-100/70">{p.player ? `ID ${p.player}` : "Jugador verificado"}</span>
        </span>
        <span className="shrink-0 text-right">
          {latest ? (
            <span className="font-display text-[12px] font-black italic tracking-wide text-volt-300">BOOYAH!</span>
          ) : (
            <BadgeCheck className="ml-auto size-4 text-ok-400" aria-label="Entregado" />
          )}
          <span className="mt-1 block text-[11.5px] text-white/60" suppressHydrationWarning>
            {when}
          </span>
        </span>
      </div>

      {/* Escritorio: barra inclinada alineada a la derecha, como el registro del juego */}
      <div
        className={cn(
          "hidden max-w-full -skew-x-[14deg] items-center border-r-[3px] py-1.5 pl-8 pr-3 lg:flex",
          latest ? "border-volt-400 bg-gradient-to-l from-volt-400/25 via-volt-400/10 to-transparent" : "border-white/25 bg-gradient-to-l from-black/70 via-black/45 to-transparent",
        )}
      >
        <div className="flex min-w-0 skew-x-[14deg] items-center gap-2.5 text-[13.5px]">
          {latest && <span className="shrink-0 font-display text-[12px] font-black italic tracking-wide text-volt-300">BOOYAH!</span>}
          <LogoMark className="size-5 shrink-0" />
          <ChevronsRight className="size-3.5 shrink-0 text-white/35" />
          {amount ? (
            <span className="flex shrink-0 items-center gap-1 font-display font-extrabold tabular-nums">
              <Gem className={cn("size-4", gemTone(p.diamonds!))} strokeWidth={2.3} />
              {amount}
            </span>
          ) : (
            <span className="flex shrink-0 items-center gap-1 font-display font-extrabold">
              <Users className="size-4 text-violet-300" /> Cuenta
            </span>
          )}
          <ChevronsRight className="size-3.5 shrink-0 text-white/35" />
          <span className={cn("truncate font-mono font-semibold", latest ? "text-white" : "text-sky-100/85")}>{p.player ? `ID ${p.player}` : "Jugador verificado"}</span>
          <span className="shrink-0 text-[11px] text-white/60" suppressHydrationWarning>
            {when}
          </span>
        </div>
      </div>
    </li>
  );
}

/** Contorno irregular cerrado (costa o curva de nivel); determinista, igual en servidor y navegador. */
function blob(cx: number, cy: number, rx: number, ry: number, seed: number, amp = 1) {
  const pts: string[] = [];
  for (let i = 0; i <= 96; i++) {
    const a = (i / 96) * Math.PI * 2;
    const k = 1 + amp * (0.13 * Math.sin(3 * a + seed) + 0.08 * Math.sin(5 * a + seed * 2.1) + 0.05 * Math.cos(9 * a + seed * 0.7) + 0.03 * Math.sin(14 * a + seed));
    pts.push(`${(cx + Math.cos(a) * rx * k).toFixed(1)},${(cy + Math.sin(a) * ry * k).toFixed(1)}`);
  }
  return `M${pts.join("L")}Z`;
}

// Bermuda (versión dibujada): isla grande, dos islotes, relieve, carreteras y sus lugares conocidos.
const ISLAND = blob(600, 300, 470, 255, 0.8);
const ISLETS = [blob(1105, 95, 42, 30, 2.2, 1.4), blob(140, 520, 36, 24, 3.4, 1.4)];
const RELIEF = [
  ...[150, 105, 62, 28].map((r, i) => blob(560, 250, r * 1.4, r, 1.7 + i * 0.4, 0.8)), // cerro central (Peak)
  ...[95, 60, 30].map((r, i) => blob(860, 360, r * 1.3, r, 4.1 + i * 0.5, 0.9)),
  ...[80, 48].map((r, i) => blob(300, 210, r * 1.3, r, 2.9 + i * 0.5, 0.9)),
];
const ROADS = [
  "M210 330 C300 300 360 360 450 330 S600 250 700 290 S860 360 990 300",
  "M560 90 C540 170 600 220 570 300 S520 430 600 520",
  "M330 160 C420 200 470 160 540 200",
  "M720 420 C800 400 860 450 930 430",
];
const PLACES: Array<[string, number, number]> = [
  ["Rim Nam", 430, 120],
  ["Bimasakti", 690, 105],
  ["Mars Electric", 900, 170],
  ["Hangar", 225, 250],
  ["Clock Tower", 395, 300],
  ["Peak", 560, 245],
  ["Factory", 790, 285],
  ["Pochinok", 300, 420],
  ["Kota Tua", 520, 410],
  ["Mill", 990, 330],
  ["Shipyard", 860, 470],
  ["Cape Town", 190, 380],
];

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
        <radialGradient id="lp-sea" cx="50%" cy="50%" r="75%">
          <stop offset="0" stopColor="#0c2a35" />
          <stop offset="1" stopColor="#081019" />
        </radialGradient>
        <linearGradient id="lp-land" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3d5a35" />
          <stop offset="0.6" stopColor="#2c4430" />
          <stop offset="1" stopColor="#2a3a2e" />
        </linearGradient>
        <mask id="lp-outside">
          <rect width="1200" height="600" fill="#fff" />
          <circle cx={ZONE.cx} cy={ZONE.cy} r={ZONE.r} fill="#000" />
        </mask>
        <pattern id="lp-storm" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
          <rect width="14" height="14" fill="#1d4ed8" fillOpacity="0.07" />
          <rect width="2" height="14" fill="#60a5fa" fillOpacity="0.07" />
        </pattern>
      </defs>
      <rect width="1200" height="600" fill="url(#lp-sea)" />
      {/* Bermuda, traslúcido */}
      <g opacity="0.5">
        {[ISLAND, ...ISLETS].map((d, i) => (
          <g key={i}>
            <path d={d} fill="none" stroke="#7dd3fc" strokeOpacity="0.25" strokeWidth="14" />
            <path d={d} fill="url(#lp-land)" stroke="#e8d9a0" strokeOpacity="0.55" strokeWidth="3" />
          </g>
        ))}
        {RELIEF.map((d, i) => (
          <path key={i} d={d} fill="none" stroke="#d9f99d" strokeOpacity="0.22" strokeWidth="1.3" />
        ))}
        {ROADS.map((d, i) => (
          <path key={i} d={d} fill="none" stroke="#f1f5f9" strokeOpacity="0.28" strokeWidth={i < 2 ? 4 : 2.5} strokeLinecap="round" />
        ))}
        {/* Nombres de lugares solo en pantallas anchas (en celular el mapa se agranda y tapan el texto) */}
        {PLACES.map(([name, x, y]) => (
          <g key={name} className="max-lg:hidden">
            <rect x={x - 4} y={y - 4} width="8" height="8" fill="#f8fafc" fillOpacity="0.7" transform={`rotate(45 ${x} ${y})`} />
            <text x={x} y={y - 12} textAnchor="middle" fill="#f8fafc" fillOpacity="0.7" fontSize="15" fontWeight="700" letterSpacing="1.5" style={{ textTransform: "uppercase", fontFamily: "var(--font-mono)" }}>
              {name}
            </text>
          </g>
        ))}
      </g>
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
    { icon: Zap, value: "Al instante", label: "Entrega" },
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

      <div className="relative grid gap-7 px-5 pb-7 pt-8 sm:gap-7 sm:px-8 sm:py-9 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center lg:gap-10">
        <div>
          <p className="flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-subtle">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-bad-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-bad-400" />
            </span>
            Transmisión en vivo
          </p>
          <h2 id="entregas-en-vivo" className="mt-3 flex flex-wrap items-baseline gap-x-2.5 font-display font-black uppercase italic leading-[0.9] tracking-tight sm:mt-3 sm:block">
            <span className="text-[34px] text-volt-400 drop-shadow-[0_0_24px_rgb(200_240_79/0.35)] sm:text-[52px]">Booyah</span>
            <br className="hidden sm:block" />
            <span className="text-[18px] sm:text-[30px]">en tiempo real</span>
          </h2>
          <p className="mt-2 max-w-[360px] text-[13px] leading-relaxed text-fg-muted sm:mt-3 sm:text-[13.5px]">Recargas reales que ya llegaron al ID del jugador.</p>

          {hud.length > 0 && (
            <dl className={cn("mt-5 grid gap-2.5 sm:mt-6 lg:max-w-[440px]", hud.length === 3 ? "grid-cols-3" : hud.length === 2 ? "grid-cols-2" : "grid-cols-1")}>
              {hud.map(({ icon: Icon, value, label }) => (
                <div key={label} className="-skew-x-[10deg] rounded-[6px] bg-ink-950/60 px-3.5 py-3 ring-1 ring-white/[0.1] backdrop-blur-sm sm:px-3">
                  <div className="flex skew-x-[10deg] flex-col-reverse">
                    <dt className="mt-1.5 flex items-start gap-1 text-[10px] font-medium uppercase leading-tight tracking-[0.05em] text-fg-subtle sm:text-[10.5px]">
                      <Icon className="mt-px size-3 shrink-0 text-volt-300" />
                      {label}
                    </dt>
                    <dd className="whitespace-nowrap font-display text-[15px] font-black italic tabular-nums leading-none min-[400px]:text-[17px] sm:text-[22px]">{value}</dd>
                  </div>
                </div>
              ))}
            </dl>
          )}
        </div>

        {/* Registro de entregas: la más reciente arriba; las anteriores se van apagando como en partida */}
        <div>
          <p className="mb-3.5 flex items-center gap-2 font-mono lg:mb-2.5 lg:justify-end text-[10.5px] font-semibold uppercase tracking-[0.2em] text-fg-subtle">
            Registro de entregas <span className="h-px w-8 bg-white/15" />
          </p>
          <ol className="space-y-2.5 lg:space-y-1.5 lg:overflow-hidden" aria-live="polite">
            {items.map((p, i) => (
              <FeedRow key={p.key} p={p} latest={i === 0} fresh={fresh.has(p.key)} now={now} fade={Math.max(0.35, 1 - i * 0.08)} mobileHidden={i >= 6} />
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
