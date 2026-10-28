import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CircleAlert, CircleCheck, Clock, CreditCard, Loader, MessageCircle, RotateCcw, XCircle } from "lucide-react";
import { DiamondCover, tierFor } from "@/components/brand/covers";
import { AccountPlaceholder } from "@/components/brand/illustrations";
import { CopyButton } from "@/components/orders/copy-button";
import { AutoRefresh, ResumePayment } from "@/components/orders/order-live";
import { OrderTimeline } from "@/components/orders/order-tracker";
import { Alert, Container, DemoBadge } from "@/components/ui/primitives";
import { ORDER_STATUS_META, type OrderStatusValue } from "@/domain/order-status";
import { getCurrentUser } from "@/lib/auth";
import { formatDate, formatMoney, formatNumber } from "@/lib/money";
import { cn, whatsappLink } from "@/lib/utils";
import { getOrderForCustomer } from "@/server/order-view";
import { checkPendingPayment, refreshDeliveryIfStale } from "@/server/orders";
import { getSettings } from "@/server/settings";
import { chatState, listMessages, markRead } from "@/server/chat";
import { OrderChat } from "@/components/orders/order-chat";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Estado del pedido", robots: { index: false, follow: false } };

const PROVIDER_NAMES: Record<string, string> = { bold: "Bold" };

const HERO: Record<OrderStatusValue, { icon: typeof Clock; tone: string; title: string }> = {
  PENDING_PAYMENT: { icon: Clock, tone: "text-warn-400 bg-warn-400/12 ring-warn-400/25", title: "Esperando tu pago" },
  PAID: { icon: CreditCard, tone: "text-sky-300 bg-sky-400/12 ring-sky-400/25", title: "Pago confirmado" },
  PROCESSING: { icon: Loader, tone: "text-volt-300 bg-volt-400/12 ring-volt-400/25", title: "Entregando tu pedido" },
  DELIVERED: { icon: CircleCheck, tone: "text-ok-400 bg-ok-400/12 ring-ok-400/25", title: "¡Pedido entregado!" },
  DELIVERY_FAILED: { icon: CircleAlert, tone: "text-bad-400 bg-bad-400/12 ring-bad-400/25", title: "Estamos revisando tu entrega" },
  REFUND_REQUESTED: { icon: RotateCcw, tone: "text-warn-400 bg-warn-400/12 ring-warn-400/25", title: "Reembolso en curso" },
  REFUNDED: { icon: RotateCcw, tone: "text-fg-muted bg-white/[0.06] ring-white/10", title: "Reembolso completado" },
  CANCELLED: { icon: XCircle, tone: "text-fg-muted bg-white/[0.06] ring-white/10", title: "Pedido cancelado" },
};

