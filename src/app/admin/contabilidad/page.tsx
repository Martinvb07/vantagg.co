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
  const range = `desde=${period.fromYmd}&hasta=${period.toYmd}`;
  const max = Math.max(1, ...s.series.map((b) => b.salesCop));
  const active = s.series.filter((b) => b.orders || b.refundsCop || b.costCop);
  const unit = s.granularity === "day" ? "día" : "mes";
  const capitalForm = (
    <ActionForm action={saveCapitalAction} className="mt-2 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 sm:grid-cols-[minmax(0,200px)_minmax(0,180px)_auto] sm:items-end">
      <Field label="Capital inicial (pesos)">
        <input name="capital" inputMode="numeric" defaultValue={cfg.capitalCop || ""} placeholder="1.000.000" required className="field tabular-nums" />
      </Field>
      <Field label="Desde">
        <input name="since" type="date" defaultValue={cfg.capitalSince} required max={today} className="field" />
      </Field>
      <div className="col-span-2 sm:col-span-1">
        <SubmitButton size="md" variant="secondary">
          Guardar
        </SubmitButton>
      </div>
    </ActionForm>
  );

  return (
    <>
      <PageHeader
        title="Contabilidad"
        actions={
          <>
            <a href={`/admin/pedidos?fecha=pagado&prueba=0&${range}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white/[0.06] px-3 text-[13px] font-medium ring-1 ring-white/10 hover:bg-white/10">
              <Receipt className="size-3.5" /> Ver pedidos
            </a>
            <a href={`/api/admin/export/contabilidad?${range}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-volt-400 px-3 text-[13px] font-semibold text-volt-ink hover:bg-volt-300">
              <Download className="size-3.5" /> Excel
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
        <form method="get" className="flex items-center gap-2">
          <input type="date" name="desde" defaultValue={period.fromYmd} className="field min-w-0 flex-1 sm:w-[150px] sm:flex-none" aria-label="Desde" />
          <span className="text-[13px] text-fg-subtle">a</span>
          <input type="date" name="hasta" defaultValue={period.toYmd} className="field min-w-0 flex-1 sm:w-[150px] sm:flex-none" aria-label="Hasta" />
          <button type="submit" className="inline-flex h-9 shrink-0 items-center rounded-lg bg-white/[0.08] px-3.5 text-[13px] font-medium ring-1 ring-white/10 hover:bg-white/[0.12]">
            Ver
          </button>
        </form>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat label="Ventas" value={formatMoney(s.salesCop)} hint={<Delta pct={changePct(s.salesCop, before.salesCop)} />} />
        <Stat label="Pedidos" value={formatNumber(s.orders)} hint={`${formatNumber(s.buyers)} ${s.buyers === 1 ? "comprador" : "compradores"}`} />
        <Stat label="Ganancia bruta" value={formatMoney(s.grossProfitCop)} tone={s.grossProfitCop < 0 ? "bad" : undefined} hint={`Margen ${pct(grossMargin)}`} />
        <Stat label="Ganancia neta" value={formatMoney(s.profitCop)} tone={s.profitCop < 0 ? "bad" : undefined} hint={`Margen ${pct(s.marginPct)}`} />
      </div>

      <div className="mb-6 grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Panel title="Estado de resultados" bodyClass="px-4 py-1">
          <Row label="Precio de lista" value={formatMoney(s.grossCop)} tone="muted" />
          <Row label="Descuentos (códigos)" value={minus(s.discountCop)} tone={s.discountCop ? "bad" : "muted"} />
          <Row label="Ventas (cobrado)" value={formatMoney(s.salesCop)} strong />
          <Row label="Reembolsos" value={minus(s.refundsCop)} tone={s.refundsCop ? "bad" : "muted"} />
          <Row label="Ventas netas" value={formatMoney(s.netCop)} strong />
          <Row label="Costo del proveedor" hint={`${formatUsd(s.costCents)} USD${s.missingCost ? ` · ${s.missingCost} sin costo` : ""}`} value={minus(s.costCop)} tone="bad" />
          {s.costBackCop > 0 && <Row label="Costo que vuelve" value={`+ ${formatMoney(s.costBackCop)}`} tone="ok" />}
          <Row label="Ganancia bruta" value={formatMoney(s.grossProfitCop)} strong />
          <Row label={cfg.fee.mode === "bold" ? "Comisión de Bold (aprox.)" : "Comisión de la pasarela"} value={minus(s.feeCop)} tone={s.feeCop ? "bad" : "muted"} />
          {s.prizes > 0 && <Row label={`Premios del Top 3 (${s.prizes})`} value={minus(s.prizesCostCop)} tone="bad" />}
          {s.expensesByCategory.map((c) => (
            <Row key={c.label} label={c.label} value={minus(c.cop)} tone="bad" />
          ))}
          {s.expensesCop === 0 && <Row label="Gastos" value={formatMoney(0)} tone="muted" />}
          <Row label="Ganancia neta" value={<span className={s.profitCop < 0 ? "text-bad-400" : "text-volt-300"}>{formatMoney(s.profitCop)}</span>} strong />
          <p className="pb-3 pt-1 text-[11.5px] text-fg-subtle">Dólar de hoy: {formatMoney(s.rate.current)}</p>
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
            </>
          )}
        </Panel>
      </div>

      <div className="mb-6 grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-2">
        <Panel title="Cuadre del negocio" bodyClass="px-4 py-1">
          {capital ? (
            <>
              <Row label="Capital inicial" hint={`Desde el ${periodLabel(capital.since, capital.since)}`} value={formatMoney(capital.capitalCop)} tone="muted" />
              <Row label="Ganancia neta desde entonces" value={`${capital.profitCop < 0 ? "−" : "+"} ${formatMoney(Math.abs(capital.profitCop))}`} tone={capital.profitCop < 0 ? "bad" : "ok"} />
              <Row label="Debería tener" value={formatMoney(capital.shouldHave)} strong />
              <Row label="En Central One" hint={capital.balance ? `${formatUsd(capital.balance.cents)} ${capital.balance.currency}` : "Sin respuesta"} value={capital.inSupplierCop != null ? formatMoney(capital.inSupplierCop) : "—"} />
              <Row label="En Bold, banco o efectivo" value={capital.elsewhereCop != null ? formatMoney(capital.elsewhereCop) : "—"} strong />
              <details className="border-t border-white/[0.06] py-2.5">
                <summary className="cursor-pointer text-[12.5px] text-fg-subtle hover:text-fg">Cambiar capital</summary>
                {capitalForm}
              </details>
            </>
          ) : (
            <div className="py-3">{capitalForm}</div>
          )}
        </Panel>
        <Panel title="Dinero del periodo" className="self-start" bodyClass="px-4 py-1">
          <Row label="Entró por ventas" value={formatMoney(s.netCop)} />
          <Row label="Reinvertido en Central One" hint={reinvested.count ? `${reinvested.count} ${reinvested.count === 1 ? "recarga anotada" : "recargas anotadas"} en Caja` : "Anota las recargas en Caja"} value={minus(reinvested.cop)} tone={reinvested.cop ? "bad" : "muted"} />
          <Row label="Diferencia" value={<span className={s.netCop - reinvested.cop < 0 ? "text-bad-400" : ""}>{formatMoney(s.netCop - reinvested.cop)}</span>} strong />
        </Panel>
      </div>

      <Panel title={`Gastos (${formatMoney(s.expensesCop)})`} className="mb-6">
        {expenses.length > 0 && (
          <ul className="mb-4 divide-y divide-white/[0.05] rounded-[10px] ring-1 ring-white/[0.06]">
            {expenses.map((e) => (
              <li key={e.id} className="flex items-center gap-3 px-3 py-2.5 text-[13px]">
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{e.concept}</span>
                  <span className="block text-[11.5px] text-fg-subtle">
                    {periodLabel(e.day, e.day)} · {e.category}
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
        <ActionForm action={addExpenseAction} resetOnSuccess className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 xl:grid-cols-[150px_200px_minmax(0,1fr)_150px_auto] xl:items-end">
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
          <Field label="Concepto" className="col-span-2 xl:col-span-1">
            <input name="concept" required maxLength={200} placeholder="Anuncios de Meta" className="field" />
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
                      {l.missingCost ? <span className="block text-[11px] text-warn-400">sin costo</span> : l.salesCop > 0 && <span className="block text-[11px] text-fg-subtle">{String(Math.round((l.profitCop / l.salesCop) * 1000) / 10).replace(".", ",")} %</span>}
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
              s.byPayment.map((l) => <Row key={l.label} label={l.label} hint={`${formatNumber(l.orders)} · ${s.salesCop ? Math.round((l.salesCop / s.salesCop) * 100) : 0} %`} value={formatMoney(l.salesCop)} />)
            )}
          </Panel>
          {s.byType.length > 1 && (
            <Panel title="Por tipo" bodyClass="px-4 py-1">
              {s.byType.map((l) => (
                <Row key={l.label} label={l.label} hint={`${formatNumber(l.orders)} ventas`} value={formatMoney(l.salesCop)} />
              ))}
            </Panel>
          )}
          <Panel title="Cierres de caja en este periodo" bodyClass="p-0">
            {closes.length === 0 ? (
              <p className="p-4 text-[13px] text-fg-muted">
                Ningún cierre en estas fechas.
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
