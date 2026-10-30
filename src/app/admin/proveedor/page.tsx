import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { ActionForm, ConfirmSubmit, SubmitButton } from "@/components/admin/action-form";
import { Field, PageHeader, Panel, Stat, Table } from "@/components/admin/ui";
import { TopupRegionFlag } from "@/components/brand/topup-region-flag";
import { Alert, Badge } from "@/components/ui/primitives";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { formatDate, formatMoney } from "@/lib/money";
import { timeAgo } from "@/components/store/time-ago";
import { costInCop, MIN_MARGIN_PCT, regionFlag } from "@/domain/topup-regions";
import { dailyRateAction, repriceRegionAction, saveSupplierRatesAction, syncSupplierAction, toggleRegionAction } from "@/app/actions/supplier";
import { activeWholesale } from "@/server/integrations/topup";
import { ensureFreshCatalog, listSupplierRegions, supplierRate } from "@/server/supplier";
import { getSettings } from "@/server/settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Proveedor y saldo" };

const usd = (cents: number) => (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const STATUS_TONE = { delivered: "success", failed: "danger", pending: "warning" } as const;
const STATUS_LABEL = { delivered: "Entregado", failed: "Fallido", pending: "En proceso" } as const;

export default async function SupplierAdmin() {
  await requireAdmin();
  // Proveedor mayorista activo según TOPUP_PROVIDER (Central One o RechargeGame).
  const supplier = activeWholesale();
  const api = supplier?.wholesale ?? null;
  const name = api?.name ?? "Central One";
  const cur = api?.currency ?? "USD";
  if (api) await ensureFreshCatalog();

  const [ping, balance, remote, regions, rate, settings] = await Promise.all([
    api ? api.ping().catch((e: Error) => ({ error: e.message })) : null,
    api ? api.balance().catch(() => null) : null,
    api ? api.orders(15).catch(() => null) : null,
    listSupplierRegions(),
    supplierRate(),
    getSettings(),
  ]);
  // Pedidos del proveedor que salieron de la tienda: la entrega guarda el id del pedido del proveedor.
  const ours = remote?.length
    ? await db.delivery.findMany({ where: { providerRef: { in: remote.map((o) => o.ref) } }, select: { providerRef: true, order: { select: { id: true, number: true } } } })
    : [];
  const balanceUsdt = balance ? balance.amount : null;
  const enabled = regions.filter((r) => r.enabled);
  const largest = enabled.reduce((m, r) => Math.max(m, r.maxCents ?? 0), 0);

  // Arriba solo las regiones que se venden; las demás del proveedor quedan en un desplegable cerrado.
  const others = regions.filter((r) => !r.enabled);
  const head = (
    <thead>
      <tr>
        <th>Región</th>
        <th>Costo proveedor</th>
        <th>En tienda</th>
        <th>Estado</th>
        <th className="text-right">Acciones</th>
      </tr>
    </thead>
  );
  const regionRow = (r: (typeof regions)[number]) => (
    <tr key={r.slug}>
      <td>
        <span className="flex items-center gap-2 font-medium">
          <TopupRegionFlag flag={regionFlag(r.slug)} />
          {r.label}
        </span>
        <span className="text-[11.5px] text-fg-subtle">
          {r.name} · {r.packs} paquetes de diamantes{r.outOfStock ? ` · ${r.outOfStock} agotados` : ""}
        </span>
      </td>
      <td className="tabular-nums">
        {r.minCents != null && r.maxCents != null ? (
          <>
            {usd(r.minCents)}–{usd(r.maxCents)} {cur}
            <span className="block text-[11.5px] text-fg-subtle">
              ≈ {formatMoney(costInCop(r.minCents, rate.usdtCop))}–{formatMoney(costInCop(r.maxCents, rate.usdtCop))}
            </span>
          </>
        ) : (
          "—"
        )}
      </td>
      <td>
        {r.storePackages ? (
          <Link href={`/admin/paquetes?region=${r.slug}`} className="underline underline-offset-2 hover:text-fg">
            {r.storePackages} paquete(s)
          </Link>
        ) : (
          <span className="text-fg-subtle">—</span>
        )}
      </td>
      <td>
        {r.enabled ? (
          <Badge tone="success" dot>
            Visible
          </Badge>
        ) : (
          <Badge>Oculta</Badge>
        )}
      </td>
      <td>
        <div className="flex flex-wrap justify-end gap-2">
          <ActionForm action={toggleRegionAction}>
            <input type="hidden" name="region" value={r.slug} />
            <input type="hidden" name="op" value={r.enabled ? "disable" : "enable"} />
            <SubmitButton size="sm" variant={r.enabled ? "ghost" : "secondary"}>
              {r.enabled ? "Ocultar" : r.storePackages ? "Mostrar" : "Activar"}
            </SubmitButton>
          </ActionForm>
          {r.storePackages > 0 && (
            <ActionForm action={repriceRegionAction}>
              <input type="hidden" name="region" value={r.slug} />
              <input type="hidden" name="confirmMain" value="1" />
              <ConfirmSubmit variant="secondary" confirmText={r.slug === "latam" ? `¿Reemplazar precios con ${rate.margin}%?` : "¿Reemplazar con la lógica de LATAM?"}>
                Recalcular precios
              </ConfirmSubmit>
            </ActionForm>
          )}
        </div>
      </td>
    </tr>
  );

  return (
    <>
      <PageHeader
        title="Proveedor y saldo"
        description={`${name}: cada pago aprobado compra la recarga con tu saldo prepago (${cur}) y el proveedor la entrega al ID del cliente.`}
        actions={
          api && (
            <ActionForm action={syncSupplierAction} className="text-right">
              <SubmitButton size="sm" variant="secondary">
                Sincronizar catálogo
              </SubmitButton>
            </ActionForm>
          )
        }
      />

      {!api && (
        <Alert tone="warning" title="Proveedor sin configurar" className="mb-6">
          En el archivo .env del servidor pon <span className="font-mono">TOPUP_PROVIDER=centralone</span> y <span className="font-mono">TOPUP_API_KEY=co_live_…</span> (la llave de Central One) y reinicia.
          {env.topup.apiKey && env.topup.provider !== "centralone" && env.topup.provider !== "rechargegame" && (
            <span className="mt-1 block">
              Ahora <span className="font-mono">TOPUP_PROVIDER</span> = «{env.topup.provider || "vacío"}».
            </span>
          )}
        </Alert>
      )}

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Cuenta" value={ping && "account" in ping ? ping.account : "—"} hint={ping && "error" in ping ? ping.error : ping ? "Conectado" : "Sin configurar"} tone={ping && "account" in ping && ping.ok ? "ok" : "warn"} />
        <Stat
          label="Saldo"
          value={balanceUsdt != null ? `${balanceUsdt.toFixed(2)} ${cur}` : "—"}
          hint={balanceUsdt != null ? `Disponible · ≈ ${formatMoney(Math.round(balanceUsdt * rate.usdtCop))} a $${rate.usdtCop.toLocaleString("es-CO")} por ${cur}` : undefined}
          tone={balanceUsdt != null && largest && balanceUsdt * 100 < largest ? "warn" : undefined}
        />
        <Stat
          label="Pedidos al proveedor"
          value={env.topup.forceTest ? "Solo prueba" : "Automáticos"}
          hint={env.topup.forceTest ? "TOPUP_TEST_MODE=true: nada se cobra ni se entrega." : "Pagos de prueba → entrega simulada (no se compra nada). Pagos reales → recarga real."}
        />
        <Stat label="Catálogo" value={rate.syncedAt ? timeAgo(rate.syncedAt) : "Nunca"} hint={`${rate.syncedAt ? `${formatDate(rate.syncedAt)} · ` : ""}Costos y existencias se actualizan cada ${api && api.catalogMaxAgeMs < 3600_000 ? `${Math.round(api.catalogMaxAgeMs / 60_000)} minutos` : "3 horas"}. Tus precios no cambian solos.`} />
      </div>

      {balanceUsdt != null && largest > 0 && balanceUsdt * 100 < largest && (
        <Alert tone="warning" className="mb-6">
          Tu saldo ({balanceUsdt.toFixed(2)} {cur}) no alcanza para el paquete más grande activo ({usd(largest)} {cur}). Si un cliente lo compra, la entrega queda en espera hasta que recargues; se reintenta sola cada 5
          minutos.
        </Alert>
      )}

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Tasa y margen">
          <ActionForm action={saveSupplierRatesAction} className="space-y-3">
            <Field label={`Pesos por 1 ${cur}`} hint="Para calcular costos, márgenes y precios sugeridos.">
              <input name="usdtCop" inputMode="numeric" defaultValue={settings.usdtCop} className="field tabular-nums" />
            </Field>
            <Field label="Margen para precios sugeridos (%)" hint="Se aplica al activar una región o al recalcular precios.">
              <input name="topupMargin" inputMode="decimal" defaultValue={settings.topupMargin} className="field tabular-nums" />
            </Field>
            <SubmitButton size="sm">Guardar</SubmitButton>
          </ActionForm>
          <ActionForm action={dailyRateAction} className="mt-3 border-t border-white/[0.06] pt-3">
            <SubmitButton size="sm" variant="ghost">
              Usar la tasa del día (+2 %)
            </SubmitButton>
          </ActionForm>
        </Panel>

        <Panel title="Saldo y webhook">
          <div className="space-y-3 text-[12.5px] text-fg-muted">
            <p>
              <strong className="text-fg">Recargar saldo:</strong> {api?.topUpHint ?? "Desde el portal de tu proveedor."}
            </p>
            <p>
              <strong className="text-fg">Webhook (opcional):</strong>{" "}
              {name === "Central One" ? "en el portal de Central One → Integración → Webhooks" : "en el panel del proveedor → Profile → Webhook"}, pon{" "}
              <span className="break-all font-mono text-fg">{env.appUrl}/api/webhooks/topup</span> y copia el secreto en <span className="font-mono">TOPUP_WEBHOOK_SECRET</span>.
              {name === "Central One" && " Marca los eventos de pedidos (order.delivered y order.failed)."}
            </p>
            <p>
              Estado: {env.topup.webhookSecret ? <Badge tone="success">Secreto configurado</Badge> : <Badge tone="warning">Sin webhook</Badge>}
              {!env.topup.webhookSecret && (
                <span className="mt-1 block text-fg-subtle">Sin webhook, el estado se consulta al abrir el pedido y en el mantenimiento automático. Funciona igual, solo un poco más lento.</span>
              )}
            </p>
          </div>
        </Panel>
      </div>

      <Panel title="Regiones que vendes" bodyClass="p-0">
        <Table>
          {head}
          <tbody>
            {regions.length === 0 && (
              <tr>
                <td colSpan={5} className="text-fg-muted">
                  Aún no hay catálogo. Pulsa «Sincronizar catálogo».
                </td>
              </tr>
            )}
            {regions.length > 0 && enabled.length === 0 && (
              <tr>
                <td colSpan={5} className="text-warn-400">
                  No tienes regiones visibles: nadie puede comprar diamantes. Activa una en «Otras regiones».
                </td>
              </tr>
            )}
            {enabled.map(regionRow)}
          </tbody>
        </Table>
        {others.length > 0 && (
          <details className="group border-t border-white/[0.06]">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[13px] text-fg-muted hover:text-fg [&::-webkit-details-marker]:hidden">
              <span>
                Otras regiones del proveedor ({others.length}) <span className="text-fg-subtle">· ocultas, no se venden</span>
              </span>
              <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" />
            </summary>
            <div className="px-4 pb-4">
              <Table>
                {head}
                <tbody>{others.map(regionRow)}</tbody>
              </Table>
            </div>
          </details>
        )}
        <p className="border-t border-white/[0.06] px-4 py-3 text-[12px] text-fg-subtle">
          Precios fuera de LATAM: el mismo margen que deja el paquete equivalente de LATAM, sin pasar el precio de LATAM (o su precio por diamante si la cantidad no existe allá) y con un mínimo de {MIN_MARGIN_PCT} % para no vender a pérdida; redondeo a $500. LATAM usa el margen general de «Tasa y margen». Puedes editar cualquier precio en «Diamantes y precios». Solo se venden las regiones visibles; al verificar el ID, la tienda detecta la región de la cuenta.
          </p>
      </Panel>

      <Panel title="Últimos pedidos en el proveedor" className="mt-6" bodyClass="p-0">
        <Table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Pedido</th>
              <th>Producto</th>
              <th>ID jugador</th>
              <th>Precio</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {!remote?.length && (
              <tr>
                <td colSpan={6} className="text-fg-muted">
                  {remote ? "Sin pedidos todavía." : "No se pudo consultar el proveedor."}
                </td>
              </tr>
            )}
            {remote?.map((o) => {
              const mine = ours.find((d) => d.providerRef === o.ref)?.order;
              const st = o.outcome;
              return (
                <tr key={o.ref}>
                  <td className="whitespace-nowrap text-fg-muted">{o.createdAt ? formatDate(o.createdAt) : "—"}</td>
                  <td>
                    {mine ? (
                      <Link href={`/admin/pedidos/${mine.id}`} className="font-mono underline underline-offset-2">
                        {mine.number}
                      </Link>
                    ) : (
                      <span className="text-fg-subtle">Fuera de la tienda</span>
                    )}
                    <span className="block font-mono text-[11px] text-fg-subtle">{o.reference ?? o.ref}</span>
                  </td>
                  <td>
                    {o.product ?? o.note ?? "—"}
                    {o.test && <Badge className="ml-2">Prueba</Badge>}
                  </td>
                  <td className="font-mono">{o.playerId ?? "—"}</td>
                  <td className="tabular-nums">{o.price != null ? `${o.price.toFixed(2)} ${cur}` : "—"}</td>
                  <td>
                    <Badge tone={STATUS_TONE[st]} dot>
                      {STATUS_LABEL[st]}
                    </Badge>
                    {st === "failed" && o.failure && <span className="mt-1 block max-w-[260px] text-[11.5px] text-bad-400">{o.failure}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Panel>
    </>
  );
}
