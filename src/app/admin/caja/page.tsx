import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, CircleCheck, Download, TriangleAlert } from "lucide-react";
import { ActionForm, ConfirmSubmit, SubmitButton } from "@/components/admin/action-form";
import { Field, PageHeader, Panel, Stat } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { formatDate, formatMoney, formatNumber } from "@/lib/money";
import { cn } from "@/lib/utils";
import { centsToCop, closeDiff, closeProfit, formatUsd, parseFee, toBogotaInput, BALANCE_TOLERANCE_CENTS, type BoxSummary } from "@/domain/cash";
import { activeWholesale } from "@/server/integrations/topup";
import { cashState, listCloses, type SupplierBalance } from "@/server/cash";
import { getSettings } from "@/server/settings";
import { addRechargeAction, closeCashAction, removeRechargeAction, saveCashFeeAction, startCashAction } from "@/app/actions/cash";

export const dynamic = "force-dynamic";
export const metadata = { title: "Caja" };

/** Fecha dentro de una frase: sin el punto final de «p. m.» (evita «p. m..»). */
const when = (d: Date) => formatDate(d).replace(/\.$/, "");

/** Línea de detalle: concepto a la izquierda, monto a la derecha. */
function Line({ label, hint, value, tone }: { label: ReactNode; hint?: ReactNode; value: ReactNode; tone?: "bad" | "muted" }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <span className="min-w-0">
        <span className="block text-[13.5px]">{label}</span>
        {hint && <span className="block text-[11.5px] text-fg-subtle">{hint}</span>}
      </span>
      <span className={cn("shrink-0 text-right text-[13.5px] font-medium tabular-nums", tone === "bad" && "text-bad-400", tone === "muted" && "text-fg-muted")}>{value}</span>
    </div>
  );
}

/** Cuadre del saldo: lo que debería haber según la caja frente al saldo real del proveedor. */
function Reconcile({ s, cur, supplier }: { s: BoxSummary; cur: string; supplier: string }) {
  if (s.expectedBalanceCents == null) return <p className="text-[12.5px] text-fg-muted">El cuadre del saldo empieza después del próximo cierre (ahí se guarda el saldo de partida).</p>;
  if (s.actualBalanceCents == null) return <p className="text-[12.5px] text-warn-400">{supplier} no respondió: no se pudo leer el saldo para cuadrar. Vuelve a cargar la página en un momento.</p>;
  const diff = s.diffCents ?? 0;
  return (
    <div className={cn("flex items-start gap-2.5 rounded-[10px] p-3 text-[12.5px]", s.balanceOk ? "bg-ok-400/[0.07] text-ok-400" : "bg-warn-400/[0.08] text-warn-400")}>
      {s.balanceOk ? <CircleCheck className="mt-px size-4 shrink-0" /> : <TriangleAlert className="mt-px size-4 shrink-0" />}
      <span>
        {s.balanceOk ? (
          <>El saldo cuadra con la caja (diferencia de {formatUsd(Math.abs(diff))} {cur}).</>
        ) : (
          <>
            Según la caja debería haber <b>{formatUsd(s.expectedBalanceCents)} {cur}</b> y hay <b>{formatUsd(s.actualBalanceCents)} {cur}</b>: {diff > 0 ? "sobran" : "faltan"} {formatUsd(Math.abs(diff))} {cur}.
            <span className="mt-1 block text-fg-muted">
              Suele ser una recarga sin anotar, una compra hecha directo en {supplier} o un cambio de precio del proveedor entre la compra y la entrega.
            </span>
          </>
        )}
      </span>
    </div>
  );
}

function BalanceValue({ balance }: { balance: SupplierBalance }) {
  return balance ? (
    <>
      {formatUsd(balance.cents)} <span className="text-[14px] text-fg-muted">{balance.currency}</span>
    </>
  ) : (
    <span className="text-fg-muted">Sin respuesta</span>
  );
}

