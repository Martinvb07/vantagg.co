import Link from "next/link";
import { ActionForm, ConfirmSubmit, SubmitButton } from "@/components/admin/action-form";
import { PageHeader } from "@/components/admin/ui";
import { Badge } from "@/components/ui/primitives";
import { ListingStatusBadge } from "@/components/ui/status";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/money";
import { claimAction } from "@/app/actions/admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reclamos" };

const META = {
  OPEN: { l: "Abierta", t: "warning" },
  REVIEWING: { l: "En revisión", t: "info" },
  UPHELD: { l: "Procedente", t: "danger" },
  DISMISSED: { l: "Descartada", t: "neutral" },
} as const;

export default async function ClaimsAdmin() {
  await requireStaff();
  const claims = await db.listingClaim.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: { account: { select: { id: true, title: true, status: true } } },
    take: 200,
  });

  return (
    <>
      <PageHeader
        title="Reclamos"
        description="Reportes sobre la procedencia o titularidad de publicaciones. Suspende la publicación mientras revisas cada caso."
      />
      {claims.length === 0 ? (
        <p className="text-sm text-fg-muted">No hay reclamaciones.</p>
      ) : (
        <ul className="space-y-3">
          {claims.map((c) => {
            const open = c.status === "OPEN" || c.status === "REVIEWING";
            return (
              <li key={c.id} className="rounded-[12px] border border-white/[0.07] bg-ink-850 p-4">
                <div className="flex flex-wrap items-center gap-3 text-[13px]">
                  <Badge tone={META[c.status].t}>{META[c.status].l}</Badge>
                  <Link href={`/admin/cuentas/${c.account.id}`} className="font-medium hover:text-volt-300">
                    {c.account.title}
                  </Link>
                  <ListingStatusBadge status={c.account.status} />
                  <span className="ml-auto text-fg-subtle">
                    {c.email} · {formatDate(c.createdAt)}
                  </span>
                </div>
                <p className="mt-3 whitespace-pre-line text-[13.5px] text-fg-muted">{c.reason}</p>
                {c.resolution && <p className="mt-2 text-[12.5px] text-fg-subtle">Resolución: {c.resolution}</p>}
                {open && (
                  <div className="mt-4 flex flex-wrap items-start gap-3 border-t border-white/[0.06] pt-4">
                    {c.status === "OPEN" && (
                      <ActionForm action={claimAction}>
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="op" value="review_suspend" />
                        <SubmitButton size="sm" variant="secondary">
                          Revisar y suspender publicación
                        </SubmitButton>
                      </ActionForm>
                    )}
                    <ActionForm action={claimAction} className="flex flex-1 flex-wrap items-start gap-2">
                      <input type="hidden" name="id" value={c.id} />
                      <input name="resolution" placeholder="Resolución (se guarda en el registro)" className="field h-8 min-w-[220px] flex-1 py-1 text-[13px]" />
                      <select name="op" className="field h-8 w-auto py-1 text-[13px]" defaultValue="uphold">
                        <option value="uphold">Procedente → retirar publicación</option>
                        <option value="dismiss">Descartar reclamación</option>
                      </select>
                      <ConfirmSubmit confirmText="Confirmar resolución">Resolver</ConfirmSubmit>
                    </ActionForm>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
