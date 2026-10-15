"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, FieldHint, Label } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { createAccountOrderAction } from "@/app/actions/store";
import type { PublicPaymentOption } from "@/server/integrations/payments";
import { formatMoney } from "@/lib/money";
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
  const [provider, setProvider] = useState(payments.length === 1 ? payments[0].id : "");
  const [accept, setAccept] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [promo, setPromo] = useState<AppliedPromo>(null);
  const onPromo = useCallback((p: AppliedPromo) => setPromo(p), []);
  const emailOk = /^[^s@]+@[^s@]+.[^s@]{2,}$/.test(email.trim());
  const total = price - (promo?.discount ?? 0);
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
          const r = await createAccountOrderAction({ accountId, name, email, phone, paymentProvider: provider, idempotencyKey, promoCode: promo?.code, acceptTerms: accept });
          if (!r.ok) return setError(r.error);
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
                <span className="text-[13px] text-fg-muted">{methods.length ? paymentMethodsSentence(methods) : p.methods}</span>
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
            {promo && <span className="mr-2 text-[13px] font-normal text-fg-subtle line-through">{formatMoney(price, currency)}</span>}
            {formatMoney(total, currency)}
          </span>
        </div>
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
          y las condiciones de entrega de esta cuenta.
        </span>
      </label>

      {error && <Alert tone="danger">{error}</Alert>}

      <Button type="submit" size="lg" className="w-full" loading={pending} disabled={!provider || !accept || !email || name.trim().length < 2}>
        <Lock className="size-4" /> Reservar y pagar
      </Button>
    </form>
  );
}
