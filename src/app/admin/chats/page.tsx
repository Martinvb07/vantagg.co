import Link from "next/link";
import { ExternalLink, MessagesSquare, PackageCheck } from "lucide-react";
import { ActionForm, ConfirmSubmit } from "@/components/admin/action-form";
import { PageHeader } from "@/components/admin/ui";
import { AutoRefresh } from "@/components/orders/order-live";
import { OrderChat } from "@/components/orders/order-chat";
import { DemoBadge } from "@/components/ui/primitives";
import { OrderStatusBadge } from "@/components/ui/status";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatMoney } from "@/lib/money";
import { openText } from "@/lib/secure-box";
import { cn, whatsappLink } from "@/lib/utils";
import { chatState, listMessages, markRead } from "@/server/chat";
import { getSettings } from "@/server/settings";
import { orderAction } from "@/app/actions/admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Entregar cuentas" };

const TO_DELIVER = ["PAID", "PROCESSING"] as const;

export default async function ChatsPage({ searchParams }: { searchParams: Promise<{ o?: string; f?: string }> }) {
  await requireStaff();
  const { o, f } = await searchParams;
  const onlyPending = f === "entregar";

  const baseWhere = { type: "ACCOUNT" as const, chatLastAt: { not: null } };
  const [orders, pendingCount, settings] = await Promise.all([
    db.order.findMany({
      where: onlyPending ? { ...baseWhere, OR: [{ status: { in: [...TO_DELIVER] } }, { chatUnreadStaff: { gt: 0 } }] } : baseWhere,
      orderBy: [{ chatUnreadStaff: "desc" }, { chatLastAt: "desc" }],
      take: 60,
      select: {
        id: true,
        number: true,
        status: true,
        isTest: true,
        customerEmail: true,
        customerName: true,
        itemSnapshot: true,
        chatUnreadStaff: true,
        chatLastAt: true,
        messages: { orderBy: { createdAt: "desc" }, take: 1, select: { author: true, body: true, attachmentId: true } },
      },
    }),
    db.order.count({ where: { ...baseWhere, status: { in: [...TO_DELIVER] } } }),
    getSettings(),
  ]);

  const selectedId = o ?? orders[0]?.id;
  if (selectedId) await markRead(selectedId, "staff");
  const selected = selectedId
    ? await db.order.findUnique({
        where: { id: selectedId },
        select: { id: true, type: true, number: true, status: true, isTest: true, deliveredAt: true, total: true, currency: true, customerEmail: true, customerName: true, customerPhone: true, itemSnapshot: true, paidAt: true },
      })
    : null;
  const messages = selected && selected.type === "ACCOUNT" ? await listMessages(selected.id) : [];
  const wa = selected ? whatsappLink(selected.customerPhone, `Hola ${selected.customerName ?? ""}, te escribimos sobre tu pedido ${selected.number}.`) : null;
  const tab = (key: string | undefined, label: string, count?: number) => (
    <Link
      href={`/admin/chats${key ? `?f=${key}` : ""}`}
      className={cn("inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium", (key === "entregar") === onlyPending ? "bg-white/[0.09] text-fg" : "text-fg-muted hover:text-fg")}
    >
      {label}
      {count != null && count > 0 && <span className="rounded-full bg-volt-400/15 px-1.5 text-[11px] font-semibold text-volt-300">{count}</span>}
    </Link>
  );

  return (
    <>
      <PageHeader
        title="Entregar cuentas"
        description="Entrega aquí las cuentas vendidas. Los diamantes se entregan solos y no usan chat."
        actions={<AutoRefresh active intervalMs={8000} maxTicks={Number.POSITIVE_INFINITY} label="En vivo" />}
      />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
        {/* Bandeja */}
        <aside aria-label="Conversaciones" className="overflow-hidden rounded-[16px] bg-ink-850 ring-1 ring-white/[0.07] lg:self-start">
          <div className="flex gap-1 border-b border-white/[0.06] p-2">
            {tab(undefined, "Todos")}
            {tab("entregar", "Por entregar", pendingCount)}
          </div>
          {orders.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <MessagesSquare className="mx-auto size-6 text-fg-subtle" />
              <p className="mt-2 text-[13.5px] font-semibold">{onlyPending ? "Nada por entregar" : "Aún no hay chats"}</p>
              <p className="mt-1 text-[12.5px] text-fg-muted">Cuando se pague un pedido de cuenta, aparecerá aquí.</p>
            </div>
          ) : (
            <ul className="max-h-[70vh] divide-y divide-white/[0.05] overflow-y-auto">
              {orders.map((ord) => {
                const last = ord.messages[0];
                const text = last ? openText(last.body) ?? "" : "";
                const preview = last ? `${last.author === "STAFF" ? "Tú: " : ""}${last.attachmentId ? `📷 Imagen${text ? ` · ${text}` : ""}` : text}` : "";
                const active = ord.id === selectedId;
                return (
                  <li key={ord.id}>
                    <Link href={`/admin/chats?o=${ord.id}${onlyPending ? "&f=entregar" : ""}`} className={cn("block px-4 py-3 transition-colors", active ? "bg-white/[0.06]" : "hover:bg-white/[0.03]")}>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[12.5px] font-semibold tracking-wider">{ord.number}</span>
                        {ord.isTest && <DemoBadge />}
                        {ord.chatUnreadStaff > 0 && <span className="ml-auto grid min-w-5 place-items-center rounded-full bg-volt-400 px-1.5 text-[11px] font-bold text-volt-ink">{ord.chatUnreadStaff}</span>}
                      </div>
                      <p className="mt-0.5 truncate text-[13px] font-medium">{(ord.itemSnapshot as { name?: string }).name ?? "Cuenta"}</p>
                      <p className="truncate text-[12px] text-fg-subtle">{preview.replace(/\s+/g, " ").slice(0, 80) || ord.customerEmail}</p>
                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <OrderStatusBadge status={ord.status} />
                        {ord.chatLastAt && <span className="text-[11px] text-fg-subtle">{formatDate(ord.chatLastAt)}</span>}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        {/* Conversación */}
        {selected && selected.type === "ACCOUNT" ? (
          <div className="min-w-0 space-y-4">
            <div className="flex flex-col gap-3 rounded-[16px] bg-ink-850 p-4 ring-1 ring-white/[0.07] sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-[15px] font-bold">
                  {(selected.itemSnapshot as { name?: string }).name ?? "Cuenta"} {selected.isTest && <DemoBadge />}
                </p>
                <p className="mt-0.5 text-[12.5px] text-fg-muted">
                  {selected.customerName ? `${selected.customerName} · ` : ""}
                  {selected.customerEmail} · {formatMoney(selected.total, selected.currency)}
                  {selected.paidAt && ` · pagado ${formatDate(selected.paidAt)}`}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-[12.5px]">
                  <OrderStatusBadge status={selected.status} />
                  <Link href={`/admin/pedidos/${selected.id}`} className="inline-flex items-center gap-1 text-fg-muted hover:text-fg">
                    {selected.number} <ExternalLink className="size-3.5" />
                  </Link>
                  {wa && (
                    <a href={wa} target="_blank" rel="noopener noreferrer" className="text-ok-400 hover:underline">
                      WhatsApp
                    </a>
                  )}
                </div>
              </div>
              {selected.status === "PROCESSING" && (
                <ActionForm action={orderAction} className="flex shrink-0 items-center gap-2">
                  <input type="hidden" name="orderId" value={selected.id} />
                  <input type="hidden" name="op" value="delivered" />
                  <input type="hidden" name="note" value="Datos entregados por el chat de entrega." />
                  <ConfirmSubmit variant="primary" confirmText="Confirmar entrega">
                    <PackageCheck className="size-4" /> Marcar entregada
                  </ConfirmSubmit>
                </ActionForm>
              )}
            </div>
            <OrderChat
              key={selected.id}
              mode="staff"
              endpoint={`/api/admin/chat/${selected.id}`}
              storeName={settings.storeName}
              initialState={chatState(selected)}
              initialMessages={messages}
            />
            <p className="px-1 text-[12px] text-fg-subtle">Los mensajes se guardan cifrados. Marca la entrega cuando el comprador confirme que pudo entrar a la cuenta.</p>
          </div>
        ) : (
          <div className="grid min-h-[300px] place-items-center rounded-[16px] bg-ink-850/50 text-[13px] text-fg-muted ring-1 ring-white/[0.05]">Selecciona un chat de la bandeja.</div>
        )}
      </div>
    </>
  );
}
