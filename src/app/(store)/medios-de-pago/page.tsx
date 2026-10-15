import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Building2, Clock, CreditCard, FileSignature, Lock, RotateCcw, Smartphone, Wallet, Zap, Landmark } from "lucide-react";
import { PaymentBadges } from "@/components/brand/payment-badges";
import { BoldLogo } from "@/components/brand/bold-logo";
import { Container } from "@/components/ui/primitives";
import { PAYMENT_METHODS, parsePaymentMethods, type PaymentMethodId } from "@/domain/payment-methods";
import { getSettings } from "@/server/settings";
import { publicPaymentOptions } from "@/server/integrations/payments";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Medios de pago",
  description: "Paga tus diamantes de Free Fire con tarjeta débito, crédito, Nequi, PSE o Botón Bancolombia a través de Bold, en pesos colombianos.",
  alternates: { canonical: "/medios-de-pago" },
};

const DETAILS: Record<PaymentMethodId, { icon: typeof CreditCard; tint: string; text: string; note: string }> = {
  debito: { icon: Wallet, tint: "bg-volt-400/12 text-volt-300", text: "Paga con tu tarjeta débito habilitada para compras por internet.", note: "Se confirma en segundos" },
  credito: { icon: CreditCard, tint: "bg-sky-400/12 text-sky-300", text: "Paga con tu tarjeta de crédito. Tu banco puede pedirte confirmar la compra.", note: "Se confirma en segundos" },
  nequi: { icon: Smartphone, tint: "bg-pink-500/12 text-pink-300", text: "Te llega una notificación en la app de Nequi y apruebas el pago desde tu celular.", note: "Apruebas desde la app" },
  pse: { icon: Building2, tint: "bg-blue-500/12 text-blue-300", text: "Pagas desde la cuenta de tu banco, sin tarjeta.", note: "Puede tardar unos minutos" },
  bancolombia: { icon: Landmark, tint: "bg-yellow-400/12 text-yellow-300", text: "Pagas desde tu cuenta Bancolombia con el botón de pagos, sin tarjeta.", note: "Se confirma en minutos" },
  breb: { icon: Zap, tint: "bg-teal-400/12 text-teal-300", text: "Pagas al instante desde la app de tu banco o billetera con Bre-B, el sistema de pagos inmediatos de Colombia.", note: "Inmediato, todos los días" },
};

const STEPS = [
  { t: "Eliges", d: "Tu paquete de diamantes y confirmas tus datos." },
  { t: "Pagas con Bold", d: "Te llevamos al pago seguro de Bold para elegir cómo pagar." },
  { t: "Bold confirma", d: "Recibimos la confirmación del pago directamente de Bold." },
  { t: "Entregamos", d: "Empieza la entrega y la sigues en la página de tu pedido." },
];

