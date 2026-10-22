/* eslint-disable @next/next/no-img-element */
import type { PromoBanner } from "@prisma/client";
import { ArrowDown, ArrowUp } from "lucide-react";
import { ActionForm, ConfirmSubmit, SubmitButton } from "@/components/admin/action-form";
import { Field, PageHeader, Panel } from "@/components/admin/ui";
import { Badge } from "@/components/ui/primitives";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { bannerAction, uploadBannerAction } from "@/app/actions/admin";
import { BANNER_SLOTS } from "@/domain/banner-slots";

export const dynamic = "force-dynamic";
export const metadata = { title: "Banners" };

const PLACEMENTS = BANNER_SLOTS.map((s) => ({
  v: s.v,
  label: `${s.page} · ${s.label}`,
  hint: `${s.hint} · ${s.size} px`,
  ratio: s.size === "1600×480" ? "aspect-[1600/480]" : s.wide ? "aspect-[1600/400]" : "aspect-[1200/630]",
}));

function BannerCard({ b, i, total, ratio }: { b: PromoBanner; i: number; total: number; ratio: string }) {
  return (
    <li className="overflow-hidden rounded-[14px] bg-ink-850 ring-1 ring-white/[0.07]">
      <div className={`relative bg-ink-900 ${ratio}`}>
        <img src={b.imageUrl} alt={b.title} className={`size-full object-cover ${b.active ? "" : "opacity-40 grayscale"}`} />
        <span className="absolute left-2 top-2 rounded-md bg-ink-950/80 px-2 py-0.5 font-mono text-[11px] text-fg">#{i + 1}</span>
        <span className="absolute right-2 top-2">
          <Badge tone={b.active ? "success" : "neutral"} dot>
            {b.active ? "Visible" : "Oculto"}
          </Badge>
        </span>
      </div>
      <div className="space-y-3 p-3.5">
        <ActionForm action={bannerAction} className="space-y-2">
          <input type="hidden" name="id" value={b.id} />
          <input type="hidden" name="op" value="update" />
          <input name="title" defaultValue={b.title} maxLength={120} className="field h-9 text-[13px]" aria-label="Descripción" />
          {/* En celular: enlace en su propia fila; ubicación y Guardar debajo. */}
          <div className="flex flex-wrap gap-2 sm:flex-nowrap">
            <input name="href" defaultValue={b.href ?? ""} placeholder="Sin enlace" className="field h-9 w-full min-w-0 text-[13px] sm:w-auto sm:flex-1" aria-label="Enlace" />
            <select name="placement" defaultValue={b.placement} className="field h-9 min-w-0 flex-1 py-1 text-[12.5px] sm:w-[150px] sm:flex-none" aria-label="Ubicación">
              {PLACEMENTS.map((p) => (
                <option key={p.v} value={p.v}>
                  {p.label}
                </option>
              ))}
            </select>
            <SubmitButton size="sm" variant="secondary">
              Guardar
            </SubmitButton>
          </div>
        </ActionForm>
        <div className="flex flex-wrap items-center gap-3 border-t border-white/[0.06] pt-3 sm:flex-nowrap">
          {b.imageMobileUrl ? (
            <img src={b.imageMobileUrl} alt="" className="h-12 w-16 shrink-0 rounded-md object-cover ring-1 ring-white/10" />
          ) : (
            <span className="grid h-12 w-16 shrink-0 place-items-center rounded-md border border-dashed border-white/15 text-[10.5px] text-fg-subtle">Sin versión</span>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-medium">Versión para celular</p>
            <p className="text-[11.5px] text-fg-subtle">{b.imageMobileUrl ? "Se muestra en teléfonos." : "En teléfonos se ve la imagen ancha."}</p>
          </div>
          <ActionForm action={bannerAction} hideMessage className="flex w-full items-center gap-1.5 sm:w-auto">
            <input type="hidden" name="id" value={b.id} />
            <input type="hidden" name="op" value="mobile" />
            <input
              name="imageMobile"
              type="file"
              required
              accept="image/jpeg,image/png,image/webp,image/avif"
              aria-label={b.imageMobileUrl ? "Cambiar versión para celular" : "Subir versión para celular"}
              className="min-w-0 flex-1 text-[11.5px] text-fg-muted sm:w-[150px] sm:flex-none file:mr-2 file:rounded-md file:border-0 file:bg-ink-700 file:px-2 file:py-1 file:text-[11.5px] file:text-fg"
            />
            <SubmitButton size="sm" variant="ghost">
              {b.imageMobileUrl ? "Cambiar" : "Subir"}
            </SubmitButton>
          </ActionForm>
          {b.imageMobileUrl && (
            <ActionForm action={bannerAction} hideMessage>
              <input type="hidden" name="id" value={b.id} />
              <input type="hidden" name="op" value="mobile_remove" />
              <SubmitButton size="sm" variant="ghost" aria-label="Quitar versión para celular">
                Quitar
              </SubmitButton>
            </ActionForm>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 border-t border-white/[0.06] pt-3">
          {[
            { op: "up", label: <ArrowUp className="size-4" />, aria: "Subir", disabled: i === 0 },
            { op: "down", label: <ArrowDown className="size-4" />, aria: "Bajar", disabled: i === total - 1 },
          ].map((m) => (
            <ActionForm key={m.op} action={bannerAction} hideMessage>
              <input type="hidden" name="id" value={b.id} />
              <input type="hidden" name="op" value={m.op} />
              <SubmitButton size="sm" variant="ghost" disabled={m.disabled} aria-label={m.aria}>
                {m.label}
              </SubmitButton>
            </ActionForm>
          ))}
          <ActionForm action={bannerAction} hideMessage>
            <input type="hidden" name="id" value={b.id} />
            <input type="hidden" name="op" value="toggle" />
            <SubmitButton size="sm" variant="secondary">
              {b.active ? "Ocultar" : "Mostrar"}
            </SubmitButton>
          </ActionForm>
          <div className="ml-auto">
            <ActionForm action={bannerAction} hideMessage>
              <input type="hidden" name="id" value={b.id} />
              <input type="hidden" name="op" value="delete" />
              <ConfirmSubmit confirmText="Confirmar">Eliminar</ConfirmSubmit>
            </ActionForm>
          </div>
        </div>
      </div>
    </li>
  );
}

export default async function BannersAdmin() {
  await requireAdmin();
  const banners = await db.promoBanner.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });

  return (
    <>
      <PageHeader title="Banners" description="Cada banner aparece en un punto clave de la compra. Sube tus propios edits y elige dónde mostrarlos." />

      <Panel title="Subir banner" className="mb-8">
        <ActionForm action={uploadBannerAction} resetOnSuccess>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_0.7fr_1fr_auto] lg:items-end">
            <Field label="Imagen" hint="JPG, PNG, WebP o AVIF · máx. 5 MB">
              <input
                name="image"
                type="file"
                required
                accept="image/jpeg,image/png,image/webp,image/avif"
                className="block w-full text-[12.5px] text-fg-muted file:mr-3 file:rounded-md file:border-0 file:bg-ink-700 file:px-3 file:py-1.5 file:text-fg"
              />
            </Field>
            <Field label="Para celular" hint="Opcional · 800×600 (carrusel) u 800×520 (franjas)">
              <input
                name="imageMobile"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                className="block w-full text-[12.5px] text-fg-muted file:mr-3 file:rounded-md file:border-0 file:bg-ink-700 file:px-3 file:py-1.5 file:text-fg"
              />
            </Field>
            <Field label="Descripción" hint="Qué dice el banner.">
              <input name="title" required minLength={4} maxLength={120} placeholder="Ej. Promo fin de semana +15%" className="field" />
            </Field>
            <Field label="Enlace" hint="Opcional.">
              <input name="href" placeholder="/recargas" className="field" />
            </Field>
            <Field label="Ubicación">
              <select name="placement" defaultValue="TOP" className="field">
                {PLACEMENTS.map((p) => (
                  <option key={p.v} value={p.v}>
                    {p.label}
                  </option>
                ))}
              </select>
            </Field>
            <SubmitButton size="sm">Subir</SubmitButton>
          </div>
          <p className="mt-3 text-[12px] text-fg-subtle">Tamaño 1200×630 px en todas las ubicaciones, excepto la franja ancha (1600×400 px). En celular el texto de una imagen ancha queda muy pequeño: sube también la versión para celular. Evita poner precios en la imagen: cambian y el banner quedaría desactualizado.</p>
        </ActionForm>
      </Panel>

      {PLACEMENTS.map((p) => {
        const list = banners.filter((b) => b.placement === p.v);
        return (
          <section key={p.v} className="mb-10">
            <div className="mb-3 flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
              <h2 className="text-[16px] font-bold">{p.label}</h2>
              <span className="text-[12.5px] text-fg-subtle">
                {p.hint} · {list.filter((b) => b.active).length} visibles
              </span>
            </div>
            {list.length === 0 ? (
              <p className="rounded-[12px] border border-dashed border-white/10 p-6 text-center text-[13px] text-fg-muted">Sin banners en esta ubicación: la sección no se muestra en el inicio.</p>
            ) : (
              <ul className={`grid gap-4 ${p.ratio.includes("1600") ? "lg:grid-cols-2" : "md:grid-cols-2 xl:grid-cols-3"}`}>
                {list.map((b, i) => (
                  <BannerCard key={b.id} b={b} i={i} total={list.length} ratio={p.ratio} />
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </>
  );
}
