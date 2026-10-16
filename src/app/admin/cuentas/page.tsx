import Link from "next/link";
import type { ListingStatus } from "@prisma/client";
import { CircleCheck, ExternalLink, ImageOff, Pencil, Plus } from "lucide-react";
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

export default async function AccountsAdmin({ searchParams }: { searchParams: Promise<{ estado?: string; q?: string; publicada?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const status = sp.estado && sp.estado in LISTING_STATUS_META ? (sp.estado as ListingStatus) : undefined;
  const accounts = await db.accountListing.findMany({
    where: { ...(status ? { status } : {}), ...(sp.q ? { title: { contains: sp.q.slice(0, 80) } } : {}) },
    orderBy: { updatedAt: "desc" },
    include: {
      images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
      _count: { select: { images: true, claims: { where: { status: { in: ["OPEN", "REVIEWING"] } } } } },
    },
    take: 200,
  });
  const counts = await db.accountListing.groupBy({ by: ["status"], _count: true });

  return (
    <>
      <PageHeader
        title="Cuentas en venta"
        description="Agrega fotos, título, descripción y precio, y publícala en un paso."
        actions={
          <LinkButton href="/admin/cuentas/nueva" size="sm">
            <Plus className="size-4" /> Nueva cuenta
          </LinkButton>
        }
      />
      {sp.publicada && (
        <div role="status" className="mb-5 flex flex-col gap-3 rounded-[14px] border border-ok-400/25 bg-ok-400/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2.5 text-[13.5px]">
            <CircleCheck className="mt-0.5 size-5 shrink-0 text-ok-400" />
            <span>
              <strong className="font-semibold text-fg">«{sp.publicada.slice(0, 80)}»</strong> <span className="text-fg-muted">quedó publicada y ya está a la venta.</span>
            </span>
          </p>
          <LinkButton href="/admin/cuentas/nueva" size="sm" className="shrink-0">
            <Plus className="size-4" /> Agregar otra
          </LinkButton>
        </div>
      )}
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
            <th>Origen</th>
            <th>Actualizada</th>
            <th className="w-px" />
          </tr>
        </thead>
        <tbody>
          {accounts.length === 0 && (
            <tr>
              <td colSpan={6} className="py-10 text-center text-fg-muted">
                No hay publicaciones.
              </td>
            </tr>
          )}
          {accounts.map((a) => (
            // Toda la fila abre el editor (el enlace del título se extiende sobre la fila).
            <tr key={a.id} className="relative cursor-pointer">
              <td>
                <div className="flex items-center gap-3">
                  <span className="relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-lg bg-ink-750 ring-1 ring-white/[0.08]">
                    {a.images[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.images[0].url} alt="" className="size-full object-cover" />
                    ) : (
                      <ImageOff className="size-4 text-fg-subtle" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <Link href={`/admin/cuentas/${a.id}`} className="flex items-center gap-2 font-medium after:absolute after:inset-0 hover:text-volt-300">
                      <span className="max-w-[320px] truncate">{a.title}</span> {a.isDemo && <DemoBadge />}
                    </Link>
                    <span className="text-[11.5px] text-fg-subtle">
                      {a._count.images} foto(s){a._count.claims ? ` · ${a._count.claims} reclamación(es) abierta(s)` : ""}
                    </span>
                  </span>
                </div>
              </td>
              <td className="tabular-nums">{formatMoney(a.price)}</td>
              <td>
                <ListingStatusBadge status={a.status} />
              </td>
              <td className="max-w-[200px] truncate text-[12.5px]" title={a.provenanceSource ?? undefined}>
                {a.provenanceSource ? <span className="text-fg-muted">{a.provenanceSource}</span> : <span className="text-fg-subtle">Sin anotar</span>}
              </td>
              <td className="whitespace-nowrap text-fg-muted">{formatDate(a.updatedAt)}</td>
              <td>
                <div className="relative z-10 flex items-center justify-end gap-1.5">
                  {["PUBLISHED", "RESERVED", "SOLD"].includes(a.status) && (
                    <Link href={`/cuentas/${a.slug}`} target="_blank" title="Ver en la tienda" className="grid size-8 place-items-center rounded-lg text-fg-muted transition-colors hover:bg-white/[0.06] hover:text-fg">
                      <ExternalLink className="size-4" />
                      <span className="sr-only">Ver en la tienda</span>
                    </Link>
                  )}
                  <Link href={`/admin/cuentas/${a.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-white/[0.06] px-3 text-[12.5px] font-medium ring-1 ring-white/10 transition-colors hover:bg-white/10">
                    <Pencil className="size-3.5" /> Editar
                  </Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}