export default async function PaymentMethodsPage() {
  const settings = await getSettings();
  const methods = parsePaymentMethods(settings.paymentMethods);
  const paymentsReady = publicPaymentOptions().length > 0;

  return (
    <Container className="py-8 sm:py-10">
      {!paymentsReady && (
        <p className="mb-6 flex items-center gap-2.5 rounded-[12px] bg-sky-400/[0.07] px-4 py-3 text-[13.5px] text-sky-200 ring-1 ring-sky-400/20">
          <Clock className="size-4 shrink-0" /> Estamos activando los pagos con Bold. Muy pronto podrás comprar; mientras tanto puedes ver precios y paquetes.
        </p>
      )}
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-2xl">
          <h1 className="text-[28px] font-bold tracking-tight sm:text-[34px]">Medios de pago</h1>
          <p className="mt-1.5 text-[15px] text-fg-muted">Pagas en pesos colombianos a través de Bold, pasarela de pagos colombiana. Elige el medio que prefieras al momento de pagar.</p>
        </div>
        <div className="flex items-center gap-3 rounded-[14px] bg-ink-850 px-4 py-3 ring-1 ring-white/[0.08]">
          <Lock className="size-4 text-volt-300" />
          <div className="leading-tight">
            <p className="text-[12px] text-fg-subtle">Pagos procesados por</p>
            <BoldLogo className="mt-1.5 h-6" />
          </div>
        </div>
      </div>

      {/* Medios */}
      <section aria-labelledby="medios" className="mt-8">
        <h2 id="medios" className="sr-only">
          Medios disponibles
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {PAYMENT_METHODS.filter((m) => methods.includes(m.id)).map((m) => {
            const { icon: Icon, tint, text, note } = DETAILS[m.id];
            return (
              <article key={m.id} className="flex flex-col rounded-[18px] bg-ink-850 p-5 ring-1 ring-white/[0.07]">
                <div className="flex items-center justify-between gap-3">
                  <span className={`grid size-11 place-items-center rounded-xl ${tint}`}>
                    <Icon className="size-5" />
                  </span>
                  <PaymentBadges methods={[m.id]} size="sm" />
                </div>
                <h3 className="mt-4 text-[16px] font-bold">{m.label}</h3>
                <p className="mt-1 text-[13.5px] leading-relaxed text-fg-muted">{text}</p>
                <p className="mt-auto flex items-center gap-1.5 pt-4 text-[12.5px] font-medium text-fg-subtle">
                  <Clock className="size-3.5" /> {note}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Cómo funciona */}
        <section aria-labelledby="como">
          <h2 id="como" className="text-[18px] font-bold tracking-tight">
            Así funciona el pago
          </h2>
          <ol className="mt-4 grid gap-px overflow-hidden rounded-[16px] bg-white/[0.06] ring-1 ring-white/[0.07] sm:grid-cols-2">
            {STEPS.map((s, i) => (
              <li key={s.t} className="flex gap-3.5 bg-ink-850 p-5">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-volt-400 text-[13px] font-extrabold text-volt-ink">{i + 1}</span>
                <p className="text-[13.5px] leading-relaxed text-fg-muted">
                  <span className="block text-[14.5px] font-semibold text-fg">{s.t}</span>
                  {s.d}
                </p>
              </li>
            ))}
          </ol>

          <div className="mt-4 flex flex-wrap gap-2 text-[13px]">
            {[
              { href: "/ayuda#pago-pendiente", l: "Pagué y sigue pendiente" },
              { href: "/ayuda#pago-rechazado", l: "Me rechazaron el pago" },
              { href: "/ayuda#codigo-promocional", l: "Usar un código promocional" },
            ].map((x) => (
              <Link key={x.href} href={x.href} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/[0.05] px-3.5 font-medium text-fg-muted ring-1 ring-white/[0.08] hover:bg-white/10 hover:text-fg">
                {x.l} <ArrowRight className="size-3.5" />
              </Link>
            ))}
          </div>
        </section>

        {/* Seguridad */}
        <aside aria-labelledby="seguridad" className="rounded-[18px] bg-ink-850 p-5 ring-1 ring-white/[0.07] lg:self-start">
          <h2 id="seguridad" className="flex items-center gap-2 text-[16px] font-bold">
            <BadgeCheck className="size-5 text-volt-300" /> Tu pago, seguro
          </h2>
          <ul className="mt-4 space-y-4">
            {[
              { icon: Lock, t: "No vemos tu tarjeta", d: "Los datos de pago los recibe Bold directamente. Nosotros nunca los vemos ni los guardamos." },
              { icon: FileSignature, t: "Confirmación firmada", d: "Tu pedido pasa a «Pagado» solo cuando Bold nos lo confirma y lo verificamos." },
              { icon: RotateCcw, t: "Reembolso por el mismo medio", d: "Si no podemos entregar, te devolvemos el dinero por el medio con el que pagaste." },
            ].map(({ icon: Icon, t, d }) => (
              <li key={t} className="flex gap-3">
                <Icon className="mt-0.5 size-4 shrink-0 text-fg-subtle" />
                <p className="text-[13px] leading-relaxed text-fg-muted">
                  <span className="block font-semibold text-fg">{t}</span>
                  {d}
                </p>
              </li>
            ))}
          </ul>
          <Link href="/recargas" className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-[11px] bg-volt-400 text-[14.5px] font-bold text-volt-ink hover:bg-volt-300">
            Recargar diamantes <ArrowRight className="size-4" />
          </Link>
        </aside>
      </div>
    </Container>
  );
}
