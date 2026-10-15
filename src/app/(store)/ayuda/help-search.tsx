"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, CreditCard, Gem, Link2, Package, RotateCcw, Search, ShieldCheck, UserRound, X, type LucideIcon } from "lucide-react";
import { HELP_TOPICS, type FaqItem, type HelpTopic } from "@/content/faq";
import { cn } from "@/lib/utils";

/** Preguntas que se muestran primero, sin búsqueda ni tema elegido. */
const POPULAR = ["pago-pendiente", "donde-esta-mi-id", "cuanto-tarda", "error-de-entrega", "bonus", "como-reembolso"];

const TOPIC_ICON: Record<HelpTopic, { icon: LucideIcon; tone: string }> = {
  recargas: { icon: Gem, tone: "text-sky-300" },
  pagos: { icon: CreditCard, tone: "text-violet-300" },
  pedidos: { icon: Package, tone: "text-warn-400" },
  cuentas: { icon: UserRound, tone: "text-volt-300" },
  reembolsos: { icon: RotateCcw, tone: "text-ok-400" },
  seguridad: { icon: ShieldCheck, tone: "text-bad-400" },
};

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function HelpSearch({ items }: { items: FaqItem[] }) {
  const [q, setQ] = useState("");
  const [topic, setTopic] = useState<HelpTopic | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  // Abre la pregunta enlazada (#id) al cargar o al cambiar el hash.
  useEffect(() => {
    const openFromHash = () => {
      const id = window.location.hash.slice(1);
      if (!id || !items.some((f) => f.id === id)) return;
      setQ("");
      setTopic(null);
      setShowAll(true);
      setOpen(id);
      setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
    };
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, [items]);

  const filtering = q.trim().length > 1 || !!topic;

  const results = useMemo(() => {
    const words = norm(q)
      .split(" ")
      .filter((w) => w.length > 1);
    const found = items.filter((f) => (!topic || f.group === topic) && words.every((w) => norm(`${f.q} ${f.a}`).includes(w)));
    if (filtering || showAll) return found;
    return POPULAR.map((id) => found.find((f) => f.id === id)).filter((f): f is FaqItem => !!f);
  }, [items, q, topic, filtering, showAll]);

  const counts = useMemo(() => Object.fromEntries(HELP_TOPICS.map((t) => [t.id, items.filter((f) => f.group === t.id).length])), [items]);

  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-fg-subtle" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Escribe tu duda: pago pendiente, ID, reembolso…"
          aria-label="Buscar en el centro de ayuda"
          className="h-13 w-full rounded-[14px] border border-white/10 bg-ink-850 pl-12 pr-12 text-[15px] placeholder:text-fg-subtle focus:border-volt-500/60 focus:outline-none"
        />
        {q && (
          <button type="button" onClick={() => setQ("")} aria-label="Limpiar" className="absolute right-3 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-fg-subtle hover:text-fg">
            <X className="size-4" />
          </button>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Temas">
        {HELP_TOPICS.filter((t) => counts[t.id] > 0).map((t) => {
          const { icon: Icon, tone } = TOPIC_ICON[t.id];
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={topic === t.id}
              onClick={() => setTopic(topic === t.id ? null : t.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full py-1.5 pl-2.5 pr-3 text-[12.5px] font-medium transition-colors",
                topic === t.id ? "bg-fg text-ink-950" : "bg-white/[0.06] text-fg-muted hover:text-fg",
              )}
            >
              <Icon className={cn("size-3.5", topic === t.id ? "text-ink-950" : tone)} />
              {t.label} <span className="opacity-55">{counts[t.id]}</span>
            </button>
          );
        })}
      </div>

      <p className="mb-2 mt-6 text-[13px] font-semibold text-fg-muted">
        {filtering ? `${results.length} ${results.length === 1 ? "resultado" : "resultados"}` : showAll ? "Todas las preguntas" : "Preguntas más consultadas"}
      </p>

      <div className="overflow-hidden rounded-[14px] bg-ink-850 ring-1 ring-white/[0.07]">
        {results.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="font-semibold">No encontramos una respuesta para «{q}»</p>
            <p className="mt-1 text-sm text-fg-muted">Escríbenos y un miembro del equipo te responde.</p>
            <a href="#contacto" className="mt-4 inline-flex h-9 items-center rounded-lg bg-volt-400 px-4 text-[13px] font-semibold text-volt-ink">
              Contactar soporte
            </a>
          </div>
        ) : (
          <ul className="divide-y divide-white/[0.06]">
            {results.map((f) => {
              const isOpen = open === f.id;
              return (
                <li key={f.id} id={f.id} className="scroll-mt-28">
                  <button type="button" onClick={() => setOpen(isOpen ? null : f.id)} aria-expanded={isOpen} className="flex w-full items-center gap-4 px-5 py-3.5 text-left hover:bg-white/[0.02]">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14.5px] font-medium">{f.q}</span>
                      {filtering && !topic && <span className="mt-0.5 block text-[11.5px] text-fg-subtle">{HELP_TOPICS.find((t) => t.id === f.group)?.label}</span>}
                    </span>
                    <ChevronDown className={cn("size-4 shrink-0 text-fg-subtle transition-transform", isOpen && "rotate-180")} />
                  </button>
                  {isOpen && (
                    <div className="animate-fade-up px-5 pb-4">
                      <p className="max-w-3xl text-[13.5px] leading-relaxed text-fg-muted">{f.a}</p>
                      <a
                        href={`#${f.id}`}
                        className="mt-2.5 inline-flex items-center gap-1 text-[12px] text-fg-subtle hover:text-fg"
                        onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/ayuda#${f.id}`).catch(() => {})}
                      >
                        <Link2 className="size-3.5" /> Copiar enlace
                      </a>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {!filtering && (
        <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-3 text-[13px] font-medium text-fg-muted underline-offset-4 hover:text-fg hover:underline">
          {showAll ? "Ver menos" : `Ver todas las preguntas (${items.length})`}
        </button>
      )}
    </div>
  );
}
