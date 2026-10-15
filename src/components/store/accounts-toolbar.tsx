"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { ArrowDownUp, ArrowLeft, Check, ChevronDown, ChevronRight, CircleDollarSign, Globe, LayoutGrid, List, Loader2, Search, ShieldCheck, SlidersHorizontal, Sparkles, Trophy, TrendingUp, X } from "lucide-react";
import { RankEmblem } from "@/components/brand/rank-emblem";
import { RegionFlag } from "@/components/brand/region-flag";
import { FF_RANKS, FF_REGIONS, PRICE_MAX, PRICE_MIN, PRICE_STEP, rankLabel } from "@/domain/freefire";
import { cn } from "@/lib/utils";
import type { AccountFacets } from "@/server/catalog";

const SORTS = [
  { v: "recent", l: "Recomendado" },
  { v: "price_asc", l: "Precio: menor a mayor" },
  { v: "price_desc", l: "Precio: mayor a menor" },
  { v: "level_desc", l: "Nivel más alto" },
];

const cop = new Intl.NumberFormat("es-CO");
const parseCop = (v: string) => Number(v.replace(/\D/g, "")) || 0;
const list = (v: string | null) => (v ? v.split(",").filter(Boolean) : []);

// ---------------------------------------------------------------------
// Piezas visuales
// ---------------------------------------------------------------------

function Box({ checked }: { checked: boolean }) {
  return (
    <span className={cn("grid size-[18px] shrink-0 place-items-center rounded-[5px] border transition-colors", checked ? "border-volt-400 bg-volt-400 text-volt-ink" : "border-white/20 bg-ink-900")}>
      {checked && <Check className="size-3" strokeWidth={3.5} />}
    </span>
  );
}

function Panel({ title, onBack, children, width = "w-[300px]" }: { title: string; onBack?: () => void; children: ReactNode; width?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-[14px] border border-white/10 bg-ink-800 shadow-[var(--shadow-lift)]", width)}>
      <div className="flex items-center gap-2 border-b border-white/[0.07] px-4 py-3">
        {onBack && (
          <button type="button" onClick={onBack} className="-ml-1 grid size-7 place-items-center rounded-md text-fg-muted hover:bg-white/5 hover:text-fg" aria-label="Volver">
            <ArrowLeft className="size-4" />
          </button>
        )}
        <p className={cn("flex-1 text-[15px] font-semibold", !onBack && "text-center")}>{title}</p>
      </div>
      {children}
    </div>
  );
}

function Dropdown({
  label,
  icon,
  count = 0,
  align = "left",
  children,
}: {
  label: string;
  icon: ReactNode;
  count?: number;
  align?: "left" | "right";
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn(
          "inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-[10px] border px-3.5 text-[14px] font-medium transition-colors",
          count > 0 || open ? "border-volt-400/60 bg-volt-400/[0.07]" : "border-white/[0.09] bg-ink-850 hover:border-white/20",
        )}
      >
        <span className="text-fg-muted">{icon}</span>
        {label}
        {count > 0 && <span className="grid min-w-5 place-items-center rounded-full bg-volt-400 px-1 text-[11px] font-bold leading-5 text-volt-ink">{count}</span>}
        <ChevronDown className={cn("size-4 text-fg-subtle transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div role="dialog" aria-label={label} className={cn("absolute top-[calc(100%+8px)] z-40 max-w-[calc(100vw-2rem)]", align === "right" ? "right-0" : "left-0")}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

function CheckRow({ checked, onToggle, icon, label, hint, count }: { checked: boolean; onToggle: () => void; icon?: ReactNode; label: string; hint?: string; count?: number }) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} onClick={onToggle} className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-white/[0.04]">
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px]">{label}</span>
        {hint && <span className="block text-[11.5px] text-fg-subtle">{hint}</span>}
      </span>
      {count != null && count > 0 && <span className="text-[12px] tabular-nums text-fg-subtle">{count}</span>}
      <Box checked={checked} />
    </button>
  );
}

