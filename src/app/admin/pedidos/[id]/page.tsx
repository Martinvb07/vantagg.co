import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Info } from "lucide-react";
import { ActionForm, ConfirmSubmit, SubmitButton } from "@/components/admin/action-form";
import { Panel } from "@/components/admin/ui";
import { Alert, DemoBadge } from "@/components/ui/primitives";
import { OrderStatusBadge } from "@/components/ui/status";
import { MANUAL_TRANSITIONS, ORDER_STATUS_META } from "@/domain/order-status";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatMoney } from "@/lib/money";
import { whatsappLink } from "@/lib/utils";
import { orderAction } from "@/app/actions/admin";
import { OrderChat } from "@/components/orders/order-chat";
import { chatState, listMessages, markRead } from "@/server/chat";
import { getSettings } from "@/server/settings";
import { refreshDeliveryIfStale } from "@/server/orders";
import { regionLabel } from "@/domain/topup-regions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pedido" };

const PAY = { PENDING: "Pendiente", APPROVED: "Aprobado", DECLINED: "Rechazado", VOIDED: "Anulado", ERROR: "Error" } as const;
const DEL = { QUEUED: "En cola", PROCESSING: "Procesando", SUCCESS: "Exitosa", FAILED: "Fallida" } as const;

export default async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  await refreshDeliveryIfStale(id).catch(() => {});
  const order = await db.order.findUnique({
    where: { id },
    include: {
      payments: { orderBy: { createdAt: "desc" } },
      delivery: true,
      events: { orderBy: { createdAt: "desc" } },
      notes: { orderBy: { createdAt: "desc" }, include: { author: { select: { email: true } } } },
      account: { select: { id: true, title: true, slug: true, status: true } },
      tickets: { orderBy: { createdAt: "desc" } },
      user: { select: { email: true } },
    },
  });
  if (!order) notFound();
  const item = order.itemSnapshot as { name: string; diamonds?: number; bonusDiamonds?: number; sku?: string | null; region?: string; regionName?: string | null; costCents?: number | null };
  const transitions = MANUAL_TRANSITIONS[order.status] ?? [];
  const state = chatState(order);
  const [settings, chatMessages] = await Promise.all([getSettings(), state === "hidden" ? [] : listMessages(order.id)]);
  if (state !== "hidden") await markRead(order.id, "staff");
  const chat = { state, messages: chatMessages };
  const wa = whatsappLink(order.customerPhone, `Hola ${order.customerName ?? ""}, te escribimos sobre tu pedido ${order.number}.`);

  return (
    <>
      <Link href="/admin/pedidos" className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-fg-muted hover:text-fg">
        <ArrowLeft className="size-4" /> Pedidos
      </Link>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-3 font-mono text-2xl font-semibold tracking-wider">
            {order.number} {order.isTest && <DemoBadge />}
          </h1>
          <p className="mt-1 text-[13px] text-fg-muted">
            {order.type === "TOPUP" ? "Recarga" : "Cuenta"} · creado {formatDate(order.createdAt)} · pasarela {order.paymentProvider}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <OrderStatusBadge status={order.status} simulated={order.delivery?.simulated} />
          <Link href={`/pedido/${order.number}?t=${order.trackingToken}`} target="_blank" className="inline-flex items-center gap-1 text-[12.5px] text-fg-muted hover:text-fg">
            Vista cliente <ExternalLink className="size-3.5" />
          </Link>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Panel title="Comprador">
              <dl className="space-y-2 text-[13px]">
                <Row k="Correo" v={<Link href={`/admin/clientes/detalle?correo=${encodeURIComponent(order.customerEmail)}`} className="underline-offset-4 hover:text-volt-300 hover:underline">{order.customerEmail}</Link>} />
                {order.customerName && <Row k="Nombre" v={order.customerName} />}
                {order.customerPhone && <Row k="Teléfono" v={wa ? <a href={wa} target="_blank" rel="noopener noreferrer" className="text-ok-400 underline">{order.customerPhone}</a> : order.customerPhone} />}
                <Row k="Cuenta en tienda" v={order.user?.email ?? "Invitado"} />
              </dl>
            </Panel>
            <Panel title="Producto">
              <dl className="space-y-2 text-[13px]">
                <Row k="Producto" v={item.name} />
                {order.playerId && <Row k="ID jugador" v={<span className="font-mono">{order.playerId}</span>} />}
                {order.playerNickname && <Row k="Apodo (según proveedor)" v={order.playerNickname} />}
                {item.region && <Row k="Región" v={regionLabel(item.region, item.regionName)} />}
                {item.sku && <Row k="Producto proveedor" v={<span className="font-mono">{item.sku}</span>} />}
                {item.costCents != null && <Row k="Costo proveedor" v={`${(item.costCents / 100).toFixed(2)} USDT`} />}
                {order.account && (
                  <Row k="Publicación" v={<Link href={`/admin/cuentas/${order.account.id}`} className="underline">{order.account.status}</Link>} />
                )}
                <Row k="Subtotal" v={formatMoney(order.subtotal, order.currency)} />
                {order.discount > 0 && <Row k={order.promoCode ? `Código ${order.promoCode}` : "Descuento"} v={`−${formatMoney(order.discount, order.currency)}`} />}
                <Row k="Total" v={<strong>{formatMoney(order.total, order.currency)}</strong>} />
              </dl>
            </Panel>
          </div>

          <Panel title="Pagos (fuente: pasarela)" bodyClass="p-0">
            {order.payments.length === 0 ? (
              <p className="p-4 text-[13px] text-fg-muted">La pasarela no ha notificado transacciones para este pedido.</p>
            ) : (
              <ul className="divide-y divide-white/[0.05] text-[13px]">
                {order.payments.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                    <span className="font-mono text-[12px] text-fg-muted">{p.providerRef}</span>
                    <span>{p.method ?? "—"}</span>
                    <span className="tabular-nums">{formatMoney(p.amount, p.currency)}</span>
                    <span className={p.status === "APPROVED" ? "text-ok-400" : p.status === "PENDING" ? "text-warn-400" : "text-bad-400"}>{PAY[p.status]}</span>
                    <span className="text-fg-subtle">{formatDate(p.updatedAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {order.delivery && (
            <Panel title="Entrega">
              <dl className="grid gap-2 text-[13px] sm:grid-cols-2">
                <Row k="Proveedor" v={order.delivery.provider} />
                <Row k="Estado" v={DEL[order.delivery.status]} />
                <Row k="Referencia" v={<span className="font-mono text-[12px]">{order.delivery.providerRef ?? "—"}</span>} />
                <Row k="Intentos" v={order.delivery.attempts} />
                <Row k="Simulada" v={order.delivery.simulated ? "Sí (DEMO)" : "No"} />
                <Row k="Clave idempotencia" v={<span className="font-mono text-[11px]">{order.delivery.idempotencyKey}</span>} />
              </dl>
              {order.delivery.lastError && <Alert tone="danger" className="mt-3">{order.delivery.lastError}</Alert>}
            </Panel>
          )}

          <Panel title="Eventos de la transacción" bodyClass="p-0">
            <ol className="divide-y divide-white/[0.05]">
              {order.events.map((e) => (
                <li key={e.id} className="px-4 py-3 text-[13px]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-white/[0.06] px-1.5 py-px font-mono text-[11px]">{e.type}</span>
                    {e.public && <span className="text-[11px] text-sky-400">visible al cliente</span>}
                    <span className="ml-auto text-[11.5px] text-fg-subtle">{formatDate(e.createdAt)}</span>
                  </div>
                  <p className="mt-1">{e.message}</p>
                  <p className="text-[11.5px] text-fg-subtle">{e.actor}</p>
                </li>
              ))}
            </ol>
          </Panel>
        </div>

        <div className="space-y-6">
          {chat.state !== "hidden" && (
            <div>
              <OrderChat key={order.id} mode="staff" endpoint={`/api/admin/chat/${order.id}`} storeName={settings.storeName} initialState={chat.state} initialMessages={chat.messages} />
              <Link href={`/admin/chats?o=${order.id}`} className="mt-2 inline-flex px-1 text-[12px] text-fg-muted hover:text-fg">
                Abrir en la bandeja de chats →
              </Link>
            </div>
          )}
          <Panel title="Operaciones">
            <div className="space-y-5">
              <div className="flex gap-2 rounded-lg border border-white/[0.06] bg-ink-900 p-3 text-[12px] text-fg-muted">
                <Info className="mt-0.5 size-4 shrink-0 text-sky-400" />
                Ningún botón puede marcar un pago como aprobado. El estado de pago solo cambia con un webhook firmado o consultando a la pasarela.
              </div>

              <ActionForm action={orderAction}>
                <input type="hidden" name="orderId" value={order.id} />
                <input type="hidden" name="op" value="reconcile" />
                <p className="mb-2 text-[13px] font-medium">Conciliar con la pasarela</p>
                <p className="mb-2 text-[12px] text-fg-muted">Consulta directamente a {order.paymentProvider} las transacciones de este pedido y aplica su resultado.</p>
                <SubmitButton variant="secondary" size="sm">
                  Consultar pasarela
                </SubmitButton>
              </ActionForm>

              {order.type === "TOPUP" && (order.status === "DELIVERY_FAILED" || (order.status === "PAID" && !order.delivery)) && (
                <ActionForm action={orderAction} className="border-t border-white/[0.06] pt-5">
                  <input type="hidden" name="orderId" value={order.id} />
                  <input type="hidden" name="op" value="retry" />
                  <p className="mb-2 text-[13px] font-medium">Reintentar entrega</p>
                  <p className="mb-2 text-[12px] text-fg-muted">Primero verifica con el proveedor la transacción anterior; solo crea una nueva si falló de forma confirmada.</p>
                  <ConfirmSubmit variant="primary" confirmText="Confirmar reintento">
                    Reintentar entrega
                  </ConfirmSubmit>
                </ActionForm>
              )}

              {order.type === "ACCOUNT" && order.status === "PROCESSING" && (
                <ActionForm action={orderAction} className="border-t border-white/[0.06] pt-5">
                  <input type="hidden" name="orderId" value={order.id} />
                  <input type="hidden" name="op" value="delivered" />
                  <p className="mb-2 text-[13px] font-medium">Registrar entrega de la cuenta</p>
                  <textarea name="note" required rows={2} defaultValue="Datos entregados por el chat de entrega." placeholder="Ej. Datos entregados por el chat, el cliente confirmó acceso." className="field mb-2 text-[13px]" />
                  <ConfirmSubmit variant="primary" confirmText="Confirmar entrega">
                    Marcar como entregada
                  </ConfirmSubmit>
                </ActionForm>
              )}

              {transitions.length > 0 && (
                <ActionForm action={orderAction} className="border-t border-white/[0.06] pt-5">
                  <input type="hidden" name="orderId" value={order.id} />
                  <input type="hidden" name="op" value="transition" />
                  <p className="mb-2 text-[13px] font-medium">Cambiar estado</p>
                  <select name="to" className="field mb-2 text-[13px]" defaultValue={transitions[0]}>
                    {transitions.map((t) => (
                      <option key={t} value={t}>
                        {ORDER_STATUS_META[t].label}
                      </option>
                    ))}
                  </select>
                  <input name="reason" required placeholder="Motivo (queda en el historial)" className="field mb-2 text-[13px]" />
                  {transitions.includes("REFUNDED") && <p className="mb-2 text-[11.5px] text-fg-subtle">Marca como reembolsado solo después de ejecutar la devolución en la pasarela.</p>}
                  <ConfirmSubmit confirmText="Confirmar cambio">Aplicar</ConfirmSubmit>
                </ActionForm>
              )}
            </div>
          </Panel>

          <Panel title="Notas internas">
            <ActionForm action={orderAction} resetOnSuccess>
              <input type="hidden" name="orderId" value={order.id} />
              <input type="hidden" name="op" value="note" />
              <textarea name="body" required rows={2} placeholder="Nota visible solo para el equipo" className="field text-[13px]" />
              <div className="mt-2">
                <SubmitButton variant="secondary" size="sm">
                  Agregar nota
                </SubmitButton>
              </div>
            </ActionForm>
            <ul className="mt-4 space-y-3">
              {order.notes.map((n) => (
                <li key={n.id} className="rounded-lg bg-ink-900 p-3 text-[13px]">
                  <p className="whitespace-pre-line">{n.body}</p>
                  <p className="mt-1 text-[11.5px] text-fg-subtle">
                    {n.author.email} · {formatDate(n.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          </Panel>

          {order.tickets.length > 0 && (
            <Panel title="Solicitudes de soporte">
              <ul className="space-y-2 text-[13px]">
                {order.tickets.map((t) => (
                  <li key={t.id}>
                    <Link href="/admin/soporte" className="hover:text-volt-300">
                      {t.topic} · {t.status}
                    </Link>
                    <p className="line-clamp-2 text-fg-muted">{t.message}</p>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-fg-muted">{k}</dt>
      <dd className="text-right">{v}</dd>
    </div>
  );
}
