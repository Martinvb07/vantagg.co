"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, FieldHint, Label } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { createAccountOrderAction } from "@/app/actions/store";
import { trackInitiateCheckout } from "@/lib/ads";
import type { PublicPaymentOption } from "@/server/integrations/payments";
import { formatCharge, formatMoney } from "@/lib/money";
import { useMarket, useUsdCharge } from "@/components/store/market";
import { PaymentBadges } from "@/components/brand/payment-badges";
import { paymentMethodsSentence, type PaymentMethodId } from "@/domain/payment-methods";
import { PromoCodeField, type AppliedPromo } from "@/components/checkout/promo-code-field";
import { GatewayMark, GatewayTitle } from "@/components/checkout/gateway-label";

export function AccountCheckoutForm({
  accountId,
  payments,
  defaultEmail,
  defaultName,
  defaultPhone,
  price,
  currency,
  methods,
}: {
  accountId: string;
  price: number;
  currency: string;
  methods: PaymentMethodId[];
  payments: PublicPaymentOption[];
  defaultEmail?: string;
  defaultName?: string;
  defaultPhone?: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(defaultName ?? "");
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [phone, setPhone] = useState(defaultPhone ?? "");
  const market = useMarket();
  const [provider, setProvider] = useState(payments.length === 1 ? payments[0].id : market?.usdCharge ? (payments.find((p) => p.currencies.includes("USD"))?.id ?? "") : "");
  const [accept, setAccept] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [promo, setPromo] = useState<AppliedPromo>(null);
  const onPromo = useCallback((p: AppliedPromo) => setPromo(p), []);
  const emailOk = /^[^s@]+@[^s@]+.[^s@]{2,}$/.test(email.trim());
  const total = price - (promo?.discount ?? 0);
  const usdCents = useUsdCharge(total, payments.find((p) => p.id === provider)?.currencies);
  const idempotencyKey = useMemo(
    () => crypto.randomUUID(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [name, email, phone, provider, promo?.code],
  );

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const r = await createAccountOrderAction({ accountId, name, email, phone, paymentProvider: provider, idempotencyKey, promoCode: promo?.code, acceptTerms: accept, marketing });
          if (!r.ok) return setError(r.error);
          trackInitiateCheckout({ value: total, currency, item: { id: accountId, name: "Cuenta Free Fire" } });
          if (r.redirectUrl.startsWith("/")) router.push(r.redirectUrl);
          else window.location.assign(r.redirectUrl);
        });
      }}
    >
      <fieldset className="space-y-4">
        <legend className="mb-1 font-display text-lg font-semibold">1. Tus datos</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="name">Nombre</Label>
            <input id="name" required autoComplete="name" className="field h-11" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="phone">WhatsApp (opcional)</Label>
            <input id="phone" type="tel" autoComplete="tel" placeholder="+57 300 000 0000" className="field h-11" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>
        <div>
          <Label htmlFor="email">Correo</Label>
          <input id="email" type="email" required autoComplete="email" className="field h-11" value={email} onChange={(e) => setEmail(e.target.value)} />
          <FieldHint>Aquí recibirás la confirmación y coordinaremos la entrega. No pedimos contraseñas de tus redes sociales.</FieldHint>
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-3 font-display text-lg font-semibold">2. Medio de pago</legend>
        <PaymentBadges methods={methods} size="sm" className="mb-3" />
        <div className="space-y-2.5">
          {payments.map((p) => (
            <label
              key={p.id}
              className={cn(
                "flex cursor-pointer items-center gap-4 rounded-[10px] border bg-ink-850 p-4 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-volt-400",
                provider === p.id ? "border-volt-400/70" : "border-white/[0.08] hover:border-white/20",
              )}
            >
              <input type="radio" name="provider" className="sr-only" checked={provider === p.id} onChange={() => setProvider(p.id)} />
              <span className={cn("grid size-5 place-items-center rounded-full border", provider === p.id ? "border-volt-400 bg-volt-400" : "border-white/25")}>
                {provider === p.id && <span className="size-2 rounded-full bg-volt-ink" />}
              </span>
              <GatewayMark id={p.id} />
              <span className="flex-1">
                <span className="flex flex-wrap items-center gap-2 font-medium">
                  <GatewayTitle option={p} />
                </span>
                <span className="text-[13px] text-fg-muted">
                  {p.id === "bold" && methods.length ? paymentMethodsSentence(methods) : p.methods}
                  {market && !market.home ? (market.usdCharge && p.currencies.includes("USD") ? " · en dólares (US$)" : " · en pesos (COP)") : ""}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-3">
        <PromoCodeField kind="ACCOUNT" itemId={accountId} email={emailOk ? email.trim() : undefined} applied={promo} onChange={onPromo} />
        <div className="flex items-baseline justify-between rounded-[10px] border border-white/[0.06] bg-ink-850 px-4 py-3">
          <span className="text-sm text-fg-muted">Total a pagar</span>
          <span className="font-display text-xl font-bold tabular-nums">
            {promo && usdCents == null && <span className="mr-2 text-[13px] font-normal text-fg-subtle line-through">{formatMoney(price, currency)}</span>}
            {usdCents != null ? formatCharge(usdCents, "USD") : formatMoney(total, currency)}
            {usdCents != null && <span className="block text-right text-[12px] font-normal text-fg-subtle">≈ {formatMoney(total, currency)}</span>}
          </span>
        </div>
        {market && !market.home && (
          <p className="text-[12px] leading-relaxed text-fg-subtle">
            {usdCents != null ? `Estás en ${market.countryName}: pagas en dólares (US$) con tarjeta. Si tu tarjeta es de otra moneda, tu banco hace la conversión.` : `Estás en ${market.countryName}: el cobro es en pesos colombianos (COP) y tu banco hace la conversión.`}
          </p>
        )}
      </div>

      <label className="flex cursor-pointer items-start gap-3 text-sm text-fg-muted">
        <input type="checkbox" className="mt-0.5 size-4 accent-[#c8f04f]" checked={accept} onChange={(e) => setAccept(e.target.checked)} />
        <span>
          Acepto los{" "}
          <a href="/legal/terminos" target="_blank" className="text-volt-300 underline underline-offset-2">
            términos
          </a>
          , la{" "}
          <a href="/legal/reembolsos" target="_blank" className="text-volt-300 underline underline-offset-2">
            política de reembolsos
          </a>{" "}
          y las condiciones de entrega de esta cuenta, autorizo el tratamiento de mis datos según la{" "}
          <a href="/legal/privacidad" target="_blank" className="text-volt-300 underline underline-offset-2">
            política de privacidad
          </a>{" "}
          y soy mayor de edad o compro con autorización de mi padre, madre o acudiente.
        </span>
      </label>
      <label className="flex cursor-pointer items-start gap-3 text-sm text-fg-muted">
        <input type="checkbox" className="mt-0.5 size-4 accent-[#c8f04f]" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} />
        <span>Avísame de ofertas y descuentos por correo (opcional; te das de baja con un clic).</span>
      </label>

      {error && <Alert tone="danger">{error}</Alert>}

      <Button type="submit" size="lg" className="w-full" loading={pending} disabled={!provider || !accept || !email || name.trim().length < 2}>
        <Lock className="size-4" /> Reservar y pagar
      </Button>
    </form>
  );
}
