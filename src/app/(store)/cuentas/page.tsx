import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { UserSearch } from "lucide-react";
import { AccountGridCard, AccountListRow } from "@/components/store/account-listing";
import { AccountsToolbar } from "@/components/store/accounts-toolbar";
import { Container, EmptyState } from "@/components/ui/primitives";
import { getAccountFacets, getAccounts, type AccountFilters } from "@/server/catalog";
import { FF_RANKS, FF_REGIONS } from "@/domain/freefire";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cuentas Free Fire en venta en Colombia",
  description:
    "Compra cuentas de Free Fire con nivel, rango, skins e inventario publicados. Procedencia revisada antes de publicar y entrega asistida.",
  alternates: { canonical: "/cuentas" },
};

type SP = Record<string, string | undefined>;
const int = (v?: string) => (v && /^\d+$/.test(v) ? Number(v) : undefined);
const SORTS = ["recent", "price_asc", "price_desc", "level_desc"];

export default async function CuentasPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const csv = (v?: string, max = 15) => (v ? v.split(",").map((x) => x.trim().slice(0, 60)).filter(Boolean).slice(0, max) : undefined);
  const filters: AccountFilters = {
    q: sp.q?.slice(0, 60) || undefined,
    minPrice: int(sp.precio_min),
    maxPrice: int(sp.precio_max),
    minLevel: int(sp.nivel_min),
    maxLevel: int(sp.nivel_max),
    regions: csv(sp.servidor)?.filter((c) => FF_REGIONS.some((r) => r.code === c)),
    ranks: csv(sp.rango)?.filter((c) => FF_RANKS.some((r) => r.id === c)),
    tags: csv(sp.caract, 12),
    onlyAvailable: sp.disponibles === "1",
    verifiedOnly: sp.verificadas === "1",
    featuredOnly: sp.destacadas === "1",
    sort: (SORTS.includes(sp.orden ?? "") ? sp.orden : "recent") as AccountFilters["sort"],
  };
  const [accounts, facets] = await Promise.all([getAccounts(filters), getAccountFacets()]);
  const list = sp.vista === "lista";

  return (
    <Container className="py-6 sm:py-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">Compra cuentas de Free Fire</h1>
        {sp.destacadas === "1" && (
          <Link href="/cuentas" className="rounded-full border border-white/10 px-4 py-2 text-[13px] font-medium hover:border-white/20">
            Mostrar todas
          </Link>
        )}
      </div>

      <Suspense>
        <AccountsToolbar facets={facets} total={accounts.length} />
      </Suspense>

      <section aria-live="polite" className="mt-5">
        {accounts.length === 0 ? (
          <EmptyState
            icon={<UserSearch className="size-5" />}
            title="No hay cuentas con esos filtros"
            description="Prueba con otro rango de precio o nivel, o limpia los filtros."
            action={
              <Link href="/cuentas" className="text-sm text-volt-300 underline underline-offset-4">
                Ver todas las cuentas
              </Link>
            }
          />
        ) : list ? (
          <div className="space-y-3">
            {accounts.map((a, i) => (
              <AccountListRow key={a.id} a={a} priority={i < 2} />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {accounts.map((a, i) => (
              <AccountGridCard key={a.id} a={a} priority={i < 4} />
            ))}
          </div>
        )}
      </section>
    </Container>
  );
}
