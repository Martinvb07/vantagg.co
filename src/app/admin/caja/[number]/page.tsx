import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import { PageHeader, Panel, Stat, Table } from "@/components/admin/ui";
import { OrderStatusBadge } from "@/components/ui/status";
import { requireAdmin } from "@/lib/auth";
import { formatDate, formatMoney, formatNumber } from "@/lib/money";
import { centsToCop, closeDiff, closeProfit, formatUsd, paymentLabel, BALANCE_TOLERANCE_CENTS, type Breakdown } from "@/domain/cash";
import { closeDetail } from "@/server/cash";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cierre de caja" };

/** Fecha dentro de una frase: sin el punto final de «p. m.» (evita «p. m..»). */
const when = (d: Date) => formatDate(d).replace(/\.$/, "");

export default async function CashClosePage({ params }: { params: Promise<{ number: string }> }) {
  await requireAdmin();
  const d = await closeDetail(Number((await params).number));
  if (!d) notFound();
  const { close: c, sales, refunds, previous } = d;
  const cur = c.supplierCurrency ?? "USD";
  const breakdown = c.breakdown as Breakdown;
  const diff = closeDiff(c);
  const title = c.opening ? "Inicio de la caja" : `Cierre de caja #${c.number}`;
  const description = c.opening
    ? `Ventas pagadas antes del ${when(new Date(breakdown.countFrom ?? c.closedAt))}: ya se habían contado a mano y no entran en ninguna caja.`
    : `${previous ? `Desde ${previous.number === 0 ? "el inicio de la caja" : `el cierre #${previous.number}`} (${when(previous.opening ? new Date((previous.breakdown as Breakdown).countFrom ?? previous.closedAt) : previous.closedAt)})` : "Desde el inicio"} hasta el ${when(c.closedAt)}${c.closedByName ? ` · cerró ${c.closedByName}` : ""}.`;
  const row = (o: (typeof sales)[number]) => {
    const cost = d.costOf(o);
    return (
      <tr key={o.id}>
        <td>
          <Link href={`/admin/pedidos/${o.id}`} className="font-mono text-[12.5px] underline-offset-2 hover:underline">
            {o.number}
          </Link>
        </td>
        <td className="whitespace-nowrap text-fg-muted">{o.paidAt ? formatDate(o.paidAt) : "—"}</td>
        <td>{(o.itemSnapshot as { name?: string }).name ?? (o.type === "TOPUP" ? "Recarga" : "Cuenta")}</td>
        <td className="text-fg-muted">{paymentLabel(o.paymentProvider, o.payments[0]?.method, o.chargeCurrency)}</td>
        <td>
          <OrderStatusBadge status={o.status} />
        </td>
        <td className="text-right tabular-nums">{formatMoney(o.total)}</td>
        <td className="text-right tabular-nums text-fg-muted">{cost != null ? `${formatUsd(cost)} ${cur}` : "—"}</td>
      </tr>
    );
  };
  const head = (
    <thead>
      <tr>
        <th>Pedido</th>
        <th>Pagado</th>
        <th>Producto</th>
        <th>Medio de pago</th>
        <th>Estado hoy</th>
        <th className="text-right">Total</th>
        <th className="text-right">Costo</th>
      </tr>
    </thead>
  );

  return (
    <>
      <Link href="/admin/caja" className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-fg-muted hover:text-fg">
        <ArrowLeft className="size-4" /> Caja
      </Link>
      <PageHeader
        title={title}
        description={description}
        actions={
          <a href={`/api/admin/export/caja/${c.number}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white/[0.06] px-3 text-[13px] font-medium ring-1 ring-white/10 hover:bg-white/10">
            <Download className="size-3.5" /> Descargar para Excel
          </a>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat label="Vendido" value={formatMoney(c.salesCop)} hint={`${formatNumber(c.orders)} ${c.orders === 1 ? "venta" : "ventas"}`} />
        <Stat label="Costo del proveedor" value={`${formatUsd(c.costCents)} ${cur}`} hint={`≈ ${formatMoney(centsToCop(c.costCents, c.usdtCop))} a ${formatMoney(c.usdtCop)} por USDT`} />
        {c.opening ? (
          <Stat label="Saldo al iniciar" value={c.supplierBalanceCents != null ? `${formatUsd(c.supplierBalanceCents)} ${cur}` : "Sin dato"} hint="Punto de partida del cuadre" />
        ) : (
          <Stat label="Ganancia estimada" value={formatMoney(closeProfit(c))} tone={closeProfit(c) < 0 ? "bad" : undefined} hint={`Comisión ${formatMoney(c.feeCop)} · reembolsos ${formatMoney(c.refundsCop)}`} />
        )}
        {!c.opening && (
          <Stat
            label="Saldo al cerrar"
            value={c.supplierBalanceCents != null ? `${formatUsd(c.supplierBalanceCents)} ${cur}` : "Sin dato"}
            tone={diff != null && Math.abs(diff) > BALANCE_TOLERANCE_CENTS ? "warn" : undefined}
            hint={diff == null ? "Sin cuadre en este cierre" : Math.abs(diff) <= BALANCE_TOLERANCE_CENTS ? "Cuadró con la caja" : `Debía haber ${formatUsd(c.expectedBalanceCents ?? 0)} (${diff > 0 ? "+" : "−"}${formatUsd(Math.abs(diff))})`}
          />
        )}
      </div>

      {!c.opening && (
        <div className="mb-6 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2">
          <Panel title="Por medio de pago" bodyClass="px-4 py-1">
            <ul className="divide-y divide-white/[0.05] text-[13.5px]">
              {breakdown.byPayment?.length ? (
                breakdown.byPayment.map((l) => (
                  <li key={l.label} className="flex justify-between gap-4 py-2.5">
                    <span>{l.label}</span>
                    <span className="tabular-nums text-fg-muted">
                      {formatNumber(l.orders)} · <span className="text-fg">{formatMoney(l.cop)}</span>
                    </span>
                  </li>
                ))
              ) : (
                <li className="py-2.5 text-fg-muted">Sin ventas.</li>
              )}
            </ul>
          </Panel>
          <Panel title="Saldo del proveedor" bodyClass="px-4 py-1">
            <ul className="divide-y divide-white/[0.05] text-[13.5px]">
              <li className="flex justify-between gap-4 py-2.5">
                <span>Recargas anotadas</span>
                <span className="tabular-nums">
                  + {formatUsd(c.rechargeCents)} {cur} <span className="text-fg-muted">({formatMoney(c.rechargeCop)})</span>
                </span>
              </li>
              <li className="flex justify-between gap-4 py-2.5">
                <span>
                  Gastado en {formatNumber(c.deliveries)} entregas{c.prizes ? ` (incluye ${c.prizes} ${c.prizes === 1 ? "premio" : "premios"})` : ""}
                </span>
                <span className="tabular-nums text-bad-400">
                  − {formatUsd(c.deliveriesCostCents)} {cur}
                </span>
              </li>
              <li className="flex justify-between gap-4 py-2.5">
                <span>Debía haber / había</span>
                <span className="tabular-nums">
                  {c.expectedBalanceCents != null ? formatUsd(c.expectedBalanceCents) : "—"} / {c.supplierBalanceCents != null ? formatUsd(c.supplierBalanceCents) : "—"} {cur}
                </span>
              </li>
            </ul>
          </Panel>
        </div>
      )}

      {c.note && (
        <Panel title="Nota" className="mb-6">
          <p className="whitespace-pre-wrap text-[13.5px] text-fg-muted">{c.note}</p>
        </Panel>
      )}

      <h2 className="mb-2 text-[14px] font-semibold">Ventas ({formatNumber(sales.length)})</h2>
      {sales.length ? (
        <Table>
          {head}
          <tbody>{sales.map(row)}</tbody>
        </Table>
      ) : (
        <p className="text-[13px] text-fg-muted">Sin ventas en este cierre.</p>
      )}

      {refunds.length > 0 && (
        <>
          <h2 className="mb-2 mt-6 text-[14px] font-semibold">Reembolsos descontados aquí ({formatNumber(refunds.length)})</h2>
          <Table>
            {head}
            <tbody>{refunds.map(row)}</tbody>
          </Table>
        </>
      )}
    </>
  );
}
