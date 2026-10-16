"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";
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
      <div key={title} className="animate-fade-in">
        {children}
      </div>
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
  // Al cerrar, el panel se queda un instante para animar la salida.
  const [leaving, setLeaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const close = () => {
    setLeaving(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => (setOpen(false), setLeaving(false)), 140);
  };
  const toggleOpen = () => {
    if (open && !leaving) return close();
    clearTimeout(timer.current);
    setLeaving(false);
    setOpen(true);
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (!open || leaving) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && close();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, leaving]);
  const shown = open && !leaving;
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggleOpen}
        aria-expanded={shown}
        aria-haspopup="dialog"
        className={cn(
          "inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-[10px] border px-3.5 text-[14px] font-medium transition-colors",
          count > 0 || shown ? "border-volt-400/60 bg-volt-400/[0.07]" : "border-white/[0.09] bg-ink-850 hover:border-white/20",
        )}
      >
        <span className="text-fg-muted">{icon}</span>
        {label}
        {count > 0 && <span className="grid min-w-5 place-items-center rounded-full bg-volt-400 px-1 text-[11px] font-bold leading-5 text-volt-ink">{count}</span>}
        <ChevronDown className={cn("size-4 text-fg-subtle transition-transform duration-200", shown && "rotate-180")} />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={label}
          className={cn(
            "absolute top-[calc(100%+8px)] z-40 max-w-[calc(100vw-2rem)]",
            align === "right" ? "right-0 origin-top-right" : "left-0 origin-top-left",
            leaving ? "pointer-events-none animate-pop-out" : "animate-pop-in",
          )}
        >
          {children(close)}
        </div>
      )}
    </div>
  );
}

function CheckRow({ checked, onToggle, icon, label, hint, count }: { checked: boolean; onToggle: () => void; icon?: ReactNode; label: string; hint?: string; count?: number }) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} onClick={onToggle} className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-150 hover:bg-white/[0.04]">
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