export default async function OrderPage({ params, searchParams }: { params: Promise<{ number: string }>; searchParams: Promise<{ t?: string; from?: string }> }) {
  const [{ number }, { t, from }] = await Promise.all([params, searchParams]);
  const user = await getCurrentUser();
  const orderNumber = decodeURIComponent(number).toUpperCase();
  let order = await getOrderForCustomer(orderNumber, t, user);
  if (!order) notFound();
  // Pago pendiente: se pregunta a la pasarela (además del webhook y el cron) por si ya lo aprobó.
  if (order.status === "PENDING_PAYMENT" && !order.viewerIsStaff) {
    if (await checkPendingPayment(order.id).catch(() => false)) order = (await getOrderForCustomer(orderNumber, t, user)) ?? order;
  }
  // Recarga en curso: se pregunta al proveedor (además del webhook y el cron) para mostrar el estado real.
  if (order.type === "TOPUP" && order.status === "PROCESSING") {
    await refreshDeliveryIfStale(order.id).catch(() => {});
    order = (await getOrderForCustomer(orderNumber, t, user)) ?? order;
  }
  const settings = await getSettings();
  const state = chatState(order);
  const chat = { state, messages: state === "hidden" ? [] : await listMessages(order.id) };
  if (state !== "hidden" && !order.viewerIsStaff) await markRead(order.id, "customer");

  const hero = HERO[order.status];
  const HeroIcon = hero.icon;
  const live = ["PENDING_PAYMENT", "PAID", "PROCESSING"].includes(order.status);
  const canPay = order.status === "PENDING_PAYMENT" && order.expiresAt > new Date();
  const declined = order.status === "PENDING_PAYMENT" && order.lastPayment && ["DECLINED", "VOIDED", "ERROR"].includes(order.lastPayment.status);
  const wa = whatsappLink(settings.whatsapp, `Hola, necesito ayuda con mi pedido ${order.number}.`);
  const isTopup = order.type === "TOPUP" && order.item.diamonds != null;
  const title = isTopup
    ? `${formatNumber(order.item.diamonds!)}${order.item.bonusDiamonds ? ` + ${formatNumber(order.item.bonusDiamonds)} Bonus` : ""} diamantes`
    : order.item.name;

  return (
    <Container className="max-w-[1000px] py-8 sm:py-10">
      {order.isTest && (
        <Alert tone="warning" title="Pedido de prueba (DEMO)" className="mb-5">
          Se creó en modo de prueba: no hubo cobro real{order.type === "TOPUP" ? " y ningún diamante se envió a la cuenta del jugador" : ""}.
        </Alert>
      )}

      {/* Cabecera del pedido */}
      <div className="flex flex-col gap-4 rounded-[18px] bg-ink-850 p-4 ring-1 ring-white/[0.08] sm:flex-row sm:items-center sm:p-5">
        <div className="relative size-16 shrink-0 overflow-hidden rounded-[12px] sm:size-[72px]">
          {isTopup ? (
            <DiamondCover tier={tierFor(order.item.diamonds!)} diamonds={order.item.diamonds!} />
          ) : order.image ? (
            <Image src={order.image} alt="" fill sizes="72px" unoptimized={order.image.endsWith(".svg")} className="object-cover" />
          ) : (
            <AccountPlaceholder />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-[17px] font-bold">
            {order.productHref ? (
              <Link href={order.productHref} className="hover:text-volt-300">
                {title}
              </Link>
            ) : (
              title
            )}
            {order.isTest && <DemoBadge />}
          </p>
          <p className="mt-0.5 text-[13px] text-fg-muted">
            {order.playerId ? (
              <>
                Para el ID <span className="font-mono text-fg">{order.playerId}</span>
                {order.item.regionLabel && <> · {order.item.regionLabel}</>}
              </>
            ) : (
              "Cuenta Free Fire"
            )}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="font-mono text-[13px] font-semibold tracking-wider">{order.number}</span>
            <CopyButton value={order.number} label="Copiar" />
          </div>
        </div>
        <div className="flex items-end justify-between gap-4 border-t border-white/[0.06] pt-3 sm:block sm:border-0 sm:pt-0 sm:text-right">
          <p className="text-[12px] text-fg-subtle">Total</p>
          <p className="text-2xl font-bold tabular-nums">{formatMoney(order.total, order.currency)}</p>
        </div>
      </div>

      {/* Estado */}
      <section className="mt-4 rounded-[18px] bg-ink-850 p-5 ring-1 ring-white/[0.08] sm:p-6" aria-live="polite">
        <div className="flex items-start gap-4">
          <span className={cn("grid size-12 shrink-0 place-items-center rounded-2xl ring-1", hero.tone)}>
            <HeroIcon className={cn("size-6", order.status === "PROCESSING" && "motion-safe:animate-spin [animation-duration:3s]")} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h1 className="text-[21px] font-bold tracking-tight">{declined ? "Tu pago no fue aprobado" : hero.title}</h1>
              <AutoRefresh active={live} />
            </div>
            <p className="mt-1 text-[14px] leading-relaxed text-fg-muted">
              {declined
                ? "No se hizo ningún cobro. Puedes intentarlo de nuevo con otro medio de pago."
                : from === "pago" && order.status === "PENDING_PAYMENT"
                  ? "Si ya pagaste, la confirmación puede tardar unos minutos (PSE tarda un poco más). Esta página se actualiza sola."
                  : ORDER_STATUS_META[order.status].customer}
            </p>
            {order.status === "DELIVERED" && order.simulatedDelivery && <p className="mt-1.5 text-[13px] text-warn-400">Entrega simulada por el proveedor de prueba: no se enviaron diamantes reales.</p>}
            {order.status === "DELIVERED" && order.type === "TOPUP" && !order.simulatedDelivery && <p className="mt-1.5 text-[13px] text-fg-muted">Abre Free Fire y revisa tu saldo de diamantes.</p>}
            {/* Recargar de nuevo: mismo paquete y mismo ID, listo para pagar */}
            {order.type === "TOPUP" && order.productHref && ["DELIVERED", "CANCELLED", "REFUNDED"].includes(order.status) && (
              <Link
                href={`${order.productHref}${order.playerId ? `&id=${order.playerId}` : ""}`}
                className="mt-3 inline-flex h-10 items-center gap-2 rounded-full bg-volt-400 px-4 text-[13.5px] font-semibold text-volt-ink transition-colors hover:bg-volt-300"
              >
                <RotateCcw className="size-4" /> Recargar de nuevo
              </Link>
            )}
            {order.status === "PROCESSING" && order.type === "ACCOUNT" && (
              <p className="mt-1.5 text-[13px] text-fg-muted">Te entregamos la cuenta por el chat de abajo. Nunca te pediremos pagos adicionales ni códigos de tu banco.</p>
            )}
          </div>
        </div>

        <div className="mt-6">
          <OrderTimeline status={order.status} />
        </div>

        {canPay && (
          <div className="mt-6 flex flex-col gap-3 rounded-[12px] bg-ink-800 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[13.5px] text-fg-muted">
              Puedes completar el pago hasta el <span className="text-fg">{formatDate(order.expiresAt)}</span>.
            </p>
            <ResumePayment number={order.number} token={order.trackingToken} />
          </div>
        )}
      </section>

      {chat.state !== "hidden" && (
        <div id="chat" className="mt-4 scroll-mt-24">
          <OrderChat
            mode="customer"
            endpoint={`/api/orders/${encodeURIComponent(order.number)}/chat`}
            token={order.trackingToken}
            storeName={settings.storeName}
            initialState={chat.state}
            initialMessages={chat.messages}
            staffViewer={order.viewerIsStaff}
          />
        </div>
      )}

      <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <section className="rounded-[18px] bg-ink-850 p-5 ring-1 ring-white/[0.08]" aria-labelledby="historial">
          <h2 id="historial" className="text-[15px] font-bold">
            Historial del pedido
          </h2>
          <ol className="mt-4 space-y-4">
            {[...order.events].reverse().map((e, i) => (
              <li key={e.id} className="flex gap-3">
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", i === 0 ? "bg-volt-400 ring-4 ring-volt-400/15" : "bg-white/25")} aria-hidden />
                <div>
                  <p className={cn("text-[13.5px]", i === 0 ? "text-fg" : "text-fg-muted")}>{e.message}</p>
                  <time className="text-[11.5px] text-fg-subtle">{formatDate(e.createdAt)}</time>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <div className="space-y-4">
          <section className="rounded-[18px] bg-ink-850 p-5 ring-1 ring-white/[0.08]" aria-labelledby="resumen">
            <h2 id="resumen" className="text-[15px] font-bold">
              Resumen
            </h2>
            <dl className="mt-3 space-y-2 text-[13.5px]">
              <Row k="Fecha" v={formatDate(order.createdAt)} />
              <Row k="Pagado con" v={PROVIDER_NAMES[order.paymentProvider] ?? order.paymentProvider} />
              {order.paidAt && <Row k="Pago confirmado" v={formatDate(order.paidAt)} />}
              {order.deliveredAt && <Row k="Entregado" v={formatDate(order.deliveredAt)} />}
              <Row k="Confirmación a" v={order.customerEmail} />
              {order.discount > 0 && <Row k={order.promoCode ? `Código ${order.promoCode}` : "Descuento"} v={<span className="text-volt-300">−{formatMoney(order.discount, order.currency)}</span>} />}
            </dl>
          </section>

          <section className="rounded-[18px] bg-ink-850 p-5 ring-1 ring-white/[0.08]">
            <h2 className="text-[15px] font-bold">¿Necesitas ayuda?</h2>
            <p className="mt-1 text-[13px] text-fg-muted">Ten a mano el número {order.number}.</p>
            <div className="mt-3 grid gap-2">
              {wa && (
                <a href={wa} target="_blank" rel="noopener noreferrer" className="flex h-10 items-center justify-center gap-2 rounded-lg bg-green-500/12 text-[13.5px] font-semibold text-green-400 ring-1 ring-green-500/25 hover:ring-green-500/50">
                  <MessageCircle className="size-4" /> Escribir por WhatsApp
                </a>
              )}
              <Link href={`/ayuda?pedido=${order.number}${order.status === "DELIVERY_FAILED" || order.status === "REFUND_REQUESTED" ? "&tema=reembolso" : ""}#contacto`} className="flex h-10 items-center justify-center rounded-lg bg-white/[0.06] text-[13.5px] font-medium hover:bg-white/10">
                Abrir solicitud de soporte
              </Link>
            </div>
          </section>
        </div>
      </div>
    </Container>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-fg-muted">{k}</dt>
      <dd className="min-w-0 truncate text-right">{v}</dd>
    </div>
  );
}
