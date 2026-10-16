import Link from "next/link";
import { ChevronRight, CircleCheck, ClipboardList, CreditCard, Gem as GemIcon, LifeBuoy, Radar, Users } from "lucide-react";
import { JsonLd } from "@/components/seo/json-ld";
import { AccountGridCard } from "@/components/store/account-listing";
import { HeroCarousel } from "@/components/store/hero-carousel";
import { DiamondCover, tierFor } from "@/components/brand/covers";
import { RankEmblem } from "@/components/brand/rank-emblem";
import { ProductTile } from "@/components/store/product-tile";
import { FF_RANKS } from "@/domain/freefire";
import { formatNumber, packageTitle } from "@/lib/money";
import { db } from "@/lib/db";
import { BannerSlot } from "@/components/store/banner-slot";
import { timeAgo } from "@/components/store/time-ago";
import { Container } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { env } from "@/lib/env";
import { accountsVisible, getAccountFacets, getAccounts, getPackages, getRecentDeliveries } from "@/server/catalog";
import { getSettings } from "@/server/settings";
import type { Metadata } from "next";

// Canónica solo en el inicio (antes la heredaban todas las páginas sin canónica propia).
export const metadata: Metadata = { alternates: { canonical: "/" } };

export const dynamic = "force-dynamic";

function RowHead({ title, sub, href, cta }: { title: string; sub?: string; href?: string; cta?: string }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4 sm:mb-5">
      <div>
        <h2 className="text-[20px] font-extrabold leading-tight tracking-tight sm:text-[26px]">{title}</h2>
        {sub && <p className="mt-0.5 text-[13px] text-fg-subtle">{sub}</p>}
      </div>
      {href && (
        <Link href={href} className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full bg-white/[0.05] pl-3.5 pr-2.5 text-[13px] font-medium text-fg-muted ring-1 ring-white/[0.08] hover:bg-white/10 hover:text-fg">
          {cta ?? "Ver todo"} <ChevronRight className="size-4" />
        </Link>
      )}
    </div>
  );
}

const SHORTCUTS = [
  { href: "/recargas", icon: GemIcon, label: "Diamantes" },
  { href: "/cuentas", icon: Users, label: "Cuentas" },
  { href: "/pedido", icon: Radar, label: "Rastrear pedido" },
  { href: "/cuenta", icon: ClipboardList, label: "Mis pedidos" },
  { href: "/medios-de-pago", icon: CreditCard, label: "Medios de pago" },
  { href: "/ayuda", icon: LifeBuoy, label: "Ayuda" },
];