/** Rango de precio con dos campos y deslizador doble. `live`: sin botones, aplica al soltar o salir del campo. */
function PriceRange({ min, max, onApply, live = false }: { min: number; max: number; onApply: (min: number, max: number) => void; live?: boolean }) {
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
    return n;
  };
  const setHigh = (v: number) => {
    const n = Math.max(clamp(v), lo + PRICE_STEP);
    setHi(n);
    setHiText(cop.format(n));
    return n;
  };
  const commit = (a = lo, b = hi) => live && (a !== min || b !== max) && onApply(a, b);
  return (
    <div className={cn("space-y-5", !live && "px-4 pb-4 pt-3.5")}>
      <div className="flex items-end gap-2">
        <label className="flex-1">
          <span className="mb-1.5 block text-[13px] font-medium">Desde</span>
          <span className="flex h-10 items-center rounded-[9px] border border-white/10 bg-ink-900 px-2.5 focus-within:border-volt-500/60">
            <span className="text-fg-subtle">$</span>
            <input inputMode="numeric" value={loText} onChange={(e) => setLoText(e.target.value)} onBlur={() => commit(setLow(parseCop(loText)))} onKeyDown={(e) => e.key === "Enter" && commit(setLow(parseCop(loText)))} className="w-full bg-transparent pl-1.5 text-[14px] tabular-nums outline-none" aria-label="Precio mínimo" />
          </span>
        </label>
        <span className="pb-2.5 text-fg-subtle">–</span>
        <label className="flex-1">
          <span className="mb-1.5 block text-[13px] font-medium">Hasta</span>
          <span className="flex h-10 items-center rounded-[9px] border border-white/10 bg-ink-900 px-2.5 focus-within:border-volt-500/60">
            <span className="text-fg-subtle">$</span>
            <input inputMode="numeric" value={hiText} onChange={(e) => setHiText(e.target.value)} onBlur={() => commit(lo, setHigh(parseCop(hiText)))} onKeyDown={(e) => e.key === "Enter" && commit(lo, setHigh(parseCop(hiText)))} className="w-full bg-transparent pl-1.5 text-[14px] tabular-nums outline-none" aria-label="Precio máximo" />
          </span>
        </label>
      </div>
      <div>
        <div className="dual-range relative h-5">
          <div className="absolute top-1/2 h-1.5 w-full -translate-y-1/2 rounded-full bg-white/10" />
          <div className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-volt-400" style={{ left: `${pct(lo)}%`, right: `${100 - pct(hi)}%` }} />
          <input type="range" min={PRICE_MIN} max={PRICE_MAX} step={PRICE_STEP} value={lo} onChange={(e) => setLow(Number(e.target.value))} onPointerUp={() => commit()} onKeyUp={() => commit()} aria-label="Precio mínimo" />
          <input type="range" min={PRICE_MIN} max={PRICE_MAX} step={PRICE_STEP} value={hi} onChange={(e) => setHigh(Number(e.target.value))} onPointerUp={() => commit()} onKeyUp={() => commit()} aria-label="Precio máximo" />
        </div>
        <div className="mt-1.5 flex justify-between text-[12px] tabular-nums text-fg-muted">
          <span>${cop.format(PRICE_MIN)}</span>
          <span>${cop.format(PRICE_MAX)}</span>
        </div>
      </div>
      <div className={cn("flex gap-2", live && "hidden")}>
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

function LevelRange({ min, max, onApply, live = false }: { min: string; max: string; onApply: (min: string, max: string) => void; live?: boolean }) {
  const [lo, setLo] = useState(min);
  const [hi, setHi] = useState(max);
  const commit = (a = lo, b = hi) => live && (a !== min || b !== max) && onApply(a, b);
  return (
    <div className={cn("space-y-4", !live && "px-4 pb-4 pt-3.5")}>
      <div className="flex items-end gap-2">
        {[
          { l: "Desde", v: lo, set: setLo, ph: "1" },
          { l: "Hasta", v: hi, set: setHi, ph: "100" },
        ].map((f) => (
          <label key={f.l} className="flex-1">
            <span className="mb-1.5 block text-[13px] font-medium">{f.l}</span>
            <input inputMode="numeric" value={f.v} placeholder={f.ph} onChange={(e) => f.set(e.target.value.replace(/\D/g, "").slice(0, 3))} onBlur={() => commit()} onKeyDown={(e) => e.key === "Enter" && commit()} className="h-10 w-full rounded-[9px] border border-white/10 bg-ink-900 px-3 text-[14px] tabular-nums outline-none focus:border-volt-500/60" />
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
          <button
            key={a}
            type="button"
            onClick={() => (setLo(a), setHi(b), commit(a, b))}
            className={cn("rounded-full px-2.5 py-1 text-[12px] transition-colors", live && lo === a && hi === b ? "bg-volt-400/15 text-volt-300" : "bg-white/[0.06] text-fg-muted hover:bg-white/10 hover:text-fg")}
          >
            {b ? `${a}–${b}` : `${a}+`}
          </button>
        ))}
      </div>
      <div className={cn("flex gap-2", live && "hidden")}>
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
// Hoja de filtros (celular)
// ---------------------------------------------------------------------

function SheetCard({ title, icon, aside, children }: { title: string; icon: ReactNode; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-[18px] border border-white/[0.07] bg-ink-850 p-4">
      <div className="mb-3.5 flex items-center gap-2">
        <span className="text-fg-muted">{icon}</span>
        <h3 className="flex-1 text-[15px] font-semibold">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Tile({ on, onClick, icon, label, hint }: { on: boolean; onClick: () => void; icon: ReactNode; label: string; hint?: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "relative flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-[14px] border px-1.5 py-3 text-center transition-colors",
        on ? "border-volt-400/70 bg-volt-400/[0.08]" : "border-white/[0.06] bg-ink-800 active:bg-ink-750",
      )}
    >
      <span className={cn("grid size-10 place-items-center rounded-[11px]", on ? "bg-volt-400/10" : "bg-ink-900/70")}>{icon}</span>
      <span className="text-[11.5px] font-medium leading-tight">{label}</span>
      {hint && <span className="-mt-1.5 text-[10.5px] tabular-nums text-fg-subtle">{hint}</span>}
      {on && (
        <span className="absolute right-1.5 top-1.5 grid size-4 place-items-center rounded-full bg-volt-400 text-volt-ink">
          <Check className="size-2.5" strokeWidth={4} />
        </span>
      )}
    </button>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn("rounded-full border px-3.5 py-2 text-[13px] font-medium transition-colors", on ? "border-volt-400/70 bg-volt-400/[0.1] text-volt-300" : "border-white/[0.07] bg-ink-800 text-fg-muted active:bg-ink-750")}
    >
      {children}
    </button>
  );
}

function SwitchRow({ checked, onToggle, label, hint }: { checked: boolean; onToggle: () => void; label: string; hint: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={onToggle} className="flex w-full items-center gap-3 py-2 text-left">
      <span className="min-w-0 flex-1">
        <span className="block text-[14px]">{label}</span>
        <span className="block text-[12px] text-fg-subtle">{hint}</span>
      </span>
      <span className={cn("relative h-6 w-10 shrink-0 rounded-full transition-colors", checked ? "bg-volt-400" : "bg-white/15")}>
        <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform", checked ? "translate-x-[18px]" : "translate-x-0.5")} />
      </span>
    </button>
  );
}

const Clear = ({ onClick }: { onClick: () => void }) => (
  <button type="button" onClick={onClick} className="text-[12.5px] text-fg-muted underline-offset-4 hover:text-fg hover:underline">
    Limpiar
  </button>
);

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
  const [sheetOpen, setSheetOpen] = useState(false);

  // Hoja abierta: la página de atrás no se mueve (mismo enfoque que el menú del celular).
  useEffect(() => {
    if (!sheetOpen) return;
    const root = document.documentElement;
    root.style.overflow = "hidden";
    const blockTouch = (e: TouchEvent) => {
      if (!(e.target as HTMLElement | null)?.closest("#filters-sheet-body")) e.preventDefault();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSheetOpen(false);
    document.addEventListener("touchmove", blockTouch, { passive: false });
    document.addEventListener("keydown", onKey);
    return () => {
      root.style.overflow = "";
      document.removeEventListener("touchmove", blockTouch);
      document.removeEventListener("keydown", onKey);
    };
  }, [sheetOpen]);

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
  const filterCount = servers.length + ranks.length + (priceActive ? 1 : 0) + moreCount;
  const clearSheet = () =>
    set({ servidor: null, rango: null, precio_min: null, precio_max: null, nivel_min: null, nivel_max: null, caract: null, disponibles: null, verificadas: null, orden: null });
  const countLabel = `${total} ${total === 1 ? "cuenta" : "cuentas"}`;

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

        {/* Celular: barra compacta; los filtros se abren en una hoja inferior */}
        <div className="flex items-center gap-2 rounded-[14px] border border-white/[0.08] bg-ink-850 p-1.5 lg:hidden">
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-haspopup="dialog"
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-[10px] border px-3 text-[13.5px] font-medium transition-colors",
              filterCount > 0 ? "border-volt-400/60 bg-volt-400/[0.08]" : "border-white/[0.09] bg-ink-800",
            )}
          >
            <SlidersHorizontal className="size-4 text-fg-muted" />
            Filtros
            {filterCount > 0 && <span className="grid min-w-5 place-items-center rounded-full bg-volt-400 px-1 text-[11px] font-bold leading-5 text-volt-ink">{filterCount}</span>}
          </button>
          <span className="flex min-w-0 flex-1 items-center justify-center gap-1.5 text-[13px] text-fg-subtle">
            {pending && <Loader2 className="size-3.5 animate-spin" />}
            {countLabel}
          </span>
          <div className="flex rounded-[10px] bg-ink-900 p-0.5" role="group" aria-label="Vista">
            {[
              { v: "cuadricula", l: "Tarjetas", icon: LayoutGrid },
              { v: "lista", l: "Lista", icon: List },
            ].map(({ v, l, icon: Icon }) => (
              <button
                key={v}
                type="button"
                onClick={() => set({ vista: v === "lista" ? "lista" : null })}
                aria-pressed={view === v}
                className={cn("inline-flex h-8 items-center gap-1.5 rounded-[8px] px-2.5 text-[12.5px] font-medium transition-colors", view === v ? "bg-ink-700 text-fg shadow-sm" : "text-fg-subtle")}
              >
                <Icon className="size-3.5" />
                {l}
              </button>
            ))}
          </div>
        </div>

        <div className="hidden flex-wrap gap-2 lg:flex">
          {/* Servidor */}
          <Dropdown label="Servidor" icon={<Globe className="size-4" />} count={servers.length}>
            {() => (
              <Panel title="Servidor">
                <div className="scroll-thin max-h-[340px] overflow-y-auto py-1.5">
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
                <div className="scroll-thin max-h-[360px] overflow-y-auto py-1.5">
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
                  <div className="scroll-thin max-h-[320px] overflow-y-auto py-1.5">
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

        <div className="hidden items-center gap-2 lg:flex xl:ml-auto">
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

      <div
        className={cn(
          "-mx-4 flex items-center gap-1.5 overflow-x-auto px-4 text-[12.5px] [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0",
          !facets.popular.length && "hidden lg:flex",
        )}
      >
        {facets.popular.length > 0 && <span className="mr-1 shrink-0 text-fg-subtle">Búsquedas populares:</span>}
        {facets.popular.map((p) => {
          const key = p.kind === "rango" ? "rango" : "caract";
          const on = list(sp.get(key)).includes(p.value);
          return (
            <button
              key={`${p.kind}-${p.value}`}
              type="button"
              onClick={() => toggle(key, p.value)}
              className={cn("shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 transition-colors", on ? "bg-volt-400/15 text-volt-300" : "bg-white/[0.06] text-fg-muted hover:bg-white/10 hover:text-fg")}
            >
              {p.kind === "rango" ? rankLabel(p.value) : p.value}
            </button>
          );
        })}
        <span className="ml-auto hidden items-center gap-3 text-fg-subtle lg:flex">
          {pending && <Loader2 className="size-3.5 animate-spin" />}
          {countLabel}
          {anyActive && (
            <button type="button" onClick={() => start(() => router.push(pathname, { scroll: false }))} className="text-fg-muted underline-offset-4 hover:text-fg hover:underline">
              Limpiar filtros
            </button>
          )}
        </span>
      </div>

      {sheetOpen &&
        createPortal(
          <div className="fixed inset-0 z-[80] lg:hidden" role="dialog" aria-modal="true" aria-label="Filtros">
            <div className="absolute inset-0 animate-fade-in bg-black/60 backdrop-blur-[2px]" onClick={() => setSheetOpen(false)} />
            <div className="absolute inset-x-0 bottom-0 flex max-h-[90dvh] animate-sheet-up flex-col rounded-t-[26px] border-t border-white/[0.08] bg-ink-900 shadow-[var(--shadow-lift)]">
              <div className="relative flex items-center px-5 pb-3 pt-4">
                <span className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-white/15" aria-hidden />
                <h2 className="flex-1 pt-1 text-[19px] font-bold tracking-tight">¿Qué buscas?</h2>
                <button type="button" onClick={() => setSheetOpen(false)} aria-label="Cerrar filtros" className="grid size-9 place-items-center rounded-full bg-white/[0.07] text-fg-muted hover:text-fg">
                  <X className="size-[18px]" />
                </button>
              </div>

              <div id="filters-sheet-body" className="scroll-thin flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 pb-4">
                <SheetCard title="Ordenar por" icon={<ArrowDownUp className="size-4" />}>
                  <div className="flex flex-wrap gap-2">
                    {SORTS.map((s) => (
                      <Chip key={s.v} on={sort === s.v} onClick={() => set({ orden: s.v === "recent" ? null : s.v })}>
                        {s.l}
                      </Chip>
                    ))}
                  </div>
                </SheetCard>

                <SheetCard title="Rango" icon={<Trophy className="size-4" />} aside={ranks.length > 0 && <Clear onClick={() => set({ rango: null })} />}>
                  <div className="grid grid-cols-3 gap-2">
                    {FF_RANKS.map((r) => (
                      <Tile key={r.id} on={ranks.includes(r.id)} onClick={() => toggle("rango", r.id)} icon={<RankEmblem rank={r.id} className="size-8" />} label={r.label} hint={facets.rankCounts[r.id] ? String(facets.rankCounts[r.id]) : undefined} />
                    ))}
                  </div>
                </SheetCard>

                <SheetCard title="Servidor" icon={<Globe className="size-4" />} aside={servers.length > 0 && <Clear onClick={() => set({ servidor: null })} />}>
                  <div className="grid grid-cols-3 gap-2">
                    {FF_REGIONS.map((r) => (
                      <Tile key={r.code} on={servers.includes(r.code)} onClick={() => toggle("servidor", r.code)} icon={<RegionFlag code={r.code} className="h-4 w-6" />} label={r.label} hint={facets.regionCounts[r.code] ? String(facets.regionCounts[r.code]) : undefined} />
                    ))}
                  </div>
                </SheetCard>

                <SheetCard title="Precio (COP)" icon={<CircleDollarSign className="size-4" />} aside={priceActive && <Clear onClick={() => set({ precio_min: null, precio_max: null })} />}>
                  <PriceRange
                    key={`${pMin}-${pMax}`}
                    live
                    min={pMin}
                    max={pMax}
                    onApply={(a, b) => set({ precio_min: a > PRICE_MIN ? String(a) : null, precio_max: b < PRICE_MAX ? String(b) : null })}
                  />
                </SheetCard>

                <SheetCard title="Nivel de cuenta" icon={<TrendingUp className="size-4" />} aside={levelActive && <Clear onClick={() => set({ nivel_min: null, nivel_max: null })} />}>
                  <LevelRange
                    key={`${sp.get("nivel_min")}-${sp.get("nivel_max")}`}
                    live
                    min={sp.get("nivel_min") ?? ""}
                    max={sp.get("nivel_max") ?? ""}
                    onApply={(a, b) => set({ nivel_min: a || null, nivel_max: b || null })}
                  />
                </SheetCard>

                {facets.tags.length > 0 && (
                  <SheetCard title="Características" icon={<Sparkles className="size-4" />} aside={caract.length > 0 && <Clear onClick={() => set({ caract: null })} />}>
                    <div className="flex flex-wrap gap-2">
                      {facets.tags.map((t) => (
                        <Chip key={t} on={caract.includes(t)} onClick={() => toggle("caract", t)}>
                          {t}
                        </Chip>
                      ))}
                    </div>
                  </SheetCard>
                )}

                <SheetCard title="Disponibilidad" icon={<ShieldCheck className="size-4" />}>
                  <div className="-my-1 divide-y divide-white/[0.06]">
                    <SwitchRow checked={sp.get("disponibles") === "1"} onToggle={() => set({ disponibles: sp.get("disponibles") ? null : "1" })} label="Solo disponibles ahora" hint="Oculta las reservadas en otro checkout" />
                    <SwitchRow checked={sp.get("verificadas") === "1"} onToggle={() => set({ verificadas: sp.get("verificadas") ? null : "1" })} label="Solo inventario revisado" hint="Revisadas por el equipo" />
                  </div>
                </SheetCard>
              </div>

              <div className="flex items-center justify-between gap-4 border-t border-white/[0.07] bg-ink-900 px-5 pt-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
                <button type="button" onClick={clearSheet} disabled={filterCount === 0 && sort === "recent"} className="text-[14px] font-semibold underline underline-offset-4 disabled:text-fg-subtle disabled:no-underline">
                  Limpiar
                </button>
                <button type="button" onClick={() => setSheetOpen(false)} className="inline-flex h-12 min-w-[150px] items-center justify-center gap-2 rounded-[14px] bg-volt-400 px-6 text-[15px] font-bold text-volt-ink shadow-[0_10px_30px_-10px_rgb(200_240_79/0.6)] active:bg-volt-500">
                  {pending && <Loader2 className="size-4 animate-spin" />}
                  Ver {countLabel}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
