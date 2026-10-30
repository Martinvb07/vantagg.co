/* eslint-disable @next/next/no-img-element */
import type { DiamondPackage } from "@prisma/client";
import { ActionForm, ConfirmSubmit, SubmitButton } from "@/components/admin/action-form";
import { Check, Field, PageHeader, Panel } from "@/components/admin/ui";
import { DemoBadge } from "@/components/ui/primitives";
import { PRODUCT_LABELS } from "@/domain/labels";
import { quotePrice } from "@/domain/pricing";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatMoney, formatNumber } from "@/lib/money";
import { applyBonusAllAction, deletePackageAction, savePackageAction, topupCoverAction } from "@/app/actions/admin";
import { getSettings } from "@/server/settings";
import { activeWholesale } from "@/server/integrations/topup";
import { costInCop, marginOf, parseRegionList, regionFlag, regionLabel } from "@/domain/topup-regions";
import { TopupRegionFlag } from "@/components/brand/topup-region-flag";
import { cn } from "@/lib/utils";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = { title: "Diamantes y precios" };

export default async function PackagesAdmin({ searchParams }: { searchParams: Promise<{ region?: string }> }) {
  await requireAdmin();
  const { topupCoverUrl, usdtCop: rateStr, topupRegions } = await getSettings();
  const usdtCop = Number(rateStr) > 0 ? Number(rateStr) : 3400;
  const enabled = parseRegionList(topupRegions);
  const groups = await db.diamondPackage.groupBy({ by: ["region"], _count: { _all: true } });
  const tabs = [...new Set(["latam", ...enabled, ...groups.map((g) => g.region)])].filter((r) => r === "latam" || groups.some((g) => g.region === r));
  const askedRegion = (await searchParams).region;
  const region = askedRegion && tabs.includes(askedRegion) ? askedRegion : "latam";
  const packages = await db.diamondPackage.findMany({ where: { region }, orderBy: [{ sortOrder: "asc" }, { diamonds: "asc" }], include: { _count: { select: { orders: true } } } });
  const quotes = packages.map((p) => quotePrice(p.price, p.compareAtPrice));
  const demoCount = packages.filter((p) => p.isDemo).length;
  // Productos del proveedor para vincular: los de la región y los «GLOBAL» (sirven para cualquier región).
  const products = await db.supplierProduct.findMany({ where: { regionSlug: { in: [region, "global"] }, unit: "Diamonds" }, orderBy: { amount: "asc" }, select: { productKey: true, name: true, priceCents: true } });
  const currency = activeWholesale()?.wholesale.currency ?? "USD";

  return (
    <>
      <PageHeader
        title="Diamantes y precios"
        description="Precios en COP enteros. Los descuentos se manejan con precio anterior real o con códigos promocionales."
      />
      {demoCount > 0 && (
        <p className="mb-4 rounded-lg border border-warn-400/25 bg-warn-400/[0.06] px-4 py-3 text-[13px] text-fg-muted">
          <strong className="text-warn-400">{demoCount} paquete(s) con precio DEMO.</strong> Edita y guarda cada uno con su precio real; en producción no se
          pueden comprar paquetes DEMO.
        </p>
      )}

      <Panel title="Bonificación para todos los paquetes" className="mb-6">
        <ActionForm action={applyBonusAllAction} className="flex flex-wrap items-end gap-3">
          <Field label="Bonus (%)" hint="Calcula los diamantes extra de cada paquete. 0 = sin bonus.">
            <input name="pct" type="number" min={0} max={100} defaultValue={packages[0] && packages[0].diamonds ? Math.round((packages[0].bonusDiamonds / packages[0].diamonds) * 100) : 10} className="field w-32" />
          </Field>
          <SubmitButton size="sm" variant="secondary">
            Aplicar a todos
          </SubmitButton>
        </ActionForm>
        <p className="mt-2 text-[12px] text-warn-400">Solo cambia paquetes sin producto del proveedor. Los vinculados muestran exactamente lo que entrega el proveedor (ej. 110 = 100 + 10 bonus).</p>
      </Panel>

      <Panel title="Imagen del producto" className="mb-6">
        <div className="flex flex-wrap items-start gap-5">
          <div className="grid size-28 shrink-0 place-items-center overflow-hidden rounded-[12px] bg-ink-900 ring-1 ring-white/10">
            {topupCoverUrl ? <img src={topupCoverUrl} alt="Imagen actual del producto" className="size-full object-cover" /> : <span className="px-2 text-center text-[11.5px] text-fg-subtle">Arte por defecto</span>}
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <ActionForm action={topupCoverAction} className="flex flex-wrap items-end gap-3">
              <Field label="Nueva imagen" hint="Se muestra en la página de recargas. Cuadrada, mínimo 1200×1200 px.">
                <input name="image" type="file" required accept="image/jpeg,image/png,image/webp,image/avif" className="field py-2 text-[13px]" />
              </Field>
              <SubmitButton size="sm" variant="secondary">
                Subir
              </SubmitButton>
            </ActionForm>
            {topupCoverUrl && (
              <ActionForm action={topupCoverAction} hideMessage>
                <input type="hidden" name="op" value="remove" />
                <SubmitButton size="sm" variant="ghost">
                  Volver al arte por defecto
                </SubmitButton>
              </ActionForm>
            )}
            <p className="text-[12px] text-warn-400">Usa solo imágenes que tengas derecho a publicar. Logos de Garena o de colaboraciones (como Naruto) pueden hacer parecer que la tienda es oficial.</p>
          </div>
        </div>
      </Panel>

      <nav aria-label="Regiones" className="mb-4 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Link
            key={t}
            href={t === "latam" ? "/admin/paquetes" : `/admin/paquetes?region=${t}`}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-[13px] transition-colors",
              t === region ? "border-volt-400 bg-volt-400/[0.08] text-fg" : "border-white/[0.1] text-fg-muted hover:text-fg",
            )}
          >
            <TopupRegionFlag flag={regionFlag(t)} />
            {regionLabel(t)}
            <span className="text-[11.5px] text-fg-subtle">{groups.find((g) => g.region === t)?._count._all ?? 0}</span>
            {!enabled.includes(t) && <span className="text-[11px] text-warn-400">oculta</span>}
          </Link>
        ))}
        <Link href="/admin/proveedor" className="inline-flex h-9 items-center px-2 text-[12.5px] text-fg-subtle underline underline-offset-2 hover:text-fg">
          Activar más regiones →
        </Link>
      </nav>

      <div className="space-y-3">
        {packages.map((p, i) => (
          <details key={p.id} className="group rounded-[12px] border border-white/[0.07] bg-ink-850 open:border-white/14">
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 text-[13px] [&::-webkit-details-marker]:hidden">
              <span className="w-28 font-display text-base font-semibold tabular-nums">{formatNumber(p.diamonds)}</span>
              <span className="w-24 text-sky-400">{p.bonusDiamonds ? `+${p.bonusDiamonds} bonus` : ""}</span>
              <span className="w-32 tabular-nums">
                {formatMoney(quotes[i].price)}
                {quotes[i].original != null && <span className="ml-1.5 text-fg-subtle line-through">{formatMoney(quotes[i].original!)}</span>}
              </span>
              <span className="w-28 text-fg-muted">{PRODUCT_LABELS[p.label] ?? "Sin etiqueta"}</span>
              <MarginTag price={quotes[i].price} costCents={p.costCents} usdtCop={usdtCop} linked={!!p.providerSku} />
              <span className={p.active && p.available && !p.supplierOutOfStock ? "text-ok-400" : "text-fg-subtle"}>
                {!p.active ? "Inactivo" : p.supplierOutOfStock ? "Agotado en el proveedor" : p.available ? "Disponible" : "Agotado"}
              </span>
              {p.isDemo && <DemoBadge label="PRECIO DEMO" />}
              <span className="ml-auto text-fg-subtle">{p._count.orders} pedidos · Editar ▾</span>
            </summary>
            <div className="border-t border-white/[0.06] p-4">
              <PackageForm pkg={p} region={region} products={products} usdtCop={usdtCop} currency={currency} />
              <ActionForm action={deletePackageAction} className="mt-4 border-t border-white/[0.06] pt-4">
                <input type="hidden" name="id" value={p.id} />
                <ConfirmSubmit confirmText={p._count.orders ? "Confirmar desactivación" : "Confirmar eliminación"}>
                  {p._count.orders ? "Desactivar paquete" : "Eliminar paquete"}
                </ConfirmSubmit>
              </ActionForm>
            </div>
          </details>
        ))}
      </div>

      <Panel title={`Nuevo paquete · ${regionLabel(region)}`} className="mt-8">
        <PackageForm region={region} products={products} usdtCop={usdtCop} currency={currency} />
      </Panel>
    </>
  );
}

