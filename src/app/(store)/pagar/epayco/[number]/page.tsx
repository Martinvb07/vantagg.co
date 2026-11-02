import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Lock, ShieldCheck } from "lucide-react";
import { db } from "@/lib/db";
import { safeEqual } from "@/lib/crypto";
import { formatCharge, formatMoney } from "@/lib/money";
import { Alert, Container } from "@/components/ui/primitives";
import { ResumePayment } from "@/components/orders/order-live";
import { chargeOf } from "@/server/orders";
import { getPaymentProvider } from "@/server/integrations/payments";
import { EPAYCO_CHECKOUT_SCRIPT, EPAYCO_SESSION_PREFIX } from "@/server/integrations/payments/epayco";
import { EpaycoOpener } from "./opener";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pagar con ePayco", robots: { index: false, follow: false } };

/**
 * Paso intermedio del pago con ePayco: abre su checkout con la sesión de cobro que creó la tienda (monto fijado en
 * el servidor). El cliente no ve ni elige montos aquí; si la sesión no existe, puede generar un enlace nuevo.
 */
export default async function PayWithEpayco({ params, searchParams }: { params: Promise<{ number: string }>; searchParams: Promise<{ t?: string }> }) {
  const [{ number }, { t }] = await Promise.all([params, searchParams]);
  const orderNumber = decodeURIComponent(number).toUpperCase();
  const order = await db.order.findUnique({
    where: { number: orderNumber },
    select: { id: true, number: true, trackingToken: true, status: true, paymentProvider: true, total: true, currency: true, chargeAmount: true, chargeCurrency: true, itemSnapshot: true, expiresAt: true },
  });
  if (!order || !t || !safeEqual(order.trackingToken, t) || order.paymentProvider !== "epayco") notFound();
  const orderUrl = `/pedido/${order.number}?t=${encodeURIComponent(order.trackingToken)}`;
  if (order.status !== "PENDING_PAYMENT" || order.expiresAt < new Date()) redirect(orderUrl);

  const event = await db.orderEvent.findFirst({ where: { orderId: order.id, type: "CHECKOUT_STARTED" }, orderBy: { createdAt: "desc" }, select: { data: true } });
  const ref = (event?.data as { provider?: string; checkoutRef?: string } | null)?.checkoutRef ?? "";
  const sessionId = ref.startsWith(EPAYCO_SESSION_PREFIX) ? ref.slice(EPAYCO_SESSION_PREFIX.length) : null;
  const provider = getPaymentProvider("epayco");
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const charge = chargeOf(order);
  const name = (order.itemSnapshot as { name?: string }).name ?? "Tu pedido";

  return (
    <Container className="max-w-lg py-10 sm:py-14">
      <div className="rounded-[18px] bg-ink-850 p-6 ring-1 ring-white/[0.08]">
        <p className="text-[12.5px] text-fg-subtle">Pedido {order.number}</p>
        <h1 className="mt-1 text-[21px] font-bold tracking-tight">Pagar con ePayco</h1>
        <div className="mt-4 flex items-baseline justify-between gap-4 border-t border-white/[0.06] pt-3">
          <span className="text-[14px] text-fg-muted">{name}</span>
          <span className="text-right">
            <span className="block text-2xl font-bold tabular-nums">{formatCharge(charge.amount, charge.currency)}</span>
            {charge.currency !== order.currency && <span className="block text-[12px] tabular-nums text-fg-subtle">≈ {formatMoney(order.total, order.currency)}</span>}
          </span>
        </div>
        {charge.currency === "USD" && (
          <p className="mt-3 text-[12.5px] leading-relaxed text-fg-muted">Pagas en dólares (US$) con tarjeta. Si tu tarjeta es de otra moneda, tu banco hace la conversión.</p>
        )}
        {sessionId && provider?.isEnabled() ? (
          <EpaycoOpener sessionId={sessionId} script={EPAYCO_CHECKOUT_SCRIPT} nonce={nonce} orderUrl={orderUrl} />
        ) : (
          <div className="mt-5 space-y-3">
            <Alert tone="warning">No encontramos el enlace de pago de este pedido. Genera uno nuevo para continuar.</Alert>
            <ResumePayment number={order.number} token={order.trackingToken} />
          </div>
        )}
        <p className="mt-4 flex items-center justify-center gap-1.5 text-[11.5px] text-fg-subtle">
          <ShieldCheck className="size-3.5" /> Pagas en la plataforma de ePayco. No guardamos datos de tarjetas.
        </p>
      </div>
      <p className="mt-4 text-center text-[13px] text-fg-muted">
        <Lock className="mr-1 inline size-3.5" />
        ¿Ya pagaste o quieres revisar el pedido?{" "}
        <Link href={orderUrl} className="text-fg underline underline-offset-2">
          Ver estado del pedido
        </Link>
      </p>
    </Container>
  );
}
