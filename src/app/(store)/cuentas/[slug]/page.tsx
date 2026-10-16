import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, Box, ChevronRight, CircleDashed, Clock, Globe, Info, Layers, Mail, MailCheck, PackageCheck, ShieldCheck, Swords, Trophy } from "lucide-react";
import { AccountGridCard } from "@/components/store/account-listing";
import { BannerSlot } from "@/components/store/banner-slot";
import { AddToCartButton } from "@/components/store/cart-button";
import { Gallery } from "@/components/store/gallery";
import { JsonLd } from "@/components/seo/json-ld";
import { LinkButton } from "@/components/ui/button";
import { Price } from "@/components/ui/price";
import { Alert, Container, DemoBadge } from "@/components/ui/primitives";
import { ProductLabelTag } from "@/components/ui/status";
import { env } from "@/lib/env";
import { formatDate, formatNumber } from "@/lib/money";
import { rankLabel, regionInfo } from "@/domain/freefire";
import { RankEmblem } from "@/components/brand/rank-emblem";
import { RegionFlag } from "@/components/brand/region-flag";
import { getAccountBySlug, getRelatedAccounts } from "@/server/catalog";
import { ClaimForm } from "./claim-form";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const a = await getAccountBySlug(slug);
  if (!a) return { title: "Cuenta no encontrada" };
  const description = `${a.title}. Nivel ${a.level ?? "—"}, ${a.skinsCount ?? "—"} skins, rango ${rankLabel(a.rank) ?? "—"}. ${a.description.slice(0, 110)}`;
  return {
    title: a.title,
    description,
    alternates: { canonical: `/cuentas/${a.slug}` },
    openGraph: { title: a.title, description, images: a.images[0] ? [{ url: a.images[0].url }] : undefined },
    robots: a.isDemo ? { index: false, follow: true } : undefined,
  };
}

