/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, CircleAlert, Clock, KeyRound, Wallet } from "lucide-react";
import { Gem } from "@/components/brand/gem";
import { TopUpCheckout } from "@/components/checkout/topup-checkout";
import { JsonLd } from "@/components/seo/json-ld";
import { Container, EmptyState } from "@/components/ui/primitives";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { formatMoney } from "@/lib/money";
import { getPackages, getTopupRegions, mainTopupRegion } from "@/server/catalog";
import { publicPaymentOptions } from "@/server/integrations/payments";
import { activeTopUpProvider } from "@/server/integrations/topup";
import { getSettings } from "@/server/settings";
import { BannerSlot } from "@/components/store/banner-slot";
import { parsePaymentMethods } from "@/domain/payment-methods";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Recargar diamantes Free Fire en Colombia",
  description:
    "Compra diamantes de Free Fire con tu ID de jugador y paga en pesos colombianos. Verificación del ID antes de pagar y seguimiento del pedido hasta la entrega.",
  alternates: { canonical: "/recargas" },
};

export default async function RecargasPage({ searchParams }: { searchParams: Promise<{ paquete?: string; id?: string; region?: string }> }) {
  const { paquete, id, region } = await searchParams;
  const [regions, mainRegion, user, settings] = await Promise.all([getTopupRegions(), mainTopupRegion(), getCurrentUser(), getSettings()]);
  // Todas las regiones activas (el cliente elige); si no hay ninguna configurada, la principal.
  const packages = await getPackages({ regions: regions.length ? regions.map((r) => r.slug) : [mainRegion] });
  const initialRegion = regions.find((r) => r.slug === region)?.slug ?? (regions.some((r) => r.slug === mainRegion) ? mainRegion : (regions[0]?.slug ?? mainRegion));
  // Con sesión, se usa el ID de Free Fire guardado en el perfil si el enlace no trae uno.
  const savedId = user && !id ? (await db.user.findUnique({ where: { id: user.id }, select: { ffPlayerId: true } }))?.ffPlayerId : null;
  const methods = parsePaymentMethods(settings.paymentMethods);
  const payments = publicPaymentOptions();
  const topup = activeTopUpProvider();
  // «Desde $X» y datos para buscadores: región principal (la de la mayoría de clientes).
  const prices = packages.filter((p) => p.available && p.region === mainRegion).map((p) => p.quote.price);

  return (
    <>
      {prices.length > 0 && !packages.every((p) => p.isDemo) && (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "Product",
            name: "Diamantes Free Fire",
            description: "Recarga de diamantes de Free Fire por ID de jugador, con pago en pesos colombianos.",
            offers: { "@type": "AggregateOffer", priceCurrency: "COP", lowPrice: Math.min(...prices), highPrice: Math.max(...prices), offerCount: prices.length, url: `${env.appUrl}/recargas` },
          }}
        />
      )}
      <Container className="pb-4 pt-5 lg:pb-14 [body:has([data-paybar])_&]:pb-28 lg:[body:has([data-paybar])_&]:pb-14">
        <nav aria-label="Ruta" className="mb-5 flex items-center gap-1 text-[12.5px] text-fg-subtle">
          <Link href="/" className="hover:text-fg">
            Inicio
          </Link>
          <ChevronRight className="size-3.5" />
          <span className="text-fg-muted">Diamantes Free Fire</span>
        </nav>

        <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)] lg:gap-8">
          {/* Producto (en celular sus bloques se reparten: ficha → compra → ayuda) */}
          <div className="contents lg:sticky lg:top-24 lg:block lg:self-start">
            <div className="flex gap-4 lg:block">
              <div
                className="relative aspect-square w-24 shrink-0 self-start overflow-hidden rounded-[14px] ring-1 ring-white/[0.08] sm:w-32 lg:w-full"
                style={{ background: "radial-gradient(90% 80% at 65% 40%, rgba(90,190,255,.45), transparent 60%), linear-gradient(150deg,#0b3d8c,#06132b)" }}
              >
                {settings.topupCoverUrl ? (
                  <img src={settings.topupCoverUrl} alt="Diamantes Free Fire" className="absolute inset-0 size-full object-cover" />
                ) : (
                  <>
                    <div className="absolute -left-1/4 top-0 h-[160%] w-1/3 rotate-[24deg] bg-white/[0.05]" />
                    <Gem className="absolute left-1/2 top-[54%] w-[58%] -translate-x-1/2 -translate-y-1/2 rotate-[-8deg]" />
                    <Gem className="absolute left-[16%] top-[22%] w-[16%] rotate-[16deg] opacity-80" />
                    <Gem className="absolute right-[12%] top-[70%] w-[14%] rotate-[-20deg] opacity-80" />
                    <span className="absolute left-[7%] top-[7%] hidden rounded-md bg-white/15 px-2 py-0.5 text-[11px] font-bold tracking-[0.16em] text-white backdrop-blur lg:block">FREE FIRE</span>
                  </>
                )}
              </div>
              <div className="min-w-0 lg:mt-5">
                <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">Diamantes Free Fire</h1>
                <p className="mt-1 text-[13.5px] text-fg-muted">
                  Recarga directa a tu ID{prices.length ? ` · desde ${formatMoney(Math.min(...prices))}` : ""}
                </p>
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

            <details className="group rounded-[12px] max-lg:order-2 lg:mt-5 bg-ink-850 ring-1 ring-white/[0.07] [&_summary::-webkit-details-marker]:hidden" open>
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-[14px] font-semibold">
                ¿Dónde está mi ID?
                <ChevronRight className="size-4 text-fg-subtle transition-transform group-open:rotate-90" />
              </summary>
              <ol className="space-y-2.5 px-4 pb-4 text-[13px] text-fg-muted">
                <li className="flex gap-2.5">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-white/[0.08] text-[11px] font-semibold text-fg">1</span>
                  Abre Free Fire y toca tu avatar arriba a la izquierda.
                </li>
                <li className="flex gap-2.5">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-white/[0.08] text-[11px] font-semibold text-fg">2</span>
                  Copia el número que aparece debajo de tu nombre.
                </li>
                <li className="flex gap-2.5">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-white/[0.08] text-[11px] font-semibold text-fg">3</span>
                  Pégalo aquí: verificamos la cuenta y su región antes de que pagues.
                </li>
              </ol>
            </details>

            <BannerSlot slot="TOPUP_SIDE" variant="stack" label="Recordatorio" className="max-lg:order-3 lg:mt-5" />

            <p className="mt-3 hidden items-start gap-2 px-1 text-[12px] leading-relaxed text-fg-subtle lg:flex">
              <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
              Tu pedido se marca como pagado solo cuando la pasarela lo confirma, y como entregado solo cuando el proveedor lo confirma.
            </p>
          </div>

          {/* Compra */}
          <div className="min-w-0 max-lg:order-1 lg:col-start-2 lg:row-start-1">
            {packages.length === 0 ? (
              <EmptyState title="No hay paquetes disponibles" description="El catálogo de recargas se está actualizando. Intenta más tarde." />
            ) : (
              <TopUpCheckout packages={packages} regions={regions} initialRegion={initialRegion} payments={payments} topupEnabled={!!topup} initialSlug={paquete} initialPlayerId={(id ?? savedId ?? undefined)?.slice(0, 12)} defaultEmail={user?.email} methods={methods} />
            )}
          </div>
        </div>
      </Container>
    </>
  );
}
