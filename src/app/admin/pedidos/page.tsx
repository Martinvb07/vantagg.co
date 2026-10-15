import Link from "next/link";
import { Download } from "lucide-react";
import { PageHeader, Table } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { DemoBadge } from "@/components/ui/primitives";
import { OrderStatusBadge } from "@/components/ui/status";
import { ORDER_STATUSES, ORDER_STATUS_META, REVENUE_STATUSES } from "@/domain/order-status";
import { orderWhere, type OrderFilterParams } from "@/server/admin-filters";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pedidos" };
const PAGE = 30;

export default async function OrdersPage({ searchParams }: { searchParams: Promise<OrderFilterParams & { p?: string }> }) {
  const viewer = await requireStaff();
  const sp = await searchParams;
  const q = sp.q?.trim().slice(0, 80);
  const page = Math.max(1, Number(sp.p) || 1);
  const where = orderWhere(sp);
  const [orders, total, sum] = await Promise.all([
    db.order.findMany({ where, orderBy: { createdAt: "desc" }, take: PAGE, skip: (page - 1) * PAGE, include: { delivery: { select: { simulated: true } } } }),
    db.order.count({ where }),
    db.order.aggregate({ where: { ...where, status: { in: [...REVENUE_STATUSES] } }, _sum: { total: true } }),
  ]);
  const exportQs = new URLSearchParams(Object.entries(sp).filter(([k, v]) => k !== "p" && v) as [string, string][]).toString();
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const qs = (p: number) => new URLSearchParams({ ...(sp as Record<string, string>), p: String(p) }).toString();

  return (
    <>
      <PageHeader
        title="Pedidos"
        description={`${total} pedido(s) · ${formatMoney(sum._sum.total ?? 0)} en ventas confirmadas con estos filtros`}
        actions={
          viewer.role === "ADMIN" && (
            <a
              href={`/api/admin/export/pedidos${exportQs ? `?${exportQs}` : ""}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white/[0.06] px-3 text-[13px] font-medium ring-1 ring-white/10 hover:bg-white/10"
            >
              <Download className="size-4" /> Exportar CSV
            </a>
          )
        }
      />
      <form method="get" className="mb-4 flex flex-wrap items-center gap-2">
        <input name="q" defaultValue={q} placeholder="Número, correo o ID de jugador" className="field sm:w-auto sm:min-w-[220px] sm:flex-1" aria-label="Buscar pedidos" />
        <select name="estado" defaultValue={sp.estado ?? ""} className="field sm:w-[180px]" aria-label="Estado">
          <option value="">Todos los estados</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {ORDER_STATUS_META[s].label}
            </option>
          ))}
        </select>
        <select name="tipo" defaultValue={sp.tipo ?? ""} className="field sm:w-[165px]" aria-label="Tipo">
          <option value="">Todos los tipos</option>
          <option value="TOPUP">Recargas</option>
          <option value="ACCOUNT">Cuentas</option>
        </select>
        <input type="date" name="desde" defaultValue={sp.desde} className="field sm:w-[150px]" aria-label="Desde" title="Desde" />
        <input type="date" name="hasta" defaultValue={sp.hasta} className="field sm:w-[150px]" aria-label="Hasta" title="Hasta" />
        <label className="flex items-center gap-2 px-1 text-[13px] text-fg-muted">
          <input type="checkbox" name="prueba" value="0" defaultChecked={sp.prueba === "0"} className="size-4 accent-[#c8f04f]" /> Ocultar prueba
        </label>
        <Button type="submit" variant="secondary">
          Filtrar
        </Button>
      </form>

      <Table>
        <thead>
          <tr>
            <th>Pedido</th>
            <th>Producto</th>
            <th>Comprador</th>
            <th>Total</th>
            <th>Estado</th>
            <th>Creado</th>
          </tr>
        </thead>
        <tbody>
          {orders.length === 0 && (
            <tr>
              <td colSpan={6} className="py-10 text-center text-fg-muted">
                No hay pedidos con esos filtros.
              </td>
            </tr>
          )}
          {orders.map((o) => (
            <tr key={o.id}>
              <td>
                <Link href={`/admin/pedidos/${o.id}`} className="flex items-center gap-2 font-mono font-medium hover:text-volt-300">
                  {o.number} {o.isTest && <DemoBadge />}
                </Link>
              </td>
              <td className="max-w-[260px] truncate">
                <span className="mr-1.5 text-[11px] uppercase text-fg-subtle">{o.type === "TOPUP" ? "Recarga" : "Cuenta"}</span>
                {(o.itemSnapshot as { name: string }).name}
              </td>
              <td className="text-fg-muted">
                {o.customerEmail}
                {o.playerId && <span className="block font-mono text-[11.5px] text-fg-subtle">ID {o.playerId}</span>}
              </td>
              <td className="tabular-nums">{formatMoney(o.total, o.currency)}</td>
              <td>
                <OrderStatusBadge status={o.status} simulated={o.delivery?.simulated} />
              </td>
              <td className="whitespace-nowrap text-fg-muted">{formatDate(o.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </Table>

      {pages > 1 && (
        <nav className="mt-4 flex items-center justify-between text-[13px]" aria-label="Paginación">
          <span className="text-fg-muted">
            Página {page} de {pages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={`?${qs(page - 1)}`} className="rounded-md border border-white/10 px-3 py-1.5 hover:border-white/20">
                Anterior
              </Link>
            )}
            {page < pages && (
              <Link href={`?${qs(page + 1)}`} className="rounded-md border border-white/10 px-3 py-1.5 hover:border-white/20">
                Siguiente
              </Link>
            )}
          </div>
        </nav>
      )}
    </>
  );
}
