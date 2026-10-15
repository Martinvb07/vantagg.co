/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { RankEmblem } from "@/components/brand/rank-emblem";
import { Button } from "@/components/ui/button";
import { Container, EmptyState } from "@/components/ui/primitives";
import { smartSearch } from "@/server/search";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Buscar", robots: { index: false, follow: true } };

/** Versión de página del buscador (sin JavaScript o desde enlaces). Usa la misma búsqueda inteligente que la barra superior. */
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const term = q.trim().slice(0, 60);
  const result = await smartSearch(term);

  return (
    <Container className="py-8 sm:py-10">
      <h1 className="text-[28px] font-bold tracking-tight sm:text-[34px]">Buscar</h1>
      <form method="get" role="search" className="mt-5 flex max-w-xl gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
          <input name="q" type="search" defaultValue={term} placeholder="Ej. 520, Heroico, mascotas, Nequi" className="field h-11 pl-9" aria-label="Término de búsqueda" />
        </div>
        <Button type="submit" size="lg">
          Buscar
        </Button>
      </form>

      {term.length < 2 ? (
        <p className="mt-8 text-sm text-fg-muted">Escribe una cantidad de diamantes, un rango, una característica o un medio de pago.</p>
      ) : result.total === 0 ? (
        <div className="mt-10">
          <EmptyState icon={<Search className="size-5" />} title={`Sin resultados para «${term}»`} description="Prueba con una cantidad de diamantes (520), un rango (Heroico) o un medio de pago (Nequi)." />
        </div>
      ) : (
        <div className="mt-8 grid max-w-3xl gap-6">
          {result.groups.map((g) => (
            <section key={g.label}>
              <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-fg-subtle">{g.label}</h2>
              <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-[16px] bg-ink-850 ring-1 ring-white/[0.07]">
                {g.hits.map((h) => (
                  <li key={h.key}>
                    <Link href={h.href} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03]">
                      {h.image ? (
                        <img src={h.image} alt="" className="size-10 rounded-lg object-cover ring-1 ring-white/10" />
                      ) : h.rank && !h.icon ? (
                        <span className="grid size-10 place-items-center rounded-lg bg-white/[0.05]">
                          <RankEmblem rank={h.rank} className="size-7" />
                        </span>
                      ) : null}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-semibold">{h.title}</span>
                        {h.subtitle && <span className="block truncate text-[12.5px] text-fg-subtle">{h.subtitle}</span>}
                      </span>
                      {h.price ? <span className="text-[14px] font-bold tabular-nums">{h.price}</span> : <ArrowRight className="size-4 text-fg-subtle" />}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Container>
  );
}
