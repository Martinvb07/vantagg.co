import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Download, Receipt } from "lucide-react";
import { Field, PageHeader, Panel, Stat } from "@/components/admin/ui";
import { ActionForm, ConfirmSubmit, SubmitButton } from "@/components/admin/action-form";
import { requireAdmin } from "@/lib/auth";
import { formatDate, formatMoney, formatNumber } from "@/lib/money";
import { cn } from "@/lib/utils";
import { bogotaYmd, changePct, monthRange, periodLabel, PRESETS, previousPeriod, resolvePeriod } from "@/domain/accounting";
import { closeProfit, formatUsd } from "@/domain/cash";
import { accountingConfig, accountingSummary, capitalStatus, closesIn, rechargesIn } from "@/server/accounting";
import { EXPENSE_CATEGORIES, listExpenses } from "@/server/expenses";
import { addExpenseAction, removeExpenseAction, saveCapitalAction } from "@/app/actions/accounting";

export const dynamic = "force-dynamic";
export const metadata = { title: "Contabilidad" };

function Delta({ pct, label = "vs. periodo anterior" }: { pct: number | null; label?: string }) {
  if (pct == null) return <>Sin datos del periodo anterior</>;
  return (
    <>
      <span className={cn("font-semibold", pct > 0 ? "text-ok-400" : pct < 0 ? "text-bad-400" : "text-fg-muted")}>
        {pct > 0 ? "+" : ""}
        {String(pct).replace(".", ",")} %
      </span>{" "}
      {label}
    </>
  );
}

/** Línea del estado de resultados. */
function Row({ label, hint, value, strong, tone }: { label: ReactNode; hint?: ReactNode; value: ReactNode; strong?: boolean; tone?: "bad" | "ok" | "muted" }) {
  return (
    <div className={cn("flex items-start justify-between gap-4 py-2.5", strong && "border-t border-white/[0.1]")}>
      <span className="min-w-0">
        <span className={cn("block text-[13.5px]", strong && "font-semibold")}>{label}</span>
        {hint && <span className="block text-[11.5px] text-fg-subtle">{hint}</span>}
      </span>
      <span className={cn("shrink-0 text-right text-[13.5px] tabular-nums", strong && "font-semibold", tone === "bad" && "text-bad-400", tone === "ok" && "text-ok-400", tone === "muted" && "text-fg-muted")}>{value}</span>
    </div>
  );
}

const minus = (n: number) => (n ? `− ${formatMoney(n)}` : formatMoney(0));