export default async function CashPage() {
  await requireAdmin();
  const now = new Date();
  const supplier = activeWholesale()?.wholesale.name ?? "tu proveedor";
  const [state, closes, settings] = await Promise.all([cashState(now), listCloses(), getSettings()]);
  const fee = parseFee(settings.cashFeePct, settings.cashFeeFixed);
  const feeForm = (
    <Panel title="Comisión de la pasarela">
      <p className="mb-3 text-[12.5px] text-fg-muted">Solo para estimar la ganancia (no cambia lo que se cobra). Déjalo vacío si no quieres descontarla.</p>
      <ActionForm action={saveCashFeeAction} className="grid grid-cols-2 gap-3">
        <Field label="Porcentaje por pago">
          <input name="pct" inputMode="decimal" defaultValue={settings.cashFeePct} placeholder="3,29" className="field tabular-nums" />
        </Field>
        <Field label="Valor fijo por pago">
          <input name="fixed" inputMode="numeric" defaultValue={settings.cashFeeFixed} placeholder="900" className="field tabular-nums" />
        </Field>
        <div className="col-span-2">
          <SubmitButton size="sm" variant="secondary">
            Guardar comisión
          </SubmitButton>
        </div>
      </ActionForm>
    </Panel>
  );

  if (!state.started) {
    return (
      <>
        <PageHeader title="Caja" description={`Cuánto se vendió entre un cierre y otro. Cierra la caja cada vez que recargues el saldo de ${supplier}.`} />
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <Panel title="Empezar a usar la caja">
            <ol className="mb-4 space-y-1.5 text-[13px] text-fg-muted">
              <li>
                1. Elige desde cuándo empieza la primera caja: normalmente, el momento de tu <b className="text-fg">último cierre a mano</b>.
              </li>
              <li>2. Las ventas anteriores quedan guardadas como «Inicio» y no se vuelven a contar.</li>
              <li>3. Desde ahí, cada venta pagada se suma a la caja abierta hasta que la cierres.</li>
            </ol>
            <ActionForm action={startCashAction} className="space-y-3">
              <Field label="Contar ventas desde (hora de Colombia)" hint={state.firstSaleAt ? `La primera venta de la tienda fue el ${when(state.firstSaleAt)}.` : "Aún no hay ventas."}>
                <input name="from" type="datetime-local" required defaultValue={toBogotaInput(now)} max={toBogotaInput(now)} className="field max-w-xs" />
              </Field>
              <Field label="Nota (opcional)">
                <input name="note" maxLength={300} placeholder="Ej.: último cierre a mano del 14 de noviembre" className="field" />
              </Field>
              <SubmitButton>Empezar la caja</SubmitButton>
            </ActionForm>
          </Panel>
          {feeForm}
        </div>
      </>
    );
  }

  const { last, summary: s, balance, recharges } = state;
  const cur = balance?.currency ?? last.supplierCurrency ?? "USD";
  const nextNumber = last.number + 1;
  const sinceText = last.opening
    ? `desde ${when(new Date((last.breakdown as { countFrom?: string }).countFrom ?? last.closedAt))}`
    : `desde el cierre #${last.number} (${when(last.closedAt)})`;
  const costCop = centsToCop(s.costCents, s.usdtCop);

  return (
    <>
      <PageHeader
        title="Caja"
        description={`Caja abierta ${sinceText}. Ciérrala cada vez que recargues el saldo de ${supplier}: la caja nueva empieza en cero.`}
        actions={
          <Link href="/admin/proveedor" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white/[0.06] px-3 text-[13px] font-medium ring-1 ring-white/10 hover:bg-white/10">
            Saldo y precios del proveedor <ArrowRight className="size-3.5" />
          </Link>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat label="Vendido" value={formatMoney(s.salesCop)} hint={`${formatNumber(s.orders)} ${s.orders === 1 ? "venta" : "ventas"} en esta caja`} />
        <Stat
          label={`Costo en ${supplier}`}
          value={
            <>
              {formatUsd(s.costCents)} <span className="text-[14px] text-fg-muted">{cur}</span>
            </>
          }
          hint={`≈ ${formatMoney(costCop)} a ${formatMoney(s.usdtCop)} por USDT${s.missingCost ? ` · ${s.missingCost} sin costo guardado` : ""}`}
        />
        <Stat label="Ganancia estimada" value={formatMoney(s.profitCop)} tone={s.profitCop < 0 ? "bad" : undefined} hint={fee.pct || fee.fixed ? "Ya descuenta costo, comisión y reembolsos" : "Descuenta costo y reembolsos (sin comisión)"} />
        <Stat label={`Saldo en ${supplier}`} value={<BalanceValue balance={balance} />} hint={balance ? `≈ ${formatMoney(centsToCop(balance.cents, s.usdtCop))} · ahora mismo` : "No respondió a tiempo"} />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Panel title="Detalle de la caja abierta" bodyClass="px-4 py-1">
            {s.orders === 0 && s.refunds === 0 && s.deliveries === 0 ? (
              <p className="py-4 text-[13px] text-fg-muted">Aún no hay ventas en esta caja.</p>
            ) : (
              <div className="divide-y divide-white/[0.05]">
                {s.breakdown.byType.map((l) => (
                  <Line key={l.label} label={l.label} hint={`${formatNumber(l.orders)} ${l.orders === 1 ? "venta" : "ventas"}${l.costCents ? ` · costo ${formatUsd(l.costCents)} ${cur}` : ""}`} value={formatMoney(l.cop)} />
                ))}
                {s.breakdown.byPayment.map((l) => (
                  <Line key={l.label} label={<span className="text-fg-muted">{l.label}</span>} value={<span className="text-fg-muted">{`${formatNumber(l.orders)} · ${formatMoney(l.cop)}`}</span>} />
                ))}
                <Line label="Costo del proveedor" hint={`${formatUsd(s.costCents)} ${cur} a ${formatMoney(s.usdtCop)} por USDT (tasa de Proveedor y saldo)`} value={`− ${formatMoney(costCop)}`} tone="bad" />
                {s.feeCop > 0 && <Line label="Comisión estimada de la pasarela" hint={`${fee.pct ? `${String(fee.pct).replace(".", ",")} %` : ""}${fee.pct && fee.fixed ? " + " : ""}${fee.fixed ? `${formatMoney(fee.fixed)}` : ""} por pago`} value={`− ${formatMoney(s.feeCop)}`} tone="bad" />}
                {s.refunds > 0 && (
                  <Line
                    label={`Reembolsos (${s.refunds})`}
                    hint={s.refundsCostCents > 0 ? `Vuelven ${formatUsd(s.refundsCostCents)} ${cur} de costo (no se alcanzaron a entregar)` : s.refundsCostCents < 0 ? `Se perdieron ${formatUsd(-s.refundsCostCents)} ${cur} de entregas reembolsadas` : "Ventas de cajas anteriores devueltas al cliente"}
                    value={`− ${formatMoney(s.refundsCop)}`}
                    tone="bad"
                  />
                )}
                <Line label={<b>Ganancia estimada</b>} value={<b className={s.profitCop < 0 ? "text-bad-400" : "text-volt-300"}>{formatMoney(s.profitCop)}</b>} />
              </div>
            )}
          </Panel>

          <Panel title={`Saldo de ${supplier} en esta caja`}>
            <div className="divide-y divide-white/[0.05]">
              <Line label="Saldo al cierre anterior" value={last.supplierBalanceCents != null ? `${formatUsd(last.supplierBalanceCents)} ${cur}` : "Sin dato"} tone="muted" />
              <Line label="Recargas anotadas" hint={recharges.length ? `${recharges.length} · costaron ${formatMoney(s.rechargeCop)}` : "Ninguna todavía"} value={`+ ${formatUsd(s.rechargeCents)} ${cur}`} />
              <Line label="Gastado en entregas" hint={`${formatNumber(s.deliveries)} ${s.deliveries === 1 ? "recarga entregada" : "recargas entregadas"}${s.prizes ? `, incluye ${s.prizes} ${s.prizes === 1 ? "premio" : "premios"} del Top 3 (${formatUsd(s.prizesCostCents)} ${cur})` : ""}`} value={`− ${formatUsd(s.deliveriesCostCents)} ${cur}`} tone="bad" />
              <Line label={<b>Debería haber</b>} value={<b>{s.expectedBalanceCents != null ? `${formatUsd(s.expectedBalanceCents)} ${cur}` : "—"}</b>} />
            </div>
            <div className="mt-3">
              <Reconcile s={s} cur={cur} supplier={supplier} />
            </div>
          </Panel>

          <Panel title={`Recargas a ${supplier} en esta caja`}>
            <p className="mb-3 text-[12.5px] text-fg-muted">Anota cada recarga que hagas en el panel de {supplier}: sirve para cuadrar el saldo y saber cuánto pagaste en pesos.</p>
            {recharges.length > 0 && (
              <ul className="mb-4 divide-y divide-white/[0.05] rounded-[10px] ring-1 ring-white/[0.06]">
                {recharges.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2.5 text-[13px]">
                    <span className="font-semibold tabular-nums">
                      {formatUsd(r.amountCents)} {cur}
                    </span>
                    <span className="tabular-nums text-fg-muted">
                      a {formatMoney(r.rateCop)} = {formatMoney(centsToCop(r.amountCents, r.rateCop))}
                    </span>
                    <span className="text-[12px] text-fg-subtle">
                      {formatDate(r.createdAt)}
                      {r.createdByName ? ` · ${r.createdByName}` : ""}
                      {r.note ? ` · ${r.note}` : ""}
                    </span>
                    <ActionForm action={removeRechargeAction} className="ml-auto">
                      <input type="hidden" name="id" value={r.id} />
                      <ConfirmSubmit size="sm" confirmText="¿Quitar?">
                        Quitar
                      </ConfirmSubmit>
                    </ActionForm>
                  </li>
                ))}
              </ul>
            )}
            <ActionForm action={addRechargeAction} resetOnSuccess className="grid grid-cols-2 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)]">
              <Field label={`Recargaste (${cur})`}>
                <input name="amount" inputMode="decimal" required placeholder="150" className="field tabular-nums" />
              </Field>
              <Field label="Pesos por 1 USDT">
                <input name="rate" inputMode="numeric" required defaultValue={s.usdtCop} className="field tabular-nums" />
              </Field>
              <Field label="Nota (opcional)" className="col-span-2 sm:col-span-1">
                <input name="note" maxLength={300} placeholder="Ej.: Binance P2P" className="field" />
              </Field>
              <div className="col-span-2 sm:col-span-3">
                <SubmitButton size="sm" variant="secondary">
                  Anotar recarga
                </SubmitButton>
              </div>
            </ActionForm>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title={`Cerrar caja #${nextNumber}`}>
            <ul className="mb-4 space-y-1.5 text-[13px] text-fg-muted">
              <li>
                · Las <b className="text-fg">{formatNumber(s.orders)} ventas</b> ({formatMoney(s.salesCop)}) quedan en el cierre #{nextNumber}
                {s.refunds ? ` junto con ${s.refunds} ${s.refunds === 1 ? "reembolso" : "reembolsos"}` : ""}.
              </li>
              <li>· Se guarda el saldo de {supplier} de ese momento para cuadrar la próxima caja.</li>
              <li>· La caja nueva empieza en cero. Un cierre no se edita ni se borra.</li>
              <li>· Lo ideal: cierra justo antes de recargar {supplier} y luego anota la recarga.</li>
            </ul>
            <ActionForm action={closeCashAction} className="space-y-3">
              <input type="hidden" name="number" value={nextNumber} />
              <Field label="Nota del cierre (opcional)">
                <textarea name="note" rows={2} maxLength={2000} placeholder="Ej.: cierre antes de recargar 300 USDT" className="field" />
              </Field>
              <ConfirmSubmit variant="primary" size="md" confirmText={`Sí, cerrar con ${formatMoney(s.salesCop)}`}>
                Cerrar caja #{nextNumber}
              </ConfirmSubmit>
            </ActionForm>
          </Panel>

          <Panel title="Cierres anteriores" bodyClass="p-0">
            {closes.length === 0 ? (
              <p className="p-4 text-[13px] text-fg-muted">Aún no hay cierres.</p>
            ) : (
              <ul className="divide-y divide-white/[0.05]">
                {closes.map((c) => {
                  const diff = closeDiff(c);
                  return (
                    <li key={c.id}>
                      <Link href={`/admin/caja/${c.number}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.03]">
                        <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-white/[0.06] text-[12.5px] font-bold tabular-nums">{c.opening ? "0" : `#${c.number}`}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13.5px] font-semibold">
                            {c.opening ? "Inicio de la caja" : formatMoney(c.salesCop)}
                            {!c.opening && <span className="font-normal text-fg-muted"> · {formatNumber(c.orders)} ventas · ganancia {formatMoney(closeProfit(c))}</span>}
                          </span>
                          <span className="block text-[11.5px] text-fg-subtle">
                            {c.opening ? `Ventas antes del ${formatDate(new Date((c.breakdown as { countFrom?: string }).countFrom ?? c.closedAt))} (${formatNumber(c.orders)})` : formatDate(c.closedAt)}
                            {c.closedByName ? ` · ${c.closedByName}` : ""}
                            {diff != null && (Math.abs(diff) <= BALANCE_TOLERANCE_CENTS ? " · saldo cuadrado" : ` · saldo ${diff > 0 ? "+" : "−"}${formatUsd(Math.abs(diff))} ${c.supplierCurrency ?? "USD"}`)}
                          </span>
                        </span>
                        <ArrowRight className="size-4 text-fg-subtle" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          {feeForm}

          <p className="flex items-center gap-1.5 text-[12px] text-fg-subtle">
            <Download className="size-3.5" /> Cada cierre se descarga para Excel desde su detalle.
          </p>
        </div>
      </div>
    </>
  );
}

