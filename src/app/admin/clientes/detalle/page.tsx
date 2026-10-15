import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, MessageCircle } from "lucide-react";
import { Panel, Stat, Table } from "@/components/admin/ui";
import { Badge, DemoBadge } from "@/components/ui/primitives";
import { OrderStatusBadge } from "@/components/ui/status";
import { REVENUE_STATUSES, type OrderStatusValue } from "@/domain/order-status";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatMoney, formatNumber } from "@/lib/money";
import { whatsappLink } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cliente" };

export default async function CustomerDetail({ searchParams }: { searchParams: Promise<{ correo?: string }> }) {
  await requireStaff();
  const email = (await searchParams).correo?.trim().toLowerCase().slice(0, 191);
  if (!email) notFound();

  const [orders, tickets, user] = await Promise.all([
    db.order.findMany({ where: { customerEmail: email }, orderBy: { createdAt: "desc" }, take: 200 }),
    db.supportTicket.findMany({ where: { email }, orderBy: { createdAt: "desc" }, take: 50 }),
    db.user.findUnique({ where: { email }, select: { name: true, createdAt: true, role: true, disabled: true } }),
  ]);
  if (!orders.length && !tickets.length && !user) notFound();

  const sold = orders.filter((o) => (REVENUE_STATUSES as readonly OrderStatusValue[]).includes(o.status) && !o.isTest);
  const spent = sold.reduce((n, o) => n + o.total, 0);
  const name = user?.name ?? orders.find((o) => o.customerName)?.customerName ?? null;
  const phone = orders.find((o) => o.customerPhone)?.customerPhone ?? null;
  const players = [...new Set(orders.map((o) => o.playerId).filter(Boolean))] as string[];
  const wa = whatsappLink(phone, `Hola${name ? ` ${name.split(" ")[0]}` : ""}, te escribimos de la tienda.`);

  return (
    <>
      <Link href="/admin/clientes" className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-fg-muted hover:text-fg">
        <ArrowLeft className="size-4" /> Clientes
      </Link>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">{name ?? email}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-fg-muted">
            {email}
            {user ? <Badge tone="info">Registrado {formatDate(user.createdAt, false)}</Badge> : <Badge tone="neutral">Compra como invitado</Badge>}
            {user?.disabled && <Badge tone="danger">Deshabilitado</Badge>}
          </p>
        </div>
        <div className="flex gap-2">
          <a href={`mailto:${email}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white/[0.06] px-3 text-[13px] ring-1 ring-white/10 hover:bg-white/10">
            <Mail className="size-4" /> Correo
          </a>
          {wa && (
            <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-green-500/10 px-3 text-[13px] text-green-400 ring-1 ring-green-500/25">
              <MessageCircle className="size-4" /> WhatsApp
            </a>
          )}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Compras confirmadas" value={formatNumber(sold.length)} hint={`${orders.length} pedido(s) en total`} />
        <Stat label="Gasto total" value={formatMoney(spent)} hint="Excluye pedidos de prueba" />
        <Stat label="Ticket promedio" value={formatMoney(sold.length ? Math.round(spent / sold.length) : 0)} />
        <Stat label="Primera compra" value={orders.length ? formatDate(orders[orders.length - 1].createdAt, false) : "—"} hint={phone ? `Tel. ${phone}` : undefined} />
      </div>

      {players.length > 0 && (
        <p className="mb-4 text-[13px] text-fg-muted">
          IDs de jugador usados:{" "}
          {players.map((p) => (
            <span key={p} className="mr-2 rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[12px] text-fg">
              {p}
            </span>
          ))}
        </p>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Table>
          <thead>
            <tr>
              <th>Pedido</th>
              <th>Producto</th>
              <th>Total</th>
              <th>Estado</th>
              <th>Fecha</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-fg-muted">
                  Sin pedidos.
                </td>
              </tr>
            )}
            {orders.map((o) => (
              <tr key={o.id}>
                <td>
                  <Link href={`/admin/pedidos/${o.id}`} className="flex items-center gap-2 font-mono hover:text-volt-300">
                    {o.number} {o.isTest && <DemoBadge />}
                  </Link>
                </td>
                <td className="max-w-[240px] truncate">{(o.itemSnapshot as { name: string }).name}</td>
                <td className="tabular-nums">{formatMoney(o.total, o.currency)}</td>
                <td>
                  <OrderStatusBadge status={o.status} />
                </td>
                <td className="whitespace-nowrap text-fg-muted">{formatDate(o.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </Table>

        <Panel title={`Solicitudes de soporte (${tickets.length})`} bodyClass="p-0">
          {tickets.length === 0 ? (
            <p className="p-4 text-[13px] text-fg-muted">Sin solicitudes.</p>
          ) : (
            <ul className="divide-y divide-white/[0.05]">
              {tickets.map((t) => (
                <li key={t.id}>
                  <Link href={`/admin/soporte?v=todas&q=${t.id.slice(-8)}`} className="block px-4 py-3 text-[13px] hover:bg-white/[0.02]">
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-medium capitalize">{t.topic}</span>
                      <span className="text-[11.5px] text-fg-subtle">{formatDate(t.createdAt)}</span>
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-fg-muted">{t.message}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
