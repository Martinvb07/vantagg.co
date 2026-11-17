import Link from "next/link";
import { Download } from "lucide-react";
import { PageHeader, Table } from "@/components/admin/ui";
import { ReminderPanel } from "@/components/admin/reminders";
import { sendReminders } from "@/server/reminders";
import { Button } from "@/components/ui/button";
import { DemoBadge } from "@/components/ui/primitives";
import { OrderStatusBadge } from "@/components/ui/status";
import { ORDER_STATUSES, ORDER_STATUS_META, REVENUE_STATUSES } from "@/domain/order-status";
import { dateField, orderSort, orderWhere, type OrderFilterParams } from "@/server/admin-filters";
import { periodLabel, presetPeriod, type PresetKey } from "@/domain/accounting";
import { cn } from "@/lib/utils";
import { isTokenItem } from "@/domain/packs";
import { tokenWindow } from "@/domain/delivery-time";
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
  const [orders, total, byStatus] = await Promise.all([
    db.order.findMany({ where, orderBy: orderSort(sp), take: PAGE, skip: (page - 1) * PAGE, include: { delivery: { select: { simulated: true } } } }),
    db.order.count({ where }),
    db.order.groupBy({ by: ["status"], where, _count: { _all: true }, _sum: { total: true } }),
  ]);
  // Resumen de lo filtrado: vendido (pagos confirmados), reembolsado y sin pagar.
  const pick = (list: readonly string[]) => byStatus.filter((g) => list.includes(g.status)).reduce((a, g) => ({ n: a.n + g._count._all, cop: a.cop + (g._sum.total ?? 0) }), { n: 0, cop: 0 });
  const sold = pick(REVENUE_STATUSES);
  const refunded = pick(["REFUNDED"]);
  const unpaid = pick(["PENDING_PAYMENT", "CANCELLED"]);
  const sum = { _sum: { total: sold.cop } };
  const field = dateField(sp);
  // Atajos de fechas: conservan los demás filtros (estado, tipo, fecha de pago…).
  const keep = Object.fromEntries(Object.entries(sp).filter(([k, v]) => v && !["p", "desde", "hasta"].includes(k))) as Record<string, string>;
  const presetHref = (key: PresetKey) => {
    const r = presetPeriod(key);
    return `?${new URLSearchParams({ ...keep, desde: r.fromYmd, hasta: r.toYmd }).toString()}`;
  };
  const presets: Array<[PresetKey, string]> = [["hoy", "Hoy"], ["ayer", "Ayer"], ["semana", "Esta semana"], ["mes", "Este mes"], ["mes-pasado", "Mes pasado"]];
  const activePreset = presets.find(([k]) => { const r = presetPeriod(k); return sp.desde === r.fromYmd && sp.hasta === r.toYmd; })?.[0];
  // Recordatorios por correo (solo administradores): cuántos hay para enviar ahora (sin enviar nada).
  const reminders = viewer.role === "ADMIN" ? await sendReminders({ kinds: ["payment", "recovery"], days: 30, dryRun: true }).catch(() => null) : null;
  const inWindow = (d: number) => reminders?.recovery.ages.filter((a) => a < d).length ?? 0;
  const exportQs = new URLSearchParams(Object.entries(sp).filter(([k, v]) => k !== "p" && v) as [string, string][]).toString();
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date()); // AAAA-MM-DD en Colombia
  const qs = (p: number) => new URLSearchParams({ ...(sp as Record<string, string>), p: String(p) }).toString();

  return (
    <>
      <PageHeader
        title="Pedidos"
        description={`${total} pedido(s) · ${formatMoney(sum._sum.total ?? 0)} en ventas confirmadas con estos filtros${sp.desde || sp.hasta ? ` · ${field === "paidAt" ? "pagados" : field === "deliveredAt" ? "entregados" : "creados"} ${sp.desde && sp.hasta ? periodLabel(sp.desde, sp.hasta) : sp.desde ? `desde ${sp.desde}` : `hasta ${sp.hasta}`}` : ""}`}
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
      {reminders && <ReminderPanel pending={reminders.payment.candidates} recovery={{ 7: inWindow(7), 14: inWindow(14), 30: inWindow(30) }} />}
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
        <select name="tipo" defaultValue={sp.tipo ?? ""} className="field sm:w-[200px]" aria-label="Tipo">
          <option value="">Todos los tipos</option>
          <option value="TOPUP">Recargas (todas)</option>
          <option value="RECARGAS">Diamantes, tarjetas y pases</option>
          <option value="TOKENS">Fragmentos y cajas Evo</option>
          <option value="ACCOUNT">Cuentas</option>
        </select>
        <select name="orden" defaultValue={sp.orden === "actividad" ? "actividad" : ""} className="field sm:w-[165px]" aria-label="Ordenar">
          <option value="">Más recientes</option>
          <option value="actividad">Última actividad</option>
        </select>
        <select name="fecha" defaultValue={sp.fecha === "pagado" || sp.fecha === "entregado" ? sp.fecha : ""} className="field sm:w-[190px]" aria-label="Buscar por fecha de">
          <option value="">Por fecha de compra</option>
          <option value="pagado">Por fecha de pago</option>
          <option value="entregado">Por fecha de entrega</option>
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
      {/* Atajos de fechas y resumen de lo filtrado. Enlaces normales (carga completa): el listado siempre trae los datos al día. */}
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <nav aria-label="Fechas rápidas" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
          {presets.map(([k, label]) => (
            <a key={k} href={presetHref(k)} aria-current={activePreset === k ? "page" : undefined} className={cn("inline-flex h-8 shrink-0 items-center rounded-full px-3 text-[12.5px] font-medium ring-1", activePreset === k ? "bg-fg text-ink-950 ring-fg" : "text-fg-muted ring-white/10 hover:text-fg")}>
              {label}
            </a>
          ))}
          {(sp.desde || sp.hasta) && (
            <a href={`?${new URLSearchParams(keep).toString()}`} className="inline-flex h-8 shrink-0 items-center rounded-full px-3 text-[12.5px] text-fg-subtle hover:text-fg">
              Quitar fechas
            </a>
          )}
        </nav>
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-fg-muted">
          <span>
            Vendido <b className="text-fg">{formatMoney(sold.cop)}</b> ({sold.n})
          </span>
          {refunded.n > 0 && (
            <span>
              Reembolsado <b className="text-fg">{formatMoney(refunded.cop)}</b> ({refunded.n})
            </span>
          )}
          {unpaid.n > 0 && <span>Sin pagar o cancelados: {unpaid.n}</span>}
          {viewer.role === "ADMIN" && (sp.desde || sp.hasta) && (
            <a href={`/admin/contabilidad?desde=${sp.desde || sp.hasta}&hasta=${sp.hasta || today}`} className="text-volt-300 underline underline-offset-2">
              Ver contabilidad de estas fechas
            </a>
          )}
        </p>
      </div>

      <Table>
        <thead>
          <tr>
            <th>Pedido</th>
            <th>Producto</th>
            <th>Comprador</th>
            <th>Total</th>
            <th>Estado</th>
            <th>Creado</th>
            <th>Pagado</th>
          </tr>
        </thead>
        <tbody>
          {orders.length === 0 && (
            <tr>
              <td colSpan={7} className="py-10 text-center text-fg-muted">
                No hay pedidos con esos filtros.
              </td>
            </tr>
          )}
          {orders.map((o) => (
            <tr key={o.id}>
              <td>
                <Link href={`/admin/pedidos/${o.id}`} className="flex items-center gap-2 whitespace-nowrap font-mono font-medium hover:text-volt-300">
                  {o.number} {o.isTest && <DemoBadge />}
                </Link>
              </td>
              <td className="max-w-[260px] truncate">
                <span className={cn("mr-1.5 text-[11px] uppercase", isTokenItem(o.itemSnapshot) ? "text-violet-300" : "text-fg-subtle")}>{o.type !== "TOPUP" ? "Cuenta" : isTokenItem(o.itemSnapshot) ? "Evo · 24 h" : "Recarga"}</span>
                {(o.itemSnapshot as { name: string }).name}
              </td>
              <td className="text-fg-muted">
                {o.customerEmail}
                {o.playerId && <span className="block font-mono text-[11.5px] text-fg-subtle">ID {o.playerId}</span>}
              </td>
              <td className="tabular-nums">{formatMoney(o.total, o.currency)}</td>
              <td>
                <OrderStatusBadge status={o.status} simulated={o.delivery?.simulated} />
                {/* Fragmentos y cajas Evo pagados y sin entregar: cuánto queda de su plazo de 24 h. */}
                {(() => {
                  if (!o.paidAt || !["PAID", "PROCESSING", "DELIVERY_FAILED"].includes(o.status) || !isTokenItem(o.itemSnapshot)) return null;
                  const w = tokenWindow(o.paidAt);
                  return <span className={cn("mt-1 block whitespace-nowrap text-[11.5px]", w.overdue ? "font-semibold text-bad-400" : "text-fg-muted")}>{w.label}</span>;
                })()}
              </td>
              <td className="whitespace-nowrap text-fg-muted">
                {formatDate(o.createdAt)}
                {/* Lo último que pasó, si fue más de una hora después de crearse (p. ej. una entrega demorada o un pedido cancelado). */}
                {(() => {
                  const last = o.deliveredAt ? (["Entregado", o.deliveredAt] as const) : o.cancelledAt ? (["Cancelado", o.cancelledAt] as const) : null;
                  return last && last[1].getTime() - o.createdAt.getTime() > 3600_000 ? (
                    <span className={`block text-[11.5px] ${last[0] === "Cancelado" ? "text-fg-subtle" : "text-volt-300"}`}>
                      {last[0]} {formatDate(last[1])}
                    </span>
                  ) : null;
                })()}
              </td>
              <td className="whitespace-nowrap text-fg-muted">
                {o.paidAt ? formatDate(o.paidAt) : "—"}
                {o.refundedAt && <span className="block text-[11.5px] text-warn-400">Reembolsado el {formatDate(o.refundedAt, false)}</span>}
              </td>
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
              <a href={`?${qs(page - 1)}`} className="rounded-md border border-white/10 px-3 py-1.5 hover:border-white/20">
                Anterior
              </a>
            )}
            {page < pages && (
              <a href={`?${qs(page + 1)}`} className="rounded-md border border-white/10 px-3 py-1.5 hover:border-white/20">
                Siguiente
              </a>
            )}
          </div>
        </nav>
      )}
    </>
  );
}