export default async function HomePage() {
  const [packages, accounts, recent, settings, facets, heroBanners] = await Promise.all([getPackages(), getAccounts({ onlyAvailable: false, take: 12 }), getRecentDeliveries(12), getSettings(), getAccountFacets(), db.promoBanner.findMany({ where: { placement: "TOP", active: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true, title: true, imageUrl: true, imageMobileUrl: true, href: true } }).catch(() => [])]);
  const showAccounts = await accountsVisible();
  const visibleAccounts = showAccounts ? accounts.filter((a) => a.available || a.reservedTemporarily) : [];
  const shortcuts = showAccounts ? SHORTCUTS : SHORTCUTS.filter((s) => s.href !== "/cuentas");
  const bonusPct = packages[0]?.diamonds ? Math.round((packages[0].bonusDiamonds / packages[0].diamonds) * 100) : 0;
  const now = new Date();
  const rankChips = [...FF_RANKS].reverse().filter((r) => facets.rankCounts[r.id]);

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Organization",
          name: settings.legalName || settings.storeName,
          url: env.appUrl,
          ...(settings.instagram ? { sameAs: [settings.instagram] } : {}),
          ...(settings.supportEmail ? { email: settings.supportEmail } : {}),
        }}
      />
      <h1 className="sr-only">{showAccounts ? "Diamantes y cuentas de Free Fire en Colombia" : "Recarga de diamantes de Free Fire en Colombia"}</h1>

      <Container className="space-y-8 pb-2 pt-4 sm:space-y-12 sm:pb-6 sm:pt-7">
        <div className="space-y-5">
          {heroBanners.length > 0 && <HeroCarousel banners={heroBanners} />}

          {/* Accesos rápidos */}
          {/* Celular: fila deslizable de íconos tipo app. Escritorio: rejilla de tarjetas. */}
          <nav
            aria-label="Accesos rápidos"
            className={cn(
              "-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:gap-3 sm:overflow-visible sm:px-0 sm:pb-0",
              shortcuts.length === 6 ? "sm:grid-cols-6" : "sm:grid-cols-5",
            )}
          >
            {shortcuts.map(({ href, icon: Icon, label }) => (
              <Link
                key={label}
                href={href}
                className="group flex w-[76px] shrink-0 snap-start flex-col items-center gap-2 text-center sm:w-auto sm:justify-center sm:rounded-[14px] sm:bg-ink-850 sm:px-2 sm:py-4 sm:ring-1 sm:ring-white/[0.06] sm:transition sm:hover:bg-ink-800 sm:hover:ring-white/15"
              >
                <span className="grid size-14 place-items-center rounded-[18px] bg-gradient-to-b from-ink-750 to-ink-850 shadow-[0_1px_0_0_rgb(255_255_255/0.06)_inset] ring-1 ring-white/[0.07] transition active:scale-95 sm:size-auto sm:bg-none sm:shadow-none sm:ring-0">
                  <Icon className="size-6 text-volt-300 transition-transform group-hover:-translate-y-0.5" strokeWidth={2.2} />
                </span>
                <span className="text-[12px] font-medium leading-tight text-fg-muted sm:text-[13px] sm:text-fg">{label}</span>
              </Link>
            ))}
          </nav>
        </div>

        {/* Recargas */}
        {packages.length > 0 && (
          <section id="diamantes" className="scroll-mt-24">
            <RowHead title="Recargas de diamantes" sub={bonusPct ? `Todos con +${bonusPct}% de bonus · precio final en pesos` : "Precio final en pesos"} href="/recargas" cta="Ver todo" />
            <div className="grid grid-cols-2 gap-x-3 gap-y-5 min-[480px]:grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 lg:gap-x-4">
              {packages.map((p) => (
                <ProductTile
                  key={p.id}
                  href={`/recargas?paquete=${p.slug}`}
                  cover={<DiamondCover tier={tierFor(p.diamonds)} diamonds={p.diamonds} bonus={p.bonusDiamonds} />}
                  title={packageTitle(p.diamonds, p.bonusDiamonds)}
                  meta={`Recibes ${formatNumber(p.diamonds + p.bonusDiamonds)} diamantes`}
                  price={p.quote.price}
                  original={p.quote.original}
                  currency={p.currency}
                  label={p.label}
                  isDemo={p.isDemo}
                  disabled={!p.available}
                />
              ))}
            </div>
          </section>
        )}

        {/* Entregas recientes (solo pedidos reales) */}
        {recent.length > 0 && (
          <section aria-label="Entregas recientes" className="-mt-4 rounded-full bg-ink-850 ring-1 ring-white/[0.06] sm:-mt-6">
            <div className="flex items-center gap-4 overflow-hidden px-5 py-3">
              <span className="flex shrink-0 items-center gap-2 text-[12.5px] font-semibold">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-ok-400 opacity-60" />
                  <span className="relative inline-flex size-2 rounded-full bg-ok-400" />
                </span>
                Entregados recientemente
              </span>
              <ul className="flex min-w-0 gap-6 overflow-x-auto text-[12.5px] text-fg-muted [scrollbar-width:none]">
                {recent.map((r) => (
                  <li key={r.id} className="flex shrink-0 items-center gap-1.5">
                    <CircleCheck className="size-3.5 text-ok-400" />
                    <span className="text-fg">{r.name}</span>
                    {r.player && <span className="font-mono">{r.player}</span>}
                    <span>· {timeAgo(r.at, now)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        <BannerSlot slot="HOME_TRUST" variant="wide" label="Cómo comprar" />

        {/* Cuentas */}
        {visibleAccounts.length > 0 && (
          <section>
            <RowHead title="Cuentas destacadas" sub="Cada cuenta es única · procedencia revisada antes de publicar" href="/cuentas" cta="Ver catálogo" />
            {rankChips.length > 1 && (
              <nav aria-label="Cuentas por rango" className="-mx-1 mb-5 flex gap-2 overflow-x-auto px-1 py-1 [scrollbar-width:none]">
                {rankChips.map((r) => (
                  <Link
                    key={r.id}
                    href={`/cuentas?rango=${r.id}`}
                    className="group flex h-11 shrink-0 items-center gap-2 rounded-full bg-ink-850 pl-1.5 pr-3.5 text-[13.5px] font-semibold ring-1 ring-white/[0.08] transition hover:bg-ink-800 hover:ring-white/20"
                  >
                    <span className="grid size-8 place-items-center rounded-full bg-white/[0.05]">
                      <RankEmblem rank={r.id} className="size-6 transition-transform group-hover:scale-110" />
                    </span>
                    {r.label}
                    <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-fg-subtle">{facets.rankCounts[r.id]}</span>
                  </Link>
                ))}
              </nav>
            )}
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {visibleAccounts.slice(0, 3).map((a) => (
                <AccountGridCard key={a.id} a={a} />
              ))}
            </div>
          </section>
        )}

        <BannerSlot slot="HOME_BOTTOM" variant="wide" label="Compra con confianza" />
      </Container>
    </>
  );
}
