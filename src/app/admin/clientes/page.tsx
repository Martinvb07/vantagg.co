import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Download, Search } from "lucide-react";
import { PageHeader, Stat, Table } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { REVENUE_STATUSES } from "@/domain/order-status";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatMoney, formatNumber } from "@/lib/money";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Clientes" };

const SORTS = {
  reciente: "Última compra",
  gasto: "Mayor gasto",
  pedidos: "Más pedidos",
} as const;

/** Clientes agrupados por correo de compra (con o sin cuenta en la tienda). */
export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; orden?: string; prueba?: string }> }) {
  const viewer = await requireStaff();
  const sp = await searchParams;
  const q = sp.q?.trim().toLowerCase().slice(0, 80);
  const sort = (sp.orden && sp.orden in SORTS ? sp.orden : "reciente") as keyof typeof SORTS;
  const base: Prisma.OrderWhereInput = { ...(q ? { customerEmail: { contains: q } } : {}), ...(sp.prueba === "0" ? { isTest: false } : {}) };

  const [all, paid] = await Promise.all([
    db.order.groupBy({ by: ["customerEmail"], where: base, _count: { _all: true }, _max: { createdAt: true }, orderBy: { _max: { createdAt: "desc" } }, take: 1000 }),
    db.order.groupBy({ by: ["customerEmail"], where: { ...base, status: { in: [...REVENUE_STATUSES] } }, _count: { _all: true }, _sum: { total: true }, orderBy: { _sum: { total: "desc" } }, take: 1000 }),
  ]);
  const paidBy = new Map(paid.map((p) => [p.customerEmail, p]));
  const rows = all.map((a) => {
    const p = paidBy.get(a.customerEmail);
    return { email: a.customerEmail, orders: a._count._all, purchases: p?._count._all ?? 0, spent: p?._sum.total ?? 0, last: a._max.createdAt };
  });
  rows.sort((a, b) => (sort === "gasto" ? b.spent - a.spent : sort === "pedidos" ? b.purchases - a.purchases : (b.last?.getTime() ?? 0) - (a.last?.getTime() ?? 0)));

  const buyers = rows.filter((r) => r.purchases > 0);
  const totalSpent = buyers.reduce((n, r) => n + r.spent, 0);
  const repeat = buyers.filter((r) => r.purchases > 1).length;
  const users = new Set((await db.user.findMany({ where: { email: { in: rows.slice(0, 300).map((r) => r.email) } }, select: { email: true } })).map((u) => u.email));
  const href = (o: string) => `/admin/clientes?${new URLSearchParams({ ...(q ? { q } : {}), ...(sp.prueba ? { prueba: sp.prueba } : {}), orden: o })}`;

  return (
    <>
      <PageHeader
        title="Clientes"
        description="Agrupados por el correo con el que compraron."
        actions={
          viewer.role === "ADMIN" && (
            <a
              href={`/api/admin/export/clientes${sp.prueba === "0" ? "?prueba=0" : ""}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white/[0.06] px-3 text-[13px] font-medium ring-1 ring-white/10 hover:bg-white/10"
            >
              <Download className="size-4" /> Exportar CSV
            </a>
          )
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Clientes con compra" value={formatNumber(buyers.length)} hint={`${formatNumber(rows.length)} correos en total`} />
        <Stat label="Clientes que repiten" value={formatNumber(repeat)} hint={buyers.length ? `${Math.round((repeat / buyers.length) * 100)}% de los compradores` : "—"} />
        <Stat label="Gasto total" value={formatMoney(totalSpent)} hint="Pagos confirmados" />
        <Stat label="Gasto promedio" value={formatMoney(buyers.length ? Math.round(totalSpent / buyers.length) : 0)} hint="Por cliente con compra" />
      </div>

      <form method="get" className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <input type="hidden" name="orden" value={sort} />
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
          <input name="q" defaultValue={q} placeholder="Buscar por correo" className="field pl-9" aria-label="Buscar clientes" />
        </div>
        <label className="flex items-center gap-2 px-1 text-[13px] text-fg-muted">
          <input type="checkbox" name="prueba" value="0" defaultChecked={sp.prueba === "0"} className="size-4 accent-[#c8f04f]" /> Ocultar pedidos de prueba
        </label>
        <Button type="submit" variant="secondary">
          Filtrar
        </Button>
      </form>

      <div className="mb-3 flex gap-1 text-[12.5px]">
        {Object.entries(SORTS).map(([k, l]) => (
          <Link key={k} href={href(k)} className={cn("rounded-full px-3 py-1.5", sort === k ? "bg-white/[0.09] font-medium text-fg" : "text-fg-muted hover:text-fg")}>
            {l}
          </Link>
        ))}
      </div>

      <Table>
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Compras</th>
            <th>Pedidos</th>
            <th>Gasto</th>
            <th>Última actividad</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="py-10 text-center text-fg-muted">
                {q ? "Ningún cliente coincide con la búsqueda." : "Aún no hay clientes."}
              </td>
            </tr>
          )}
          {rows.slice(0, 300).map((r) => (
            <tr key={r.email}>
              <td>
                <Link href={`/admin/clientes/detalle?correo=${encodeURIComponent(r.email)}`} className="font-medium hover:text-volt-300">
                  {r.email}
                </Link>
                {users.has(r.email) && <span className="ml-2 rounded bg-sky-400/12 px-1.5 py-px text-[10.5px] font-semibold text-sky-300">Registrado</span>}
                {r.purchases > 1 && <span className="ml-1.5 rounded bg-volt-400/12 px-1.5 py-px text-[10.5px] font-semibold text-volt-300">Recurrente</span>}
              </td>
              <td className="tabular-nums">{r.purchases}</td>
              <td className="tabular-nums text-fg-muted">{r.orders}</td>
              <td className="font-medium tabular-nums">{formatMoney(r.spent)}</td>
              <td className="whitespace-nowrap text-fg-muted">{r.last ? formatDate(r.last) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      {rows.length > 300 && <p className="mt-3 text-[12px] text-fg-subtle">Se muestran 300 de {rows.length}. Usa la búsqueda o exporta el CSV.</p>}
    </>
  );
}
