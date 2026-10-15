import Link from "next/link";
import type { ListingStatus } from "@prisma/client";
import { Plus } from "lucide-react";
import { PageHeader, Table } from "@/components/admin/ui";
import { LinkButton } from "@/components/ui/button";
import { DemoBadge } from "@/components/ui/primitives";
import { ListingStatusBadge } from "@/components/ui/status";
import { LISTING_STATUS_META } from "@/domain/labels";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cuentas en venta" };

export default async function AccountsAdmin({ searchParams }: { searchParams: Promise<{ estado?: string; q?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const status = sp.estado && sp.estado in LISTING_STATUS_META ? (sp.estado as ListingStatus) : undefined;
  const accounts = await db.accountListing.findMany({
    where: { ...(status ? { status } : {}), ...(sp.q ? { title: { contains: sp.q.slice(0, 80) } } : {}) },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { images: true, claims: { where: { status: { in: ["OPEN", "REVIEWING"] } } } } } },
    take: 200,
  });
  const counts = await db.accountListing.groupBy({ by: ["status"], _count: true });

  return (
    <>
      <PageHeader
        title="Cuentas en venta"
        description="Publica solo cuentas con procedencia y autorización de venta verificadas."
        actions={
          <LinkButton href="/admin/cuentas/nueva" size="sm">
            <Plus className="size-4" /> Nueva cuenta
          </LinkButton>
        }
      />
      <div className="mb-4 flex flex-wrap gap-1.5">
        <Link href="/admin/cuentas" className={`rounded-md border px-2.5 py-1 text-[12.5px] ${!status ? "border-volt-400/50 text-fg" : "border-white/10 text-fg-muted"}`}>
          Todas
        </Link>
        {(Object.keys(LISTING_STATUS_META) as ListingStatus[]).map((s) => {
          const c = counts.find((x) => x.status === s)?._count ?? 0;
          return (
            <Link key={s} href={`/admin/cuentas?estado=${s}`} className={`rounded-md border px-2.5 py-1 text-[12.5px] ${status === s ? "border-volt-400/50 text-fg" : "border-white/10 text-fg-muted"}`}>
              {LISTING_STATUS_META[s].label} <span className="text-fg-subtle">{c}</span>
            </Link>
          );
        })}
      </div>
      <Table>
        <thead>
          <tr>
            <th>Publicación</th>
            <th>Precio</th>
            <th>Estado</th>
            <th>Verificación</th>
            <th>Actualizada</th>
          </tr>
        </thead>
        <tbody>
          {accounts.length === 0 && (
            <tr>
              <td colSpan={5} className="py-10 text-center text-fg-muted">
                No hay publicaciones.
              </td>
            </tr>
          )}
          {accounts.map((a) => (
            <tr key={a.id}>
              <td>
                <Link href={`/admin/cuentas/${a.id}`} className="flex items-center gap-2 font-medium hover:text-volt-300">
                  <span className="max-w-[340px] truncate">{a.title}</span> {a.isDemo && <DemoBadge />}
                </Link>
                <span className="text-[11.5px] text-fg-subtle">
                  {a._count.images} imagen(es){a._count.claims ? ` · ${a._count.claims} reclamación(es) abierta(s)` : ""}
                </span>
              </td>
              <td className="tabular-nums">{formatMoney(a.price)}</td>
              <td>
                <ListingStatusBadge status={a.status} />
              </td>
              <td className="text-[12px]">
                <span className={a.authorizationConfirmed ? "text-ok-400" : "text-warn-400"}>{a.authorizationConfirmed ? "Procedencia ✓" : "Procedencia pendiente"}</span>
                <br />
                <span className={a.inventoryVerified ? "text-ok-400" : "text-fg-subtle"}>{a.inventoryVerified ? "Revisada ✓" : "Sin revisar"}</span>
              </td>
              <td className="whitespace-nowrap text-fg-muted">{formatDate(a.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}
