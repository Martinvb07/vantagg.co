import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { AccountListing, ListingStatus } from "@prisma/client";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { ActionForm, ConfirmSubmit, SubmitButton } from "@/components/admin/action-form";
import { Check, Field, Panel } from "@/components/admin/ui";
import { Alert, DemoBadge } from "@/components/ui/primitives";
import { ListingStatusBadge, OrderStatusBadge } from "@/components/ui/status";
import { LISTING_STATUS_META, PRODUCT_LABELS, publishBlockers } from "@/domain/labels";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/money";
import { FF_RANKS, FF_REGIONS } from "@/domain/freefire";
import { EmailStatusPicker } from "@/components/admin/email-status-picker";
import { imageAction, saveAccountAction, setListingStatusAction } from "@/app/actions/admin";
import { ImagePicker } from "@/components/admin/image-picker";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cuenta" };

const NEXT_STATUSES: Partial<Record<ListingStatus, Array<{ to: ListingStatus; label: string; danger?: boolean }>>> = {
  DRAFT: [{ to: "PENDING_REVIEW", label: "Enviar a revisión" }, { to: "PUBLISHED", label: "Publicar" }, { to: "RETIRED", label: "Retirar", danger: true }],
  PENDING_REVIEW: [{ to: "PUBLISHED", label: "Publicar" }, { to: "RETIRED", label: "Retirar", danger: true }],
  PUBLISHED: [{ to: "PAUSED", label: "Pausar" }, { to: "SUSPENDED", label: "Suspender", danger: true }, { to: "RETIRED", label: "Retirar", danger: true }],
  PAUSED: [{ to: "PUBLISHED", label: "Reactivar" }, { to: "SUSPENDED", label: "Suspender", danger: true }, { to: "RETIRED", label: "Retirar", danger: true }],
  SUSPENDED: [{ to: "PUBLISHED", label: "Reactivar" }, { to: "RETIRED", label: "Retirar", danger: true }],
  RESERVED: [{ to: "SUSPENDED", label: "Suspender", danger: true }],
};

