import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Download, Receipt } from "lucide-react";
import { PageHeader, Panel, Stat } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { formatDate, formatMoney, formatNumber } from "@/lib/money";
import { cn } from "@/lib/utils";
import { changePct, monthRange, periodLabel, PRESETS, previousPeriod, resolvePeriod } from "@/domain/accounting";
import { closeProfit, formatUsd } from "@/domain/cash";
import { accountingConfig, accountingSummary, closesIn } from "@/server/accounting";

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
  const [s, before, closes, cfg] = await Promise.all([accountingSummary(period), accountingSummary(prev), closesIn(period), accountingConfig()]);
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
        <Stat label="Ventas netas" value={formatMoney(s.netCop)} hint={s.refunds ? `Después de ${s.refunds} ${s.refunds === 1 ? "reembolso" : "reembolsos"} (${formatMoney(s.refundsCop)})` : "Sin reembolsos"} />
        <Stat label="Ganancia estimada" value={formatMoney(s.profitCop)} tone={s.profitCop < 0 ? "bad" : undefined} hint={s.marginPct != null ? <>Margen {String(s.marginPct).replace(".", ",")} % · <Delta pct={changePct(s.profitCop, before.profitCop)} label="vs. anterior" /></> : "Sin ventas"} />
      </div>

      <div className="mb-6 grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Panel title="Estado de resultados" bodyClass="px-4 py-1">
          <Row label="Precio de lista" hint={`${formatNumber(s.orders)} pedidos pagados`} value={formatMoney(s.grossCop)} tone="muted" />
          <Row label="Descuentos (códigos)" value={minus(s.discountCop)} tone={s.discountCop ? "bad" : "muted"} />
          <Row label="Ventas (cobrado)" value={formatMoney(s.salesCop)} strong />
          <Row label="Reembolsos" hint={s.refunds ? `${s.refunds} en este periodo` : undefined} value={minus(s.refundsCop)} tone={s.refundsCop ? "bad" : "muted"} />
          <Row label="Ventas netas" value={formatMoney(s.netCop)} strong />
          <Row label="Costo del proveedor" hint={`${formatUsd(s.costCents)} USD${s.missingCost ? ` · ${s.missingCost} sin costo guardado` : ""}`} value={minus(s.costCop)} tone="bad" />
          {s.costBackCop > 0 && <Row label="Costo que vuelve" hint="Reembolsos de recargas que no se entregaron" value={`+ ${formatMoney(s.costBackCop)}`} tone="ok" />}
          <Row
            label="Comisión de la pasarela"
            hint={
              s.feeCop ? (
                "Estimada con la comisión de Caja"
              ) : (
                <>
                  Sin comisión configurada ·{" "}
                  <Link href="/admin/caja" className="underline underline-offset-2">
                    configurar en Caja
                  </Link>
                </>
              )
            }
            value={minus(s.feeCop)}
            tone={s.feeCop ? "bad" : "muted"}
          />
          {s.prizes > 0 && <Row label={`Premios del Top 3 (${s.prizes})`} hint="Costo de las recargas regaladas" value={minus(s.prizesCostCop)} tone="bad" />}
          <Row label="Ganancia estimada" value={<span className={s.profitCop < 0 ? "text-bad-400" : "text-volt-300"}>{formatMoney(s.profitCop)}</span>} strong />
          <p className="pb-3 pt-1 text-[11.5px] text-fg-subtle">
            El costo se pasa a pesos con la tasa guardada en cada venta (los pedidos viejos usan la tasa actual: {formatMoney(cfg.usdtCop)} por USDT).
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
                    <td className="py-2.5 pl-3 text-right text-fg-muted max-sm:hidden">{formatMoney(l.costCop)}</td>
                    <td className={cn("py-2.5 text-right", l.profitCop < 0 && "text-bad-400")}>
                      {formatMoney(l.profitCop)}
                      {l.salesCop > 0 && <span className="block text-[11px] text-fg-subtle">{String(Math.round((l.profitCop / l.salesCop) * 1000) / 10).replace(".", ",")} %</span>}
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