export default async function AccountingPage({ searchParams }: { searchParams: Promise<{ p?: string; desde?: string; hasta?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const period = resolvePeriod(sp);
  const prev = previousPeriod(period);
  const [s, before, closes, reinvested, expenses, capital, cfg] = await Promise.all([accountingSummary(period), accountingSummary(prev), closesIn(period), rechargesIn(period), listExpenses(period), capitalStatus(), accountingConfig()]);
  const today = bogotaYmd(new Date());
  const pct = (n: number | null) => (n == null ? "—" : `${String(n).replace(".", ",")} %`);
  const grossMargin = s.netCop > 0 ? Math.round((s.grossProfitCop / s.netCop) * 1000) / 10 : null;
  const noFee = s.feeCop === 0 && s.orders > 0;
  const k = s.costKinds;
  const costSources = [k.real && `${k.real} con lo que cobró el proveedor`, k.venta && `${k.venta} con el costo guardado al vender`, k.estimado && `${k.estimado} estimadas con el costo actual`, s.missingCost && `${s.missingCost} sin costo`].filter(Boolean).join(" · ");
  const range = `desde=${period.fromYmd}&hasta=${period.toYmd}`;
  const rangeText = periodLabel(period.fromYmd, period.toYmd);
  const max = Math.max(1, ...s.series.map((b) => b.salesCop));
  const active = s.series.filter((b) => b.orders || b.refundsCop || b.costCop);
  const unit = s.granularity === "day" ? "día" : "mes";

  return (
    <>
      <PageHeader
        title="Contabilidad"
        description={`${period.preset ? `${period.label} · ` : ""}${rangeText} (hora de Colombia). Las ventas cuentan el día en que se pagaron; los reembolsos, el día en que se hicieron.`}
        actions={
          <>
            <a href={`/admin/pedidos?fecha=pagado&prueba=0&${range}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white/[0.06] px-3 text-[13px] font-medium ring-1 ring-white/10 hover:bg-white/10">
              <Receipt className="size-3.5" /> Ver pedidos
            </a>
            <a href={`/api/admin/export/contabilidad?${range}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-volt-400 px-3 text-[13px] font-semibold text-volt-ink hover:bg-volt-300">
              <Download className="size-3.5" /> Libro de ventas (Excel)
            </a>
          </>
        }
      />

      {/* Periodo: atajos y fechas a mano (enlaces normales: siempre traen los datos al día). */}
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <nav aria-label="Periodo" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
          {PRESETS.map((p) => (
            <a
              key={p.key}
              href={`?p=${p.key}`}
              aria-current={period.preset === p.key ? "page" : undefined}
              className={cn("inline-flex h-9 shrink-0 items-center rounded-full px-3.5 text-[13px] font-medium ring-1", period.preset === p.key ? "bg-fg text-ink-950 ring-fg" : "text-fg-muted ring-white/10 hover:text-fg hover:ring-white/20")}
            >
              {p.label}
            </a>
          ))}
        </nav>
        <form method="get" className="flex flex-wrap items-center gap-2">
          <input type="date" name="desde" defaultValue={period.fromYmd} className="field w-[150px]" aria-label="Desde" />
          <span className="text-[13px] text-fg-subtle">a</span>
          <input type="date" name="hasta" defaultValue={period.toYmd} className="field w-[150px]" aria-label="Hasta" />
          <button type="submit" className="inline-flex h-9 items-center rounded-lg bg-white/[0.08] px-3.5 text-[13px] font-medium ring-1 ring-white/10 hover:bg-white/[0.12]">
            Ver
          </button>
        </form>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat label="Ventas" value={formatMoney(s.salesCop)} hint={<Delta pct={changePct(s.salesCop, before.salesCop)} />} />
        <Stat label="Pedidos pagados" value={formatNumber(s.orders)} hint={`${formatNumber(s.buyers)} ${s.buyers === 1 ? "comprador" : "compradores"} · promedio ${formatMoney(s.avgTicketCop)}`} />
        <Stat label="Ganancia bruta" value={formatMoney(s.grossProfitCop)} tone={s.grossProfitCop < 0 ? "bad" : undefined} hint={`Ventas netas − costo del proveedor · margen ${pct(grossMargin)}`} />
        <Stat
          label="Ganancia neta"
          value={formatMoney(s.profitCop)}
          tone={s.profitCop < 0 ? "bad" : undefined}
          hint={noFee ? <span className="text-warn-400">Falta la comisión de Bold: sale más alta de lo real</span> : <>Margen {pct(s.marginPct)} · <Delta pct={changePct(s.profitCop, before.profitCop)} label="vs. anterior" /></>}
        />
      </div>

      <Panel title="Cuadre del negocio" className="mb-6">
        {capital ? (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-x-8 lg:grid-cols-2">
            <div className="divide-y divide-white/[0.05]">
              <Row label="Capital con el que empezaste" hint={`Desde el ${periodLabel(capital.since, capital.since)}`} value={formatMoney(capital.capitalCop)} tone="muted" />
              <Row label="Ganancia neta desde ese día" hint={`Sobre ${formatMoney(capital.salesCop)} en ventas netas`} value={`${capital.profitCop < 0 ? "−" : "+"} ${formatMoney(Math.abs(capital.profitCop))}`} tone={capital.profitCop < 0 ? "bad" : "ok"} />
              <Row label="El negocio debería tener" value={formatMoney(capital.shouldHave)} strong />
              <Row
                label="En el saldo de Central One"
                hint={capital.balance ? `${formatUsd(capital.balance.cents)} ${capital.balance.currency} a la tasa de hoy` : "Central One no respondió: recarga la página"}
                value={capital.inSupplierCop != null ? formatMoney(capital.inSupplierCop) : "—"}
              />
              <Row label="Debería estar en Bold, el banco o efectivo" value={capital.elsewhereCop != null ? formatMoney(capital.elsewhereCop) : "—"} strong />
            </div>
            <div className="py-3 text-[12.5px] leading-relaxed text-fg-muted lg:border-l lg:border-white/[0.06] lg:pl-8">
              <p>
                <b className="text-fg">Así se comprueba la ganancia con la realidad.</b> Suma lo que tienes en Bold (incluidos los pagos que aún no te consigna), en el banco y en
                efectivo: debería dar la última cifra. Si da menos, falta anotar gastos (publicidad, comisiones, compra de USDT más cara que la tasa del día) o hay
                retiros personales.
              </p>
              <details className="mt-3">
                <summary className="cursor-pointer text-fg-subtle hover:text-fg">Cambiar capital o fecha</summary>
                <ActionForm action={saveCapitalAction} className="mt-3 grid grid-cols-2 gap-3">
                  <Field label="Capital (pesos)">
                    <input name="capital" inputMode="numeric" defaultValue={cfg.capitalCop || ""} className="field tabular-nums" />
                  </Field>
                  <Field label="Desde">
                    <input name="since" type="date" defaultValue={cfg.capitalSince} max={today} className="field" />
                  </Field>
                  <div className="col-span-2">
                    <SubmitButton size="sm" variant="secondary">
                      Guardar
                    </SubmitButton>
                  </div>
                </ActionForm>
              </details>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2">
            <p className="text-[13px] leading-relaxed text-fg-muted">
              <b className="text-fg">¿Con cuánto empezaste?</b> Con el capital inicial y la fecha, aquí verás cuánto debería tener el negocio hoy (capital + ganancia neta),
              cuánto está en el saldo de Central One y cuánto debería estar en Bold o el banco. Así la ganancia se comprueba contra la plata real.
            </p>
            <ActionForm action={saveCapitalAction} className="grid grid-cols-2 gap-3">
              <Field label="Capital (pesos)">
                <input name="capital" inputMode="numeric" placeholder="1.000.000" required className="field tabular-nums" />
              </Field>
              <Field label="Desde">
                <input name="since" type="date" required max={today} className="field" />
              </Field>
              <div className="col-span-2">
                <SubmitButton size="sm">Guardar capital</SubmitButton>
              </div>
            </ActionForm>
          </div>
        )}
      </Panel>

      <div className="mb-6 grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Panel title="Estado de resultados" bodyClass="px-4 py-1">
          <Row label="Precio de lista" hint={`${formatNumber(s.orders)} pedidos pagados`} value={formatMoney(s.grossCop)} tone="muted" />
          <Row label="Descuentos (códigos)" value={minus(s.discountCop)} tone={s.discountCop ? "bad" : "muted"} />
          <Row label="Ventas (cobrado)" value={formatMoney(s.salesCop)} strong />
          <Row label="Reembolsos" hint={s.refunds ? `${s.refunds} en este periodo` : undefined} value={minus(s.refundsCop)} tone={s.refundsCop ? "bad" : "muted"} />
          <Row label="Ventas netas" value={formatMoney(s.netCop)} strong />
          <Row label="Costo del proveedor" hint={`${formatUsd(s.costCents)} USD a la tasa del dólar del día de cada venta${costSources ? ` · ${costSources}` : ""}`} value={minus(s.costCop)} tone="bad" />
          {s.costBackCop > 0 && <Row label="Costo que vuelve" hint="Reembolsos de recargas que no se entregaron" value={`+ ${formatMoney(s.costBackCop)}`} tone="ok" />}
          <Row label="Ganancia bruta" hint={`Margen bruto ${pct(grossMargin)}`} value={formatMoney(s.grossProfitCop)} strong />
          <Row
            label="Comisión de la pasarela"
            hint={
              s.feeCop ? (
                "Configurada en Caja"
              ) : (
                <span className="text-warn-400">
                  Sin configurar: la ganancia neta sale más alta de lo real ·{" "}
                  <Link href="/admin/caja" className="underline underline-offset-2">
                    configurar en Caja
                  </Link>
                </span>
              )
            }
            value={minus(s.feeCop)}
            tone={s.feeCop ? "bad" : "muted"}
          />
          {s.prizes > 0 && <Row label={`Premios del Top 3 (${s.prizes})`} hint="Costo de las recargas regaladas" value={minus(s.prizesCostCop)} tone="bad" />}
          {s.expensesByCategory.map((c) => (
            <Row key={c.label} label={c.label} hint={`${c.count} ${c.count === 1 ? "gasto anotado" : "gastos anotados"}`} value={minus(c.cop)} tone="bad" />
          ))}
          {s.expensesCop === 0 && <Row label="Gastos del negocio" hint="Publicidad, bancos, impuestos… anótalos abajo" value={formatMoney(0)} tone="muted" />}
          <Row label="Ganancia neta" hint={`Margen neto ${pct(s.marginPct)}`} value={<span className={s.profitCop < 0 ? "text-bad-400" : "text-volt-300"}>{formatMoney(s.profitCop)}</span>} strong />
          <p className="pb-3 pt-1 text-[11.5px] text-fg-subtle">
            Dólar: tasa del día de cada venta (promedio del periodo {formatMoney(s.rate.average)}; hoy {formatMoney(s.rate.current)}
            {s.rate.source === "mercado" ? ", tasa de mercado" : ", tasa configurada en Proveedor"}). El costo es lo que Central One cobró en cada entrega; si aún no se sabe, el costo guardado al vender.
          </p>
        </Panel>

        <Panel title={`Ventas por ${unit}`}>
          {s.salesCop === 0 && s.refundsCop === 0 ? (
            <p className="py-10 text-center text-[13px] text-fg-muted">Sin ventas en este periodo.</p>
          ) : (
            <>
              {s.series.length > 1 && (
                <div className="mb-4">
                  <div className="flex h-36 items-end gap-[3px]" role="img" aria-label={`Ventas por ${unit}`}>
                    {s.series.map((b) => (
                      <div key={b.key} className="group relative flex h-full flex-1 items-end" title={`${b.label}: ${formatMoney(b.salesCop)} · ${b.orders} pedidos`}>
                        <div className={cn("w-full rounded-t-[3px]", b.salesCop ? "bg-volt-400/80 group-hover:bg-volt-300" : "bg-white/[0.05]")} style={{ height: `${Math.max(b.salesCop ? 4 : 2, (b.salesCop / max) * 100)}%` }} />
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 flex justify-between text-[11px] text-fg-subtle">
                    <span>{s.series[0]?.label}</span>
                    <span>{s.series.at(-1)?.label}</span>
                  </div>
                </div>
              )}
              <div className="max-h-[420px] overflow-y-auto">
                <table className="w-full text-[13px] tabular-nums">
                  <thead className="sticky top-0 bg-ink-850 text-[11px] uppercase tracking-wider text-fg-subtle">
                    <tr>
                      <th className="py-2 text-left font-medium">{s.granularity === "day" ? "Día" : "Mes"}</th>
                      <th className="py-2 text-right font-medium">Pedidos</th>
                      <th className="py-2 text-right font-medium">Ventas</th>
                      <th className="py-2 text-right font-medium max-sm:hidden">Reembolsos</th>
                      <th className="py-2 text-right font-medium">Ganancia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.05]">
                    {[...active].reverse().map((b) => (
                      <tr key={b.key}>
                        <td className="py-2">
                          {s.granularity === "day" ? (
                            <a href={`/admin/pedidos?fecha=pagado&prueba=0&desde=${b.key}&hasta=${b.key}`} className="hover:text-volt-300 hover:underline">
                              {b.label}
                            </a>
                          ) : (
                            <a href={`?desde=${monthRange(b.key).from}&hasta=${monthRange(b.key).to}`} className="capitalize hover:text-volt-300 hover:underline">
                              {b.label}
                            </a>
                          )}
                        </td>
                        <td className="py-2 text-right text-fg-muted">{formatNumber(b.orders)}</td>
                        <td className="py-2 text-right">{formatMoney(b.salesCop)}</td>
                        <td className="py-2 text-right text-fg-muted max-sm:hidden">{b.refundsCop ? `− ${formatMoney(b.refundsCop)}` : "—"}</td>
                        <td className={cn("py-2 text-right", b.profitCop < 0 && "text-bad-400")}>{formatMoney(b.profitCop)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[11.5px] text-fg-subtle">{s.granularity === "day" ? "Los días sin movimientos no se muestran. Toca un día para ver sus pedidos." : "Toca un mes para verlo por días."}</p>
            </>
          )}
        </Panel>
      </div>

      <Panel title={`Gastos del negocio (${formatMoney(s.expensesCop)})`} className="mb-6">
        <p className="mb-3 text-[12.5px] text-fg-muted">Anota lo que se gasta para vender (publicidad, comisiones del banco, impuestos, la diferencia al comprar USDT…): se resta de la ganancia neta del día del gasto.</p>
        {expenses.length > 0 && (
          <ul className="mb-4 divide-y divide-white/[0.05] rounded-[10px] ring-1 ring-white/[0.06]">
            {expenses.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2.5 text-[13px]">
                <span className="w-24 shrink-0 tabular-nums text-fg-muted">{periodLabel(e.day, e.day)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block">{e.concept}</span>
                  <span className="block text-[11.5px] text-fg-subtle">
                    {e.category}
                    {e.createdByName ? ` · ${e.createdByName}` : ""}
                  </span>
                </span>
                <span className="font-semibold tabular-nums">{formatMoney(e.amountCop)}</span>
                <ActionForm action={removeExpenseAction}>
                  <input type="hidden" name="id" value={e.id} />
                  <ConfirmSubmit size="sm" confirmText="¿Quitar?">
                    Quitar
                  </ConfirmSubmit>
                </ActionForm>
              </li>
            ))}
          </ul>
        )}
        <ActionForm action={addExpenseAction} resetOnSuccess className="grid grid-cols-2 gap-3 lg:grid-cols-[150px_200px_minmax(0,1fr)_150px_auto] lg:items-end">
          <Field label="Fecha">
            <input name="day" type="date" required defaultValue={today} max={today} className="field" />
          </Field>
          <Field label="Categoría">
            <select name="category" className="field" defaultValue="Publicidad">
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Concepto" className="col-span-2 lg:col-span-1">
            <input name="concept" required maxLength={200} placeholder="Ej.: Anuncios de Meta" className="field" />
          </Field>
          <Field label="Valor (pesos)">
            <input name="amount" required inputMode="numeric" placeholder="50.000" className="field tabular-nums" />
          </Field>
          <div className="flex items-end">
            <SubmitButton size="md" variant="secondary">
              Anotar gasto
            </SubmitButton>
          </div>
        </ActionForm>
      </Panel>

      <Panel title="Dinero del periodo" className="mb-6" bodyClass="px-4 py-1">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-x-8 lg:grid-cols-2">
          <div>
            <Row label="Entró por ventas" hint="Ventas netas (después de reembolsos)" value={formatMoney(s.netCop)} />
            <Row label="Reinvertido en el proveedor" hint={reinvested.count ? `${reinvested.count} ${reinvested.count === 1 ? "recarga anotada" : "recargas anotadas"} en Caja (${formatUsd(reinvested.cents)} USD)` : "Sin recargas anotadas en Caja en estas fechas"} value={minus(reinvested.cop)} tone={reinvested.cop ? "bad" : "muted"} />
            <Row label="Diferencia en efectivo" value={<span className={s.netCop - reinvested.cop < 0 ? "text-bad-400" : ""}>{formatMoney(s.netCop - reinvested.cop)}</span>} strong />
          </div>
          <p className="py-3 text-[12.5px] leading-relaxed text-fg-muted lg:border-l lg:border-white/[0.06] lg:pl-8">
            <b className="text-fg">Ganancia no es efectivo en mano.</b> De cada venta, la mayor parte repone el saldo que se gastó en el proveedor; solo la
            ganancia es lo que el negocio gana de más. Si todo lo que entra se vuelve a recargar en el proveedor, ese dinero está en el saldo
            (capital de trabajo), no en caja. Anota cada recarga en <Link href="/admin/caja" className="text-volt-300 underline underline-offset-2">Caja</Link> para que aquí se vea lo reinvertido.
          </p>
        </div>
      </Panel>

      <div className="mb-6 grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-2">
        <Panel title="Por producto" bodyClass="px-4 pb-2 pt-1">
          {s.byProduct.length === 0 ? (
            <p className="py-4 text-[13px] text-fg-muted">Sin ventas.</p>
          ) : (
            <table className="w-full text-[13px] tabular-nums">
              <thead className="text-[11px] uppercase tracking-wider text-fg-subtle">
                <tr>
                  <th className="py-2 text-left font-medium">Producto</th>
                  <th className="py-2 pl-3 text-right font-medium">Vendidos</th>
                  <th className="py-2 pl-3 text-right font-medium">Ventas</th>
                  <th className="py-2 pl-3 text-right font-medium max-sm:hidden">Costo</th>
                  <th className="py-2 pl-3 text-right font-medium">Ganancia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {s.byProduct.map((l) => (
                  <tr key={l.label}>
                    <td className="py-2.5 pr-2">{l.label}</td>
                    <td className="py-2.5 pl-3 text-right text-fg-muted">{formatNumber(l.orders)}</td>
                    <td className="py-2.5 pl-3 text-right">{formatMoney(l.salesCop)}</td>
                    <td className="py-2.5 pl-3 text-right text-fg-muted max-sm:hidden">{l.missingCost ? <span className="text-warn-400">{l.missingCost === l.orders ? "Sin costo" : `${formatMoney(l.costCop)} (${l.missingCost} sin costo)`}</span> : formatMoney(l.costCop)}</td>
                    <td className={cn("py-2.5 text-right", l.profitCop < 0 && "text-bad-400")}>
                      {formatMoney(l.profitCop)}
                      {l.missingCost ? <span className="block text-[11px] text-warn-400">sin costo: no es real</span> : l.salesCop > 0 && <span className="block text-[11px] text-fg-subtle">{String(Math.round((l.profitCop / l.salesCop) * 1000) / 10).replace(".", ",")} %</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
        <div className="space-y-6">
          <Panel title="Por medio de pago" bodyClass="px-4 py-1">
            {s.byPayment.length === 0 ? (
              <p className="py-4 text-[13px] text-fg-muted">Sin ventas.</p>
            ) : (
              s.byPayment.map((l) => <Row key={l.label} label={l.label} hint={`${formatNumber(l.orders)} ${l.orders === 1 ? "pago" : "pagos"} · ${s.salesCop ? Math.round((l.salesCop / s.salesCop) * 100) : 0} % de las ventas`} value={formatMoney(l.salesCop)} />)
            )}
          </Panel>
          {s.byType.length > 1 && (
            <Panel title="Por tipo" bodyClass="px-4 py-1">
              {s.byType.map((l) => (
                <Row key={l.label} label={l.label} hint={`${formatNumber(l.orders)} ventas · ganancia ${formatMoney(l.profitCop)}`} value={formatMoney(l.salesCop)} />
              ))}
            </Panel>
          )}
          <Panel title="Cierres de caja en este periodo" bodyClass="p-0">
            {closes.length === 0 ? (
              <p className="p-4 text-[13px] text-fg-muted">
                Ningún cierre en estas fechas.{" "}
                <Link href="/admin/caja" className="text-volt-300 underline underline-offset-2">
                  Ir a Caja
                </Link>
              </p>
            ) : (
              <ul className="divide-y divide-white/[0.05]">
                {closes.map((c) => (
                  <li key={c.id}>
                    <Link href={`/admin/caja/${c.number}`} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03]">
                      <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-white/[0.06] text-[12.5px] font-bold tabular-nums">#{c.number}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13.5px] font-semibold">
                          {formatMoney(c.salesCop)} <span className="font-normal text-fg-muted">· {formatNumber(c.orders)} ventas · ganancia {formatMoney(closeProfit(c))}</span>
                        </span>
                        <span className="block text-[11.5px] text-fg-subtle">
                          {formatDate(c.closedAt)}
                          {c.closedByName ? ` · ${c.closedByName}` : ""}
                        </span>
                      </span>
                      <ArrowRight className="size-4 text-fg-subtle" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
