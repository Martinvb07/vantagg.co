import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AccountPlaceholder } from "@/components/brand/illustrations";
import { Alert, Container, DemoBadge } from "@/components/ui/primitives";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isProduction } from "@/lib/env";
import { formatMoney } from "@/lib/money";
import { regionInfo } from "@/domain/freefire";
import { getAccountBySlug } from "@/server/catalog";
import { publicPaymentOptions } from "@/server/integrations/payments";
import { AccountCheckoutForm } from "./account-checkout-form";
import { getSettings } from "@/server/settings";
import { parsePaymentMethods } from "@/domain/payment-methods";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Comprar cuenta", robots: { index: false, follow: false } };

export default async function BuyAccountPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [a, user, settings] = await Promise.all([getAccountBySlug(slug), getCurrentUser(), getSettings()]);
  const profile = user ? await db.user.findUnique({ where: { id: user.id }, select: { phone: true } }) : null;
  if (!a) notFound();
  const payments = publicPaymentOptions();
  const blocked = a.sold ? "Esta cuenta ya fue vendida." : !a.available ? "Esta cuenta está reservada en otro checkout en este momento." : isProduction && a.isDemo ? "Las publicaciones de demostración no se pueden comprar." : payments.length === 0 ? "Estamos activando los pagos. Muy pronto podrás comprar esta cuenta." : null;

  return (
    <Container className="max-w-[1040px] py-8 sm:py-12">
      <Link href={`/cuentas/${a.slug}`} className="inline-flex items-center gap-1.5 text-[13px] text-fg-muted hover:text-fg">
        <ArrowLeft className="size-4" /> Volver a la ficha
      </Link>
      <h1 className="mt-4 font-display text-3xl font-semibold">Comprar cuenta</h1>
      <p className="mt-2 text-[15px] text-fg-muted">Al crear el pedido, la cuenta queda reservada a tu nombre durante 20 minutos mientras completas el pago.</p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
        <div className="surface p-5 sm:p-6">
          {blocked ? (
            <Alert tone="warning" title="No es posible comprar ahora">
              {blocked}
            </Alert>
          ) : (
            <AccountCheckoutForm accountId={a.id} price={a.quote.price} currency={a.currency} methods={parsePaymentMethods(settings.paymentMethods)} payments={payments} defaultEmail={user?.email} defaultName={user?.name && user.name !== "No Name" ? user.name : undefined} defaultPhone={profile?.phone ?? undefined} />
          )}
        </div>

        <aside className="surface overflow-hidden lg:sticky lg:top-24" aria-label="Resumen">
          <div className="relative aspect-[16/9] bg-ink-750">
            {a.images[0] ? (
              <Image src={a.images[0].url} alt={a.images[0].alt} fill priority sizes="360px" unoptimized={a.images[0].url.endsWith(".svg")} className="object-cover" />
            ) : (
              <AccountPlaceholder />
            )}
          </div>
          <div className="p-5">
            <p className="flex items-center gap-2 font-display font-semibold leading-snug">
              {a.title} {a.isDemo && <DemoBadge />}
            </p>
            <p className="mt-1 text-[13px] text-fg-muted">
              Nivel {a.level ?? "—"} · {a.skinsCount ?? "—"} skins{a.chestsCount != null ? ` · ${a.chestsCount} pechos` : ""} · {regionInfo(a.region)?.label ?? a.region}
            </p>
            <dl className="mt-5 space-y-2 border-t border-white/[0.06] pt-4 text-sm">
              {a.quote.original != null && (
                <>
                  <div className="flex justify-between text-fg-muted">
                    <dt>Precio anterior</dt>
                    <dd className="tabular-nums line-through">{formatMoney(a.quote.original, a.currency)}</dd>
                  </div>
                  <div className="flex justify-between text-volt-300">
                    <dt>Ahorro</dt>
                    <dd className="tabular-nums">−{formatMoney(a.quote.discount, a.currency)}</dd>
                  </div>
                </>
              )}
              <div className="flex items-baseline justify-between pt-1">
                <dt className="font-medium">Total</dt>
                <dd className="font-display text-2xl font-semibold tabular-nums">{formatMoney(a.quote.price, a.currency)}</dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>
    </Container>
  );
}