/** Costo del proveedor y margen real del precio de venta. */
function MarginTag({ price, costCents, usdtCop, linked }: { price: number; costCents: number | null; usdtCop: number; linked: boolean }) {
  if (!linked) return <span className="w-36 text-[12px] text-warn-400">Sin producto del proveedor</span>;
  const m = marginOf(price, costCents, usdtCop);
  if (m == null || costCents == null) return <span className="w-36 text-[12px] text-fg-subtle">Costo sin sincronizar</span>;
  return (
    <span className="w-36 text-[12px] tabular-nums text-fg-muted">
      Costo {formatMoney(costInCop(costCents, usdtCop))} ·{" "}
      <span className={m < 5 ? "font-semibold text-bad-400" : m < 15 ? "text-warn-400" : "text-ok-400"}>{m.toLocaleString("es-CO")}%</span>
    </span>
  );
}

function PackageForm({ pkg, region, products, usdtCop, currency }: { pkg?: DiamondPackage; region: string; products: { productKey: string; name: string; priceCents: number }[]; usdtCop: number; currency: string }) {
  return (
    <ActionForm action={savePackageAction} resetOnSuccess={!pkg}>
      {pkg && <input type="hidden" name="id" value={pkg.id} />}
      <input type="hidden" name="region" value={pkg?.region ?? region} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Diamantes">
          <input name="diamonds" type="number" min={1} required defaultValue={pkg?.diamonds} className="field" />
        </Field>
        <Field label="Bonificación">
          <input name="bonusDiamonds" type="number" min={0} defaultValue={pkg?.bonusDiamonds ?? 0} className="field" />
        </Field>
        <Field label="Precio (COP)" hint="Puedes usar precios como 149.999.">
          <input name="price" type="number" min={100} step={1} required defaultValue={pkg?.price} className="field" />
        </Field>
        <Field label="Precio anterior (opcional)" hint="Solo si es un precio real previo.">
          <input name="compareAtPrice" type="number" min={0} step={1} defaultValue={pkg?.compareAtPrice ?? ""} className="field" />
        </Field>
        <Field label="Etiqueta">
          <select name="label" defaultValue={pkg?.label ?? "NONE"} className="field">
            {Object.entries(PRODUCT_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v ?? "Sin etiqueta"}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Orden">
          <input name="sortOrder" type="number" min={0} defaultValue={pkg?.sortOrder ?? 0} className="field" />
        </Field>
        <Field label="Producto del proveedor" hint="Lo que se compra al proveedor cuando pagan este paquete. Debe ser la misma cantidad total de diamantes." className="lg:col-span-2">
          <select name="providerSku" defaultValue={pkg?.providerSku ?? ""} className="field">
            <option value="">— Sin vincular (no se puede comprar) —</option>
            {pkg?.providerSku && !products.some((p) => p.productKey === pkg.providerSku) && <option value={pkg.providerSku}>{pkg.providerSku}</option>}
            {products.map((p) => (
              <option key={p.productKey} value={p.productKey}>
                {p.name} · {(p.priceCents / 100).toFixed(2)} {currency} (≈ {formatMoney(costInCop(p.priceCents, usdtCop))})
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3">
        <Check name="active" label="Activo (visible)" defaultChecked={pkg?.active ?? true} />
        <Check name="available" label="Disponible para comprar" defaultChecked={pkg?.available ?? true} />
        <Check name="featured" label="Destacado" defaultChecked={pkg?.featured} />
      </div>
      <div className="mt-4">
        <SubmitButton size="sm">{pkg ? "Guardar cambios" : "Crear paquete"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