export default async function AccountPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = await getAccountBySlug(slug);
  if (!a) notFound();
  const related = await getRelatedAccounts(a.id);

  const specs = [
    { icon: Trophy, k: "Nivel", v: a.level != null ? String(a.level) : "No informado" },
    { icon: Swords, k: "Skins", v: a.skinsCount != null ? formatNumber(a.skinsCount) : "No informado" },
    { icon: Box, k: "Pechos", v: a.chestsCount != null ? formatNumber(a.chestsCount) : "No informado" },
    { icon: Layers, k: "Rango", v: a.rank ? <span className="flex items-center gap-1.5"><RankEmblem rank={a.rank} className="size-5" />{rankLabel(a.rank)}</span> : "No aplica" },
    { icon: Globe, k: "Servidor", v: <span className="flex items-center gap-1.5"><RegionFlag code={a.region} />{regionInfo(a.region)?.label ?? a.region}</span> },
    {
      icon: Mail,
      k: "Correo",
      v:
        a.emailStatus === "CONFIRMED" ? (
          <span className="flex items-center gap-1.5 text-ok-400"><MailCheck className="size-4" />Confirmado</span>
        ) : a.emailStatus === "PENDING" ? (
          <span className="flex items-center gap-1.5 text-warn-400"><CircleDashed className="size-4" />En proceso</span>
        ) : (
          "No informado"
        ),
    },
  ];

  return (
    <>
      {!a.isDemo && (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "Product",
            name: a.title,
            description: a.description,
            image: a.images.map((i) => (i.url.startsWith("http") ? i.url : `${env.appUrl}${i.url}`)),
            sku: a.id,
            offers: {
              "@type": "Offer",
              priceCurrency: a.currency,
              price: a.quote.price,
              availability: a.available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
              url: `${env.appUrl}/cuentas/${a.slug}`,
            },
          }}
        />
      )}
      <Container className="py-8 sm:py-10">
        <nav aria-label="Ruta" className="mb-6 flex items-center gap-1.5 text-[13px] text-fg-subtle">
          <Link href="/" className="hover:text-fg">
            Inicio
          </Link>
          <ChevronRight className="size-3.5" />
          <Link href="/cuentas" className="hover:text-fg">
            Cuentas
          </Link>
          <ChevronRight className="size-3.5" />
          <span className="truncate text-fg-muted">{a.title}</span>
        </nav>

        {a.isDemo && (
          <Alert tone="warning" title="Publicación de demostración" className="mb-6">
            Esta ficha existe solo para mostrar el diseño de la tienda. Sus datos no corresponden a una cuenta real.
          </Alert>
        )}

        <div className="grid gap-8 lg:grid-cols-[1.35fr_1fr] lg:gap-x-10 lg:gap-y-10">
          {/* En celular: fotos, compra y luego detalles. En escritorio: fotos y detalles a la izquierda, compra fija a la derecha. */}
          <div className="min-w-0 lg:col-start-1 lg:row-start-1">
            <Gallery images={a.images} title={a.title} />
          </div>

          {/* Columna de compra */}
          <aside className="lg:sticky lg:top-24 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
            <div className="surface p-5 sm:p-6">
              <div className="flex flex-wrap items-center gap-2">
                <ProductLabelTag label={a.label} />
                {a.isDemo && <DemoBadge />}
              </div>
              <h1 className="mt-3 font-display text-2xl font-semibold leading-tight">{a.title}</h1>

              <dl className="mt-5 grid grid-cols-2 gap-2">
                {specs.map(({ icon: Icon, k, v }) => (
                  <div key={k} className="rounded-lg border border-white/[0.06] bg-ink-850 p-3">
                    <dt className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-fg-subtle">
                      <Icon className="size-3.5" /> {k}
                    </dt>
                    <dd className="mt-1 font-medium tabular-nums">{v}</dd>
                  </div>
                ))}
              </dl>

              {a.tags.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {a.tags.map((t) => (
                    <Link key={t} href={`/cuentas?caracteristica=${encodeURIComponent(t)}`} className="rounded-md border border-white/10 px-2 py-0.5 text-[12px] text-fg-muted hover:border-white/20 hover:text-fg">
                      {t}
                    </Link>
                  ))}
                </div>
              )}

              <div className="mt-6 border-t border-white/[0.06] pt-5">
                <Price quote={a.quote} currency={a.currency} size="lg" />
              </div>

              <div className="mt-5 space-y-2.5">
                {a.sold ? (
                  <Alert tone="info">Esta cuenta ya fue vendida.</Alert>
                ) : a.available ? (
                  <>
                    <LinkButton href={`/cuentas/${a.slug}/comprar`} size="lg" className="w-full">
                      Comprar esta cuenta
                    </LinkButton>
                    <AddToCartButton item={{ kind: "account", id: a.id }} className="w-full" />
                  </>
                ) : (
                  <div className="flex items-start gap-2.5 rounded-lg border border-warn-400/25 bg-warn-400/[0.06] p-3 text-sm text-fg-muted">
                    <Clock className="mt-0.5 size-4 shrink-0 text-warn-400" />
                    Otra persona está completando el pago. Si no lo finaliza, la cuenta volverá a estar disponible en unos minutos.
                  </div>
                )}
              </div>

              <p className="mt-5 text-[12px] leading-relaxed text-fg-subtle">
                Compra como invitado. Al confirmarse el pago, la cuenta queda asignada a tu pedido y te entregamos los datos por el chat del pedido.
              </p>
            </div>

            <BannerSlot slot="ACCOUNT_SIDE" variant="stack" label="Garantía" className="mt-4" />

            <details className="mt-4 rounded-[12px] border border-white/[0.07] bg-ink-850 px-5 py-4 text-sm">
              <summary className="cursor-pointer text-fg-muted hover:text-fg">¿Esta publicación infringe tus derechos? Reportarla</summary>
              <ClaimForm accountId={a.id} />
            </details>
          </aside>

          <div className="min-w-0 lg:col-start-1 lg:row-start-2">

            <section aria-labelledby="descripcion">
              <h2 id="descripcion" className="font-display text-lg font-semibold">
                Descripción
              </h2>
              <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-fg-muted">{a.description}</p>
            </section>

            <section className="mt-10" aria-labelledby="entrega">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id="entrega" className="font-display text-lg font-semibold">
                  Entrega
                </h2>
                {a.inventoryVerified ? (
                  <span className="inline-flex items-center gap-1.5 text-[13px] text-ok-400">
                    <BadgeCheck className="size-4" /> Revisada por el equipo
                    {a.inventoryVerifiedAt ? ` el ${formatDate(a.inventoryVerifiedAt, false)}` : ""}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-[13px] text-fg-subtle">
                    <Info className="size-4" /> Pendiente de revisión del equipo
                  </span>
                )}
              </div>
              <ul className="mt-3 space-y-2.5 rounded-[12px] border border-white/[0.07] bg-ink-850 p-5 text-[14px] text-fg-muted">
                <li className="flex gap-2.5">
                  <PackageCheck className="size-4 shrink-0 translate-y-0.5 text-volt-300" /> La cuenta se reserva para ti mientras completas el pago.
                </li>
                <li className="flex gap-2.5">
                  <Clock className="size-4 shrink-0 translate-y-0.5 text-volt-300" /> Recibes los datos de acceso por el chat seguro de tu pedido apenas se confirme el pago.
                </li>
                <li className="flex gap-2.5">
                  <ShieldCheck className="size-4 shrink-0 translate-y-0.5 text-volt-300" /> Nunca te pediremos contraseñas de tus redes sociales ni datos bancarios.
                </li>
              </ul>
            </section>
          </div>
        </div>

        {related.length > 0 && (
          <section className="mt-20" aria-labelledby="relacionadas">
            <h2 id="relacionadas" className="font-display text-xl font-semibold">
              También te puede interesar
            </h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((r) => (
                <AccountGridCard key={r.id} a={r} />
              ))}
            </div>
          </section>
        )}
      </Container>
    </>
  );
}