/** Rango de precio con dos campos y deslizador doble. */
function PriceRange({ min, max, onApply }: { min: number; max: number; onApply: (min: number, max: number) => void }) {
  const [lo, setLo] = useState(min);
  const [hi, setHi] = useState(max);
  const [loText, setLoText] = useState(cop.format(min));
  const [hiText, setHiText] = useState(cop.format(max));
  const clamp = (v: number) => Math.min(PRICE_MAX, Math.max(PRICE_MIN, v));
  const pct = (v: number) => ((v - PRICE_MIN) / (PRICE_MAX - PRICE_MIN)) * 100;
  const setLow = (v: number) => {
    const n = Math.min(clamp(v), hi - PRICE_STEP);
    setLo(n);
    setLoText(cop.format(n));
  };
  const setHigh = (v: number) => {
    const n = Math.max(clamp(v), lo + PRICE_STEP);
    setHi(n);
    setHiText(cop.format(n));
  };
  return (
    <div className="space-y-5 px-4 pb-4 pt-3.5">
      <div className="flex items-end gap-2">
        <label className="flex-1">
          <span className="mb-1.5 block text-[13px] font-medium">Desde</span>
          <span className="flex h-10 items-center rounded-[9px] border border-white/10 bg-ink-900 px-2.5 focus-within:border-volt-500/60">
            <span className="text-fg-subtle">$</span>
            <input inputMode="numeric" value={loText} onChange={(e) => setLoText(e.target.value)} onBlur={() => setLow(parseCop(loText))} onKeyDown={(e) => e.key === "Enter" && setLow(parseCop(loText))} className="w-full bg-transparent pl-1.5 text-[14px] tabular-nums outline-none" aria-label="Precio mínimo" />
          </span>
        </label>
        <span className="pb-2.5 text-fg-subtle">–</span>
        <label className="flex-1">
          <span className="mb-1.5 block text-[13px] font-medium">Hasta</span>
          <span className="flex h-10 items-center rounded-[9px] border border-white/10 bg-ink-900 px-2.5 focus-within:border-volt-500/60">
            <span className="text-fg-subtle">$</span>
            <input inputMode="numeric" value={hiText} onChange={(e) => setHiText(e.target.value)} onBlur={() => setHigh(parseCop(hiText))} onKeyDown={(e) => e.key === "Enter" && setHigh(parseCop(hiText))} className="w-full bg-transparent pl-1.5 text-[14px] tabular-nums outline-none" aria-label="Precio máximo" />
          </span>
        </label>
      </div>
      <div>
        <div className="dual-range relative h-5">
          <div className="absolute top-1/2 h-1.5 w-full -translate-y-1/2 rounded-full bg-white/10" />
          <div className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-volt-400" style={{ left: `${pct(lo)}%`, right: `${100 - pct(hi)}%` }} />
          <input type="range" min={PRICE_MIN} max={PRICE_MAX} step={PRICE_STEP} value={lo} onChange={(e) => setLow(Number(e.target.value))} aria-label="Precio mínimo" />
          <input type="range" min={PRICE_MIN} max={PRICE_MAX} step={PRICE_STEP} value={hi} onChange={(e) => setHigh(Number(e.target.value))} aria-label="Precio máximo" />
        </div>
        <div className="mt-1.5 flex justify-between text-[12px] tabular-nums text-fg-muted">
          <span>${cop.format(PRICE_MIN)}</span>
          <span>${cop.format(PRICE_MAX)}</span>
        </div>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={() => onApply(PRICE_MIN, PRICE_MAX)} className="h-9 flex-1 rounded-lg border border-white/10 text-[13px] font-medium hover:border-white/20">
          Restablecer
        </button>
        <button type="button" onClick={() => onApply(lo, hi)} className="h-9 flex-1 rounded-lg bg-volt-400 text-[13px] font-semibold text-volt-ink hover:bg-volt-300">
          Aplicar
        </button>
      </div>
    </div>
  );
}