export default async function AccountEditor({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ creada?: string }> }) {
  await requireAdmin();
  const [{ id }, { creada }] = await Promise.all([params, searchParams]);
  const isNew = id === "nueva";
  const a = isNew
    ? null
    : await db.accountListing.findUnique({
        where: { id },
        include: {
          images: { orderBy: { sortOrder: "asc" } },
          tags: true,
          claims: { orderBy: { createdAt: "desc" } },
          orders: { orderBy: { createdAt: "desc" }, take: 10 },
        },
      });
  if (!isNew && !a) notFound();

  const openClaims = a?.claims.filter((c) => c.status === "OPEN" || c.status === "REVIEWING").length ?? 0;
  const blockers = a
    ? publishBlockers({
        imagesCount: a.images.length,
        openClaims,
      })
    : [];

  return (
    <>
      <Link href="/admin/cuentas" className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-fg-muted hover:text-fg">
        <ArrowLeft className="size-4" /> Cuentas
      </Link>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="flex items-center gap-3 font-display text-2xl font-semibold">
          {a ? a.title : "Nueva cuenta"} {a?.isDemo && <DemoBadge />}
        </h1>
        {a && (
          <div className="flex items-center gap-3">
            <ListingStatusBadge status={a.status} />
            {["PUBLISHED", "RESERVED", "SOLD"].includes(a.status) && (
              <Link href={`/cuentas/${a.slug}`} target="_blank" className="inline-flex items-center gap-1 text-[12.5px] text-fg-muted hover:text-fg">
                Ver en tienda <ExternalLink className="size-3.5" />
              </Link>
            )}
          </div>
        )}
      </div>
      {creada === "publicada" && <Alert tone="success" className="mb-6" title="Cuenta publicada">Ya está a la venta en la tienda.</Alert>}
      {creada === "1" && <Alert tone="success" className="mb-6" title="Borrador creado">{a && a.images.length ? "Publícala cuando quieras desde «Publicación»." : "Agrega al menos una foto para poder publicarla."}</Alert>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Panel title="Ficha del producto">
          <AccountForm a={a} tags={a?.tags.map((t) => t.tag) ?? []} imagesCount={a?.images.length ?? 0} />
        </Panel>

        <div className="space-y-6">
          {a && (
            <Panel title="Publicación">
              {blockers.length > 0 && a.status !== "SOLD" && a.status !== "RETIRED" && (
                <div className="mb-4 rounded-lg border border-warn-400/25 bg-warn-400/[0.06] p-3 text-[12.5px]">
                  <p className="mb-1 font-medium text-warn-400">Antes de publicar:</p>
                  <ul className="list-disc space-y-0.5 pl-4 text-fg-muted">
                    {blockers.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                </div>
              )}
              {a.status === "RESERVED" && a.reservedUntil && <p className="mb-3 text-[12.5px] text-fg-muted">Reservada hasta {formatDate(a.reservedUntil)} por un checkout en curso.</p>}
              {a.status === "SOLD" && <p className="text-[13px] text-fg-muted">Vendida el {a.soldAt ? formatDate(a.soldAt) : "—"}. No admite cambios de estado.</p>}
              <div className="flex flex-wrap gap-2">
                {(NEXT_STATUSES[a.status] ?? []).map((s) => (
                  <ActionForm key={s.to} action={setListingStatusAction}>
                    <input type="hidden" name="id" value={a.id} />
                    <input type="hidden" name="to" value={s.to} />
                    {s.danger ? <ConfirmSubmit confirmText={`Confirmar: ${s.label.toLowerCase()}`}>{s.label}</ConfirmSubmit> : <SubmitButton size="sm" variant={s.to === "PUBLISHED" ? "primary" : "secondary"}>{s.label}</SubmitButton>}
                  </ActionForm>
                ))}
              </div>
              <p className="mt-3 text-[11.5px] text-fg-subtle">Estados: {Object.values(LISTING_STATUS_META).map((m) => m.label).join(" · ")}</p>
            </Panel>
          )}

          {a && (
            <Panel title={`Imágenes (${a.images.length}/15)`}>
              {a.images.length > 0 && (
                <ul className="mb-4 grid grid-cols-3 gap-2">
                  {a.images.map((img, i) => (
                    <li key={img.id} className="group relative aspect-[16/10] overflow-hidden rounded-md border border-white/[0.08]">
                      <Image src={img.url} alt={img.alt} fill sizes="160px" unoptimized={img.url.endsWith(".svg")} className="object-cover" />
                      {i === 0 && <span className="absolute left-1 top-1 rounded bg-volt-400 px-1 text-[10px] font-semibold text-volt-ink">Principal</span>}
                      <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-ink-900/85 p-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                        {i > 0 && (
                          <ActionForm action={imageAction} hideMessage>
                            <input type="hidden" name="imageId" value={img.id} />
                            <input type="hidden" name="op" value="first" />
                            <SubmitButton size="sm" variant="ghost" className="h-6 px-1.5 text-[11px]">
                              Principal
                            </SubmitButton>
                          </ActionForm>
                        )}
                        <ActionForm action={imageAction} hideMessage>
                          <input type="hidden" name="imageId" value={img.id} />
                          <input type="hidden" name="op" value="delete" />
                          <SubmitButton size="sm" variant="ghost" className="h-6 px-1.5 text-[11px] text-bad-400">
                            Quitar
                          </SubmitButton>
                        </ActionForm>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {a.images.length === 0 ? (
                <p className="text-[13px] text-fg-muted">Aún no tiene fotos. Agrégalas en el formulario y guarda.</p>
              ) : (
                <p className="text-[12px] text-fg-subtle">Pasa el cursor sobre una foto para marcarla como principal o quitarla. Para agregar más, usa el formulario.</p>
              )}
            </Panel>
          )}

          {a && a.claims.length > 0 && (
            <Panel title="Reclamaciones" actions={<Link href="/admin/reclamos" className="text-[12px] text-fg-muted hover:text-fg">Gestionar →</Link>}>
              <ul className="space-y-2 text-[13px]">
                {a.claims.map((c) => (
                  <li key={c.id}>
                    <span className="font-medium">{c.status}</span> · {formatDate(c.createdAt)}
                    <p className="line-clamp-2 text-fg-muted">{c.reason}</p>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {a && a.orders.length > 0 && (
            <Panel title="Historial de pedidos" bodyClass="p-0">
              <ul className="divide-y divide-white/[0.05] text-[13px]">
                {a.orders.map((o) => (
                  <li key={o.id}>
                    <Link href={`/admin/pedidos/${o.id}`} className="flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.02]">
                      <span className="font-mono">{o.number}</span>
                      <OrderStatusBadge status={o.status} />
                    </Link>
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

function AccountForm({ a, tags, imagesCount }: { a: AccountListing | null; tags: string[]; imagesCount: number }) {
  return (
    <ActionForm action={saveAccountAction} resetOnSuccess={!!a}>
      {a && <input type="hidden" name="id" value={a.id} />}

      <div className="space-y-5">
        <div>
          <p className="mb-2 text-[13px] font-medium">{a ? "Agregar fotos" : "Fotos de la cuenta"}</p>
          <ImagePicker existing={imagesCount} />
        </div>

        <Field label="Título">
          <input name="title" required minLength={8} maxLength={140} defaultValue={a?.title} placeholder="Ej. Cuenta nivel 70 con pase élite y 760 skins" className="field" />
        </Field>
        <Field label="Descripción de la cuenta" hint="Todo lo que el cliente debe saber: skins destacadas, pase élite, armas, etc.">
          <textarea name="description" required minLength={30} rows={6} defaultValue={a?.description} className="field" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Precio (COP)">
            <input name="price" type="number" min={1000} step={1} required defaultValue={a?.price} placeholder="150000" className="field" />
          </Field>
          <Field label="Precio anterior (opcional)" hint="Se muestra tachado como descuento.">
            <input name="compareAtPrice" type="number" min={0} step={1} defaultValue={a?.compareAtPrice ?? ""} className="field" />
          </Field>
        </div>

        <details className="group rounded-[12px] border border-white/[0.08] [&_summary::-webkit-details-marker]:hidden" open={!!a}>
          <summary className="flex cursor-pointer select-none items-center justify-between gap-3 px-4 py-3 text-[13.5px] font-semibold">
            Más detalles <span className="text-[12px] font-normal text-fg-subtle">opcional · nivel, skins, pechos, correo, origen… <span className="ml-1 inline-block transition-transform group-open:rotate-180">▾</span></span>
          </summary>
          <div className="grid gap-4 border-t border-white/[0.06] p-4 sm:grid-cols-2">
            <Field label="Nivel">
              <input name="level" type="number" min={0} defaultValue={a?.level ?? ""} className="field" />
            </Field>
            <Field label="Cantidad de skins">
              <input name="skinsCount" type="number" min={0} defaultValue={a?.skinsCount ?? ""} className="field" />
            </Field>
            <Field label="Cantidad de pechos">
              <input name="chestsCount" type="number" min={0} defaultValue={a?.chestsCount ?? ""} className="field" />
            </Field>
            <Field label="Rango (si aplica)">
              <select name="rank" defaultValue={a?.rank ?? ""} className="field">
                <option value="">Sin rango</option>
                {FF_RANKS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Correo de la cuenta" className="sm:col-span-2">
              <EmailStatusPicker defaultValue={a?.emailStatus ?? ""} />
            </Field>
            <Field label="Servidor">
              <select name="region" defaultValue={a?.region ?? "LATAM"} className="field">
                {FF_REGIONS.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.label} ({r.code})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Etiqueta">
              <select name="label" defaultValue={a?.label ?? "NONE"} className="field">
                {Object.entries(PRODUCT_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v ?? "Sin etiqueta"}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Características" hint="Separadas por comas. Se usan como filtros." className="sm:col-span-2">
              <input name="tags" defaultValue={tags.join(", ")} placeholder="Pase élite, Mascotas" className="field" />
            </Field>
            <Field label="Origen de la cuenta (interno)" hint="De quién es la cuenta. No se muestra en la tienda." className="sm:col-span-2">
              <input name="provenanceSource" defaultValue={a?.provenanceSource ?? ""} placeholder="Ej. Juan Pérez · WhatsApp 300…" className="field" />
            </Field>
            <Field label="Notas internas" className="sm:col-span-2">
              <textarea name="provenanceNotes" rows={2} defaultValue={a?.provenanceNotes ?? ""} className="field" />
            </Field>
            <div className="flex flex-wrap gap-x-6 gap-y-3 sm:col-span-2">
              <Check name="inventoryVerified" label="Revisé la cuenta (muestra el sello «Revisada»)" defaultChecked={a?.inventoryVerified ?? true} />
              <Check name="featured" label="Destacada" defaultChecked={a?.featured} />
            </div>
          </div>
        </details>
      </div>

      <div className="mt-6 flex flex-wrap gap-2 border-t border-white/[0.06] pt-5">
        {a ? (
          <SubmitButton>Guardar cambios</SubmitButton>
        ) : (
          <>
            <SubmitButton name="publish" value="1">
              Crear y publicar
            </SubmitButton>
            <SubmitButton variant="secondary">Guardar como borrador</SubmitButton>
          </>
        )}
      </div>
    </ActionForm>
  );
}
