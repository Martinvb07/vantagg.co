import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, CircleAlert, Clock, KeyRound, Wallet } from "lucide-react";
import { TopUpCheckout } from "@/components/checkout/topup-checkout";
import { JsonLd } from "@/components/seo/json-ld";
import { Container, EmptyState } from "@/components/ui/primitives";
import { FindPlayerId } from "@/components/store/find-player-id";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getPackages, getTopupRegions, mainTopupRegion } from "@/server/catalog";
import { publicPaymentOptions } from "@/server/integrations/payments";
import { activeTopUpProvider } from "@/server/integrations/topup";
import { getSettings } from "@/server/settings";
import { isEvoKind } from "@/domain/packs";
import { parsePaymentMethods } from "@/domain/payment-methods";
import { maintenanceNotice } from "@/domain/maintenance";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Fragmentos y cajas Evo de Free Fire",
  description: "Compra fragmentos de arma Evo y cajas de fragmentos Evo de Free Fire con tu ID de jugador. Pago en pesos colombianos y entrega automática.",
  alternates: { canonical: "/fragmentos" },
  openGraph: { images: [{ url: "/brand/fragmentos-evo.webp", width: 960, height: 1044, alt: "Fragmentos Evo: fragmentos y cajas Evo de Free Fire" }] },
};

export default async function ArmasEvoPage({ searchParams }: { searchParams: Promise<{ paquete?: string; id?: string; region?: string }> }) {
  const { paquete, id, region } = await searchParams;
  const [allRegions, mainRegion, user, settings] = await Promise.all([getTopupRegions(), mainTopupRegion(), getCurrentUser(), getSettings()]);
  const all = await getPackages({ regions: allRegions.length ? allRegions.map((r) => r.slug) : [mainRegion] });
  const packages = all.filter((p) => isEvoKind(p.pass));
  // Solo las regiones donde hay fragmentos y cajas Evo (hoy LATAM).
  const counts = new Map<string, number>();
  for (const p of packages) counts.set(p.region, (counts.get(p.region) ?? 0) + 1);
  const regions = allRegions.filter((r) => counts.has(r.slug)).map((r) => ({ ...r, packages: counts.get(r.slug) ?? 0 }));
  const initialRegion = regions.find((r) => r.slug === region)?.slug ?? (regions.some((r) => r.slug === mainRegion) ? mainRegion : (regions[0]?.slug ?? mainRegion));
  const profile = user ? await db.user.findUnique({ where: { id: user.id }, select: { ffPlayerId: true, marketingOptIn: true } }) : null;
  const savedId = !id ? profile?.ffPlayerId : null;
  const paused = maintenanceNotice(settings);
  // Datos para buscadores: solo fragmentos y cajas de la región principal (el acceso Evo de otras regiones no cuenta).
  const stock = packages.filter((p) => p.available && /^evo-(frag|box)-/.test(p.pass ?? ""));
  const prices = (stock.some((p) => p.region === mainRegion) ? stock.filter((p) => p.region === mainRegion) : stock).map((p) => p.quote.price);

  return (
    <>
      {prices.length > 0 && (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "Product",
            name: "Fragmentos y cajas Evo de Free Fire",
            description: "Fragmentos de arma Evo y cajas de fragmentos Evo de Free Fire por ID de jugador, con pago en pesos colombianos.",
            offers: { "@type": "AggregateOffer", priceCurrency: "COP", lowPrice: Math.min(...prices), highPrice: Math.max(...prices), offerCount: prices.length, url: `${env.appUrl}/fragmentos` },
          }}
        />
      )}
      <Container className="pb-4 pt-5 lg:pb-14 [body:has([data-paybar])_&]:pb-28 lg:[body:has([data-paybar])_&]:pb-14">
        <nav aria-label="Ruta" className="mb-5 flex items-center gap-1 text-[12.5px] text-fg-subtle">
          <Link href="/" className="hover:text-fg">
            Inicio
          </Link>
          <ChevronRight className="size-3.5" />
          <span className="text-fg-muted">Fragmentos Evo</span>
        </nav>

        <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)] lg:gap-8">
          <div className="contents lg:sticky lg:top-24 lg:block lg:self-start">
            <div className="flex gap-4 lg:block">
              <div className="relative aspect-square w-24 shrink-0 self-start overflow-hidden rounded-[14px] bg-[#0b0f14] ring-1 ring-white/[0.08] sm:w-32 lg:w-full">
                {/* En el celular se ve pequeña (96 px): se descarga la versión liviana; la grande solo en escritorio. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/brand/fragmentos-evo-720.webp"
                  srcSet="/brand/fragmentos-evo-256.webp 256w, /brand/fragmentos-evo-720.webp 720w"
                  sizes="(min-width: 1024px) 360px, (min-width: 640px) 128px, 96px"
                  alt="Fragmentos Evo: fragmentos y cajas Evo de Free Fire"
                  decoding="async"
                  className="absolute inset-0 size-full object-cover"
                />
              </div>
              <div className="min-w-0 lg:mt-5">
                <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">Fragmentos Evo</h1>
                <p className="mt-1 text-[13.5px] text-fg-muted">Fragmentos y cajas Evo a tu ID</p>
                <ul className="mt-3 flex flex-wrap gap-1.5 text-[12px]">
                  <li className="inline-flex items-center gap-1 rounded-md bg-white/[0.06] px-2 py-1 text-fg-muted">
                    <KeyRound className="size-3.5" /> Sin contraseña
                  </li>
                  <li className="inline-flex items-center gap-1 rounded-md bg-white/[0.06] px-2 py-1 text-fg-muted">
                    <Wallet className="size-3.5" /> Pago en COP
                  </li>
                  <li className="inline-flex items-center gap-1 rounded-md bg-white/[0.06] px-2 py-1 text-fg-muted">
                    <Clock className="size-3.5" /> Entrega automática
                  </li>
                </ul>
              </div>
            </div>

            <FindPlayerId className="max-lg:order-2 lg:mt-5" />

            <p className="mt-3 hidden items-start gap-2 px-1 text-[12px] leading-relaxed text-fg-subtle lg:flex">
              <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
              Tu pedido se marca como pagado solo cuando la pasarela lo confirma, y como entregado solo cuando el proveedor lo confirma.
            </p>
          </div>

          <div className="min-w-0 max-lg:order-1 lg:col-start-2 lg:row-start-1">
            {packages.length === 0 ? (
              <EmptyState title="Pronto" description="Los fragmentos y cajas Evo se están activando. Vuelve en unos minutos." />
            ) : (
              <TopUpCheckout
                packages={packages}
                regions={regions}
                initialRegion={initialRegion}
                payments={publicPaymentOptions()}
                topupEnabled={!!activeTopUpProvider() && !paused}
                pausedNotice={paused}
                askMarketing={!profile?.marketingOptIn}
                initialSlug={paquete}
                initialPlayerId={(id ?? savedId ?? undefined)?.slice(0, 12)}
                defaultEmail={user?.email}
                methods={parsePaymentMethods(settings.paymentMethods)}
              />
            )}
          </div>
        </div>
      </Container>
    </>
  );
}
