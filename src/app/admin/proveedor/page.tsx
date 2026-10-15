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
import { activeTopUpProvider } from "@/server/integrations/topup";
import { supplierApi } from "@/server/integrations/topup/rechargegame";
import { ensureFreshCatalog, listSupplierRegions, supplierRate } from "@/server/supplier";
import { getSettings } from "@/server/settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Proveedor y saldo" };

const usd = (cents: number) => (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const STATUS_TONE = { delivered: "success", failed: "danger", pending: "warning" } as const;
const STATUS_LABEL = { delivered: "Entregado", failed: "Fallido", pending: "En proceso" } as const;

export default async function SupplierAdmin() {
  await requireAdmin();
  const configured = !!env.topup.apiKey;
  const active = activeTopUpProvider()?.id === "rechargegame";
  if (configured) await ensureFreshCatalog();

  const [ping, balance, remote, regions, rate, settings] = await Promise.all([
    configured ? supplierApi.ping().catch((e: Error) => ({ error: e.message })) : null,
    configured ? supplierApi.balance().catch(() => null) : null,
    configured ? supplierApi.orders(15).catch(() => null) : null,
    listSupplierRegions(),
    supplierRate(),
    getSettings(),
  ]);
  const ours = remote?.orders.length
    ? await db.delivery.findMany({ where: { idempotencyKey: { in: remote.orders.map((o) => o.buyer_ref ?? "").filter(Boolean) } }, select: { idempotencyKey: true, order: { select: { id: true, number: true } } } })
    : [];
  const balanceUsdt = balance ? Number(balance.balance_usdt) : null;
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
            {usd(r.minCents)}–{usd(r.maxCents)} USDT
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
        description="RechargeGame: cada pago aprobado compra la recarga con tu saldo prepago (USDT) y el proveedor la entrega al ID del cliente."
        actions={
          configured && (
            <ActionForm action={syncSupplierAction} className="text-right">
              <SubmitButton size="sm" variant="secondary">
                Sincronizar catálogo
              </SubmitButton>
            </ActionForm>
          )
        }
      />

      {!configured && (
        <Alert tone="warning" title="Falta la clave de la API" className="mb-6">
          Agrega <span className="font-mono">TOPUP_API_KEY</span> y <span className="font-mono">TOPUP_PROVIDER=rechargegame</span> en el archivo .env del servidor y reinicia.
        </Alert>
      )}
      {configured && !active && (
        <Alert tone="warning" title="El proveedor no está activo para entregas" className="mb-6">
          La clave funciona, pero <span className="font-mono">TOPUP_PROVIDER</span> = «{env.topup.provider || "vacío"}». Cámbialo a <span className="font-mono">rechargegame</span> para que los pedidos se envíen aquí.
        </Alert>
      )}

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Cuenta" value={ping && "buyer" in ping ? ping.buyer : "—"} hint={ping && "error" in ping ? ping.error : ping ? "Conectado" : "Sin configurar"} tone={ping && "buyer" in ping ? "ok" : "warn"} />
        <Stat
          label="Saldo"
          value={balanceUsdt != null ? `${balanceUsdt.toFixed(2)} USDT` : "—"}
          hint={balanceUsdt != null ? `≈ ${formatMoney(Math.round(balanceUsdt * rate.usdtCop))} a $${rate.usdtCop.toLocaleString("es-CO")} por USDT` : undefined}
          tone={balanceUsdt != null && largest && balanceUsdt * 100 < largest ? "warn" : undefined}
        />
        <Stat
          label="Pedidos al proveedor"
          value={env.topup.forceTest ? "Solo prueba" : "Automáticos"}
          hint={env.topup.forceTest ? "TOPUP_TEST_MODE=true: nada se cobra ni se entrega." : "Pagos de prueba → pedido de prueba (gratis). Pagos reales → recarga real."}
        />
        <Stat label="Catálogo" value={rate.syncedAt ? timeAgo(rate.syncedAt) : "Nunca"} hint={`${rate.syncedAt ? `${formatDate(rate.syncedAt)} · ` : ""}Costos y existencias se actualizan cada 3 horas. Tus precios no cambian solos.`} />
      </div>

      {balanceUsdt != null && largest > 0 && balanceUsdt * 100 < largest && (
        <Alert tone="warning" className="mb-6">
          Tu saldo ({balanceUsdt.toFixed(2)} USDT) no alcanza para el paquete más grande activo ({usd(largest)} USDT). Si un cliente lo compra, la entrega queda en espera hasta que recargues; se reintenta sola cada 5
          minutos.
        </Alert>
      )}

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Tasa y margen">
          <ActionForm action={saveSupplierRatesAction} className="space-y-3">
            <Field label="Pesos por 1 USDT" hint="Para calcular costos, márgenes y precios sugeridos.">
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
              <strong className="text-fg">Recargar saldo:</strong> USDT por red BEP20 desde tu enlace de depósito del proveedor (mínimo 5 USDT). Mantén al menos el valor de tu paquete más grande.
            </p>
            <p>
              <strong className="text-fg">Webhook (al publicar la tienda):</strong> en el panel del proveedor → Profile → Webhook, pon <span className="break-all font-mono text-fg">{env.appUrl}/api/webhooks/topup</span>{" "}
              y copia el secreto <span className="font-mono">whsec_…</span> en <span className="font-mono">TOPUP_WEBHOOK_SECRET</span>.
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
            {!remote?.orders.length && (
              <tr>
                <td colSpan={6} className="text-fg-muted">
                  {remote ? "Sin pedidos todavía." : "No se pudo consultar el proveedor."}
                </td>
              </tr>
            )}
            {remote?.orders.map((o) => {
              const mine = ours.find((d) => d.idempotencyKey === o.buyer_ref)?.order;
              const st = (o.status in STATUS_LABEL ? o.status : "pending") as keyof typeof STATUS_LABEL;
              return (
                <tr key={o.order_id}>
                  <td className="whitespace-nowrap text-fg-muted">{o.created_at ? formatDate(o.created_at) : "—"}</td>
                  <td>
                    {mine ? (
                      <Link href={`/admin/pedidos/${mine.id}`} className="font-mono underline underline-offset-2">
                        {mine.number}
                      </Link>
                    ) : (
                      <span className="text-fg-subtle">Fuera de la tienda</span>
                    )}
                    <span className="block font-mono text-[11px] text-fg-subtle">{o.order_id}</span>
                  </td>
                  <td>
                    {o.product}
                    {o.test && <Badge className="ml-2">Prueba</Badge>}
                  </td>
                  <td className="font-mono">{o.player_id ?? "—"}</td>
                  <td className="tabular-nums">{o.price_usdt != null ? `${Number(o.price_usdt).toFixed(2)} USDT` : "—"}</td>
                  <td>
                    <Badge tone={STATUS_TONE[st]} dot>
                      {STATUS_LABEL[st]}
                    </Badge>
                    {o.status === "failed" && o.failure_reason && <span className="mt-1 block max-w-[260px] text-[11.5px] text-bad-400">{o.failure_reason}</span>}
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
