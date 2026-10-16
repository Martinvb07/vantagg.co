"use client";

/* eslint-disable @next/next/no-img-element */
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, type RefObject } from "react";
import { ArrowRight, ClipboardList, CreditCard, Gem, Globe, LifeBuoy, Loader2, Radar, RotateCcw, Search, Sparkles, Tag, Users, X } from "lucide-react";
import { RankEmblem } from "@/components/brand/rank-emblem";
import { cn } from "@/lib/utils";
import type { SearchHit, SearchIcon, SearchResult } from "@/server/search";

const ICONS: Record<SearchIcon, { icon: typeof Gem; tint: string }> = {
  gem: { icon: Gem, tint: "bg-sky-500/15 text-sky-300" },
  users: { icon: Users, tint: "bg-volt-400/12 text-volt-300" },
  radar: { icon: Radar, tint: "bg-violet-500/15 text-violet-300" },
  list: { icon: ClipboardList, tint: "bg-white/[0.06] text-fg-muted" },
  card: { icon: CreditCard, tint: "bg-pink-500/15 text-pink-300" },
  help: { icon: LifeBuoy, tint: "bg-emerald-500/15 text-emerald-300" },
  refund: { icon: RotateCcw, tint: "bg-warn-400/15 text-warn-400" },
  tag: { icon: Tag, tint: "bg-amber-400/15 text-amber-300" },
  globe: { icon: Globe, tint: "bg-sky-500/15 text-sky-300" },
  sparkles: { icon: Sparkles, tint: "bg-volt-400/12 text-volt-300" },
};

const POPULAR = ["520", "5.600", "Heroico", "Gran Maestro", "Mascotas", "Nequi", "Reembolso"];
const POPULAR_TOPUP = ["100", "520", "1.060", "5.600", "Nequi", "Bonus", "Reembolso"];

function HitIcon({ hit }: { hit: SearchHit }) {
  if (hit.image)
    return <img src={hit.image} alt="" className="size-10 shrink-0 rounded-lg object-cover ring-1 ring-white/10" />;
  if (hit.rank && !hit.icon)
    return (
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-white/[0.05]">
        <RankEmblem rank={hit.rank} className="size-7" />
      </span>
    );
  const { icon: Icon, tint } = ICONS[hit.icon ?? "sparkles"];
  return (
    <span className={cn("grid size-10 shrink-0 place-items-center rounded-lg", tint)}>
      <Icon className="size-[18px]" />
    </span>
  );
}

/**
 * Buscador en vivo: sugiere secciones, paquetes, cuentas, filtros y ayuda mientras
 * se escribe. Flechas para moverse, Enter para abrir, Esc para cerrar.
 */