function LevelRange({ min, max, onApply }: { min: string; max: string; onApply: (min: string, max: string) => void }) {
  const [lo, setLo] = useState(min);
  const [hi, setHi] = useState(max);
  return (
    <div className="space-y-4 px-4 pb-4 pt-3.5">
      <div className="flex items-end gap-2">
        {[
          { l: "Desde", v: lo, set: setLo, ph: "1" },
          { l: "Hasta", v: hi, set: setHi, ph: "100" },
        ].map((f) => (
          <label key={f.l} className="flex-1">
            <span className="mb-1.5 block text-[13px] font-medium">{f.l}</span>
            <input inputMode="numeric" value={f.v} placeholder={f.ph} onChange={(e) => f.set(e.target.value.replace(/\D/g, "").slice(0, 3))} className="h-10 w-full rounded-[9px] border border-white/10 bg-ink-900 px-3 text-[14px] tabular-nums outline-none focus:border-volt-500/60" />
          </label>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {[
          ["1", "30"],
          ["31", "50"],
          ["51", "70"],
          ["71", ""],
        ].map(([a, b]) => (
          <button key={a} type="button" onClick={() => (setLo(a), setHi(b))} className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[12px] text-fg-muted hover:bg-white/10 hover:text-fg">
            {b ? `${a}–${b}` : `${a}+`}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={() => onApply("", "")} className="h-9 flex-1 rounded-lg border border-white/10 text-[13px] font-medium hover:border-white/20">
          Restablecer
        </button>
        <button type="button" onClick={() => onApply(lo, hi)} className="h-9 flex-1 rounded-lg bg-volt-400 text-[13px] font-semibold text-volt-ink hover:bg-volt-300">
          Aplicar
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Barra de filtros
// ---------------------------------------------------------------------

export function AccountsToolbar({ facets, total }: { facets: AccountFacets; total: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [moreView, setMoreView] = useState<"menu" | "nivel" | "caract" | "estado">("menu");

  const set = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    start(() => router.push(`${pathname}${next.toString() ? `?${next}` : ""}`, { scroll: false }));
  };
  const toggle = (key: string, value: string) => {
    const cur = list(sp.get(key));
    const next = cur.includes(value) ? cur.filter((x) => x !== value) : [...cur, value];
    set({ [key]: next.join(",") || null });
  };

  const servers = list(sp.get("servidor"));
  const ranks = list(sp.get("rango"));
  const caract = list(sp.get("caract"));
  const pMin = Number(sp.get("precio_min")) || PRICE_MIN;
  const pMax = Number(sp.get("precio_max")) || PRICE_MAX;
  const priceActive = !!(sp.get("precio_min") || sp.get("precio_max"));
  const levelActive = !!(sp.get("nivel_min") || sp.get("nivel_max"));
  const moreCount = (levelActive ? 1 : 0) + caract.length + (sp.get("disponibles") ? 1 : 0) + (sp.get("verificadas") ? 1 : 0);
  const view = sp.get("vista") === "lista" ? "lista" : "cuadricula";
  const sort = SORTS.find((s) => s.v === sp.get("orden"))?.v ?? "recent";
  const anyActive = ["q", "servidor", "rango", "precio_min", "precio_max", "nivel_min", "nivel_max", "caract", "disponibles", "verificadas", "destacadas"].some((k) => sp.get(k));

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center">
        <form
          role="search"
          className="relative xl:w-[280px]"
          onSubmit={(e) => {
            e.preventDefault();
            set({ q: q.trim().slice(0, 60) || null });
          }}
        >
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar…"
            aria-label="Buscar cuentas"
            className="h-11 w-full rounded-[10px] border border-white/[0.09] bg-ink-850 pl-10 pr-9 text-[14px] placeholder:text-fg-subtle focus:border-volt-500/60 focus:outline-none"
          />
          {q && (
            <button
              type="button"
              onClick={() => {
                setQ("");
                set({ q: null });
              }}
              aria-label="Limpiar búsqueda"
              className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-fg-subtle hover:text-fg"
            >
              <X className="size-4" />
            </button>
          )}
        </form>

        <div className="flex flex-wrap gap-2">
          {/* Servidor */}
          <Dropdown label="Servidor" icon={<Globe className="size-4" />} count={servers.length}>
            {() => (
              <Panel title="Servidor">
                <div className="max-h-[340px] overflow-y-auto py-1.5">
                  {FF_REGIONS.map((r) => (
                    <CheckRow
                      key={r.code}
                      checked={servers.includes(r.code)}
                      onToggle={() => toggle("servidor", r.code)}
                      icon={<RegionFlag code={r.code} />}
                      label={r.label}
                      hint={r.code}
                      count={facets.regionCounts[r.code]}
                    />
                  ))}
                </div>
              </Panel>
            )}
          </Dropdown>

          {/* Rango */}
          <Dropdown label="Rango" icon={<Trophy className="size-4" />} count={ranks.length}>
            {() => (
              <Panel title="Rango" width="w-[280px]">
                <div className="max-h-[360px] overflow-y-auto py-1.5">
                  {FF_RANKS.map((r) => (
                    <CheckRow key={r.id} checked={ranks.includes(r.id)} onToggle={() => toggle("rango", r.id)} icon={<RankEmblem rank={r.id} className="size-8" />} label={r.label} count={facets.rankCounts[r.id]} />
                  ))}
                </div>
              </Panel>
            )}
          </Dropdown>

          {/* Precio */}
          <Dropdown label="Precio" icon={<CircleDollarSign className="size-4" />} count={priceActive ? 1 : 0}>
            {(close) => (
              <Panel title="Precio (COP)" width="w-[330px]">
                <PriceRange
                  min={pMin}
                  max={pMax}
                  onApply={(a, b) => {
                    set({ precio_min: a > PRICE_MIN ? String(a) : null, precio_max: b < PRICE_MAX ? String(b) : null });
                    close();
                  }}
                />
              </Panel>
            )}
          </Dropdown>

          {/* Más filtros */}
          <Dropdown label="Más filtros" icon={<SlidersHorizontal className="size-4" />} count={moreCount}>
            {(close) =>
              moreView === "menu" ? (
                <Panel title="Más filtros">
                  <div className="py-1.5">
                    {[
                      { k: "nivel" as const, icon: TrendingUp, l: "Nivel de cuenta", on: levelActive },
                      ...(facets.tags.length ? [{ k: "caract" as const, icon: Sparkles, l: "Características", on: caract.length > 0 }] : []),
                      { k: "estado" as const, icon: ShieldCheck, l: "Disponibilidad", on: !!(sp.get("disponibles") || sp.get("verificadas")) },
                    ].map(({ k, icon: Icon, l, on }) => (
                      <button key={k} type="button" onClick={() => setMoreView(k)} className="flex w-full items-center gap-3 px-4 py-3 text-left text-[14.5px] hover:bg-white/[0.04]">
                        <Icon className="size-[18px] text-fg-muted" />
                        <span className="flex-1">{l}</span>
                        {on && <span className="size-1.5 rounded-full bg-volt-400" />}
                        <ChevronRight className="size-4 text-fg-subtle" />
                      </button>
                    ))}
                  </div>
                </Panel>
              ) : moreView === "nivel" ? (
                <Panel title="Nivel de cuenta" onBack={() => setMoreView("menu")}>
                  <LevelRange
                    min={sp.get("nivel_min") ?? ""}
                    max={sp.get("nivel_max") ?? ""}
                    onApply={(a, b) => {
                      set({ nivel_min: a || null, nivel_max: b || null });
                      setMoreView("menu");
                      close();
                    }}
                  />
                </Panel>
              ) : moreView === "caract" ? (
                <Panel title="Características" onBack={() => setMoreView("menu")}>
                  <div className="max-h-[320px] overflow-y-auto py-1.5">
                    {facets.tags.map((t) => (
                      <CheckRow key={t} checked={caract.includes(t)} onToggle={() => toggle("caract", t)} label={t} count={facets.tagCounts[t]} />
                    ))}
                  </div>
                </Panel>
              ) : (
                <Panel title="Disponibilidad" onBack={() => setMoreView("menu")}>
                  <div className="py-1.5">
                    <CheckRow checked={sp.get("disponibles") === "1"} onToggle={() => set({ disponibles: sp.get("disponibles") ? null : "1" })} label="Solo disponibles ahora" hint="Oculta las reservadas en otro checkout" />
                    <CheckRow checked={sp.get("verificadas") === "1"} onToggle={() => set({ verificadas: sp.get("verificadas") ? null : "1" })} label="Solo inventario revisado" hint="Revisadas por el equipo" />
                  </div>
                </Panel>
              )
            }
          </Dropdown>
        </div>

        <div className="flex items-center gap-2 xl:ml-auto">
          <Dropdown label={SORTS.find((s) => s.v === sort)!.l} icon={<ArrowDownUp className="size-4" />} align="right">
            {(close) => (
              <Panel title="Ordenar por" width="w-[250px]">
                <div className="py-1.5">
                  {SORTS.map((s) => (
                    <button
                      key={s.v}
                      type="button"
                      onClick={() => (set({ orden: s.v === "recent" ? null : s.v }), close())}
                      className={cn("flex w-full items-center justify-between px-4 py-2.5 text-left text-[14px] hover:bg-white/[0.04]", sort === s.v && "text-volt-300")}
                    >
                      {s.l}
                      {sort === s.v && <Check className="size-4" />}
                    </button>
                  ))}
                </div>
              </Panel>
            )}
          </Dropdown>
          <div className="flex rounded-[10px] border border-white/[0.09] bg-ink-850 p-1" role="group" aria-label="Vista">
            <button type="button" onClick={() => set({ vista: null })} aria-pressed={view === "cuadricula"} aria-label="Vista en cuadrícula" className={cn("grid size-9 place-items-center rounded-md", view === "cuadricula" ? "bg-white/10 text-fg" : "text-fg-subtle hover:text-fg")}>
              <LayoutGrid className="size-4" />
            </button>
            <button type="button" onClick={() => set({ vista: "lista" })} aria-pressed={view === "lista"} aria-label="Vista en lista" className={cn("grid size-9 place-items-center rounded-md", view === "lista" ? "bg-white/10 text-fg" : "text-fg-subtle hover:text-fg")}>
              <List className="size-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-[12.5px]">
        {facets.popular.length > 0 && <span className="mr-1 text-fg-subtle">Búsquedas populares:</span>}
        {facets.popular.map((p) => {
          const key = p.kind === "rango" ? "rango" : "caract";
          const on = list(sp.get(key)).includes(p.value);
          return (
            <button
              key={`${p.kind}-${p.value}`}
              type="button"
              onClick={() => toggle(key, p.value)}
              className={cn("rounded-full px-2.5 py-1 transition-colors", on ? "bg-volt-400/15 text-volt-300" : "bg-white/[0.06] text-fg-muted hover:bg-white/10 hover:text-fg")}
            >
              {p.kind === "rango" ? rankLabel(p.value) : p.value}
            </button>
          );
        })}
        <span className="ml-auto flex items-center gap-3 text-fg-subtle">
          {pending && <Loader2 className="size-3.5 animate-spin" />}
          {total} {total === 1 ? "cuenta" : "cuentas"}
          {anyActive && (
            <button type="button" onClick={() => start(() => router.push(pathname, { scroll: false }))} className="text-fg-muted underline-offset-4 hover:text-fg hover:underline">
              Limpiar filtros
            </button>
          )}
        </span>
      </div>
    </div>
  );
}