export function SearchBox({ variant, inputRef, onNavigate, showAccounts = true }: { variant: "desktop" | "mobile"; inputRef?: RefObject<HTMLInputElement | null>; onNavigate?: () => void; showAccounts?: boolean }) {
  const popular = showAccounts ? POPULAR : POPULAR_TOPUP;
  const router = useRouter();
  const listId = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [active, setActive] = useState(0);

  const term = q.trim();
  // Mientras llega la nueva consulta se mantienen los resultados anteriores (sin parpadeo).
  const groups = useMemo(() => (term.length >= 2 ? (result ? result.groups : null) : []), [term, result]);
  const flat = useMemo(() => groups?.flatMap((g) => g.hits) ?? [], [groups]);

  // Consulta con espera corta y cancelación de la anterior.
  useEffect(() => {
    if (term.length < 2) {
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        if (res.ok) setResult((await res.json()) as SearchResult);
      } catch {
        /* cancelada o sin conexión */
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 140);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [term]);

  useEffect(() => setActive(0), [groups]);

  // Cerrar al hacer clic fuera.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const go = (hit: SearchHit | undefined) => {
    if (!hit) return;
    setOpen(false);
    setQ("");
    inputRef?.current?.blur();
    onNavigate?.();
    router.push(hit.href);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (flat.length ? (i + 1) % flat.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (flat.length ? (i - 1 + flat.length) % flat.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(flat[active] ?? flat[0]);
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef?.current?.blur();
    }
  };

  const desktop = variant === "desktop";
  let idx = -1;

  return (
    <div ref={boxRef} role="search" className={cn("group relative", desktop ? "hidden md:block" : "w-full")}>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-fg-subtle transition-colors group-focus-within:text-volt-300" aria-hidden />
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        type="search"
        autoComplete="off"
        spellCheck={false}
        placeholder={desktop ? "Buscar…" : "Diamantes, cuentas, rango, Nequi…"}
        aria-label="Buscar en la tienda"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && flat[active] ? `${listId}-${active}` : undefined}
        className={cn(
          "text-fg placeholder:text-fg-subtle focus:outline-none [&::-webkit-search-cancel-button]:hidden",
          desktop
            ? "h-10 w-48 rounded-full border border-transparent bg-white/[0.05] pl-10 pr-10 text-[13px] transition-[width,border-color,background] duration-300 hover:bg-white/[0.07] focus:w-72 focus:border-volt-400/50 focus:bg-ink-850 xl:w-60"
            : "h-11 w-full rounded-full border border-white/10 bg-ink-850 pl-10 pr-10 text-[14px] focus:border-volt-400/50",
        )}
      />
      {q ? (
        <button
          type="button"
          onClick={() => {
            setQ("");
            inputRef?.current?.focus();
          }}
          aria-label="Borrar búsqueda"
          className="absolute right-2.5 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full text-fg-subtle hover:bg-white/10 hover:text-fg"
        >
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
        </button>
      ) : (
        desktop && (
          <kbd className="pointer-events-none absolute right-3 top-1/2 hidden size-5 xl:grid -translate-y-1/2 place-items-center rounded-md border border-white/10 bg-white/[0.04] font-mono text-[10.5px] text-fg-subtle transition-opacity group-focus-within:opacity-0">
            /
          </kbd>
        )
      )}

      {open && (
        <div
          id={listId}
          role="listbox"
          aria-label="Resultados"
          className={cn(
            "absolute z-50 mt-2 overflow-y-auto overscroll-contain rounded-[18px] bg-ink-850 p-2 shadow-[0_30px_70px_-20px_rgba(0,0,0,0.9)] ring-1 ring-white/10 animate-fade-up",
            // En celular cabe en lo que queda de pantalla bajo el encabezado y se desliza por dentro.
            desktop ? "right-0 max-h-[min(70vh,560px)] w-[440px]" : "inset-x-0 max-h-[calc(100dvh-200px)]",
          )}
        >
          {groups === null ? (
            <p className="flex items-center gap-2 px-3 py-6 text-[13px] text-fg-muted">
              <Loader2 className="size-4 animate-spin" /> Buscando «{term}»…
            </p>
          ) : term.length >= 2 && flat.length === 0 && !loading ? (
            <div className="px-3 py-5">
              <p className="text-[14px] font-semibold">No encontramos «{term}»</p>
              <p className="mt-0.5 text-[12.5px] text-fg-muted">Prueba con una cantidad de diamantes, un rango o un medio de pago.</p>
            </div>
          ) : (
            groups.map((g) => (
              <div key={g.label} className="py-1">
                <p className="px-3 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-subtle">{g.label}</p>
                {g.hits.map((hit) => {
                  idx += 1;
                  const i = idx;
                  const on = i === active;
                  return (
                    <a
                      key={hit.key}
                      id={`${listId}-${i}`}
                      role="option"
                      aria-selected={on}
                      href={hit.href}
                      onMouseEnter={() => setActive(i)}
                      onClick={(e) => {
                        e.preventDefault();
                        go(hit);
                      }}
                      className={cn("flex items-center gap-3 rounded-[12px] px-2.5 py-2 transition-colors", on ? "bg-white/[0.07]" : "hover:bg-white/[0.04]")}
                    >
                      <HitIcon hit={hit} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-[13.5px] font-semibold">{hit.title}</span>
                          {hit.badge && <span className="shrink-0 rounded bg-volt-400/15 px-1.5 py-px text-[10px] font-bold text-volt-300">{hit.badge}</span>}
                          {hit.demo && <span className="shrink-0 rounded border border-amber-400/50 px-1 font-mono text-[9px] text-amber-300">DEMO</span>}
                        </span>
                        {hit.subtitle && <span className="block truncate text-[12px] text-fg-subtle">{hit.subtitle}</span>}
                      </span>
                      {hit.price ? <span className="shrink-0 text-[13px] font-bold tabular-nums">{hit.price}</span> : <ArrowRight className={cn("size-4 shrink-0 text-fg-subtle transition-opacity", on ? "opacity-100" : "opacity-0")} />}
                    </a>
                  );
                })}
              </div>
            ))
          )}

          {(term.length < 2 || flat.length === 0) && (
            // Sin texto: solo unas sugerencias cortas (las secciones ya están en la barra del encabezado).
            <div className={cn("px-2 py-1.5", term.length >= 2 && "border-t border-white/[0.06] pt-3")}>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-subtle">Prueba con</p>
              <div className="flex flex-wrap gap-1.5">
                {popular.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setQ(p);
                      inputRef?.current?.focus();
                    }}
                    className="rounded-full bg-white/[0.06] px-3 py-1.5 text-[12.5px] font-medium text-fg-muted ring-1 ring-white/[0.06] hover:bg-white/10 hover:text-fg"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
