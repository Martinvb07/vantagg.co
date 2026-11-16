import { audit } from "@/lib/audit";
import { getCurrentUser, isStaff } from "@/lib/auth";
import { csvResponse, toCsv } from "@/lib/csv";
import { ORDER_STATUS_META } from "@/domain/order-status";
import { resolvePeriod, ymdStart } from "@/domain/accounting";
import { listExpenses } from "@/server/expenses";
import { centsToCop, feeFor, paymentLabel } from "@/domain/cash";
import { accountingConfig, costOf, ledgerOrders, loadRates, rateOn, type LedgerOrder } from "@/server/accounting";

export const dynamic = "force-dynamic";

/** Hora de Colombia «2026-11-15 08:30». */
const bogota = (d: Date | null) => (d ? new Date(d.getTime() - 5 * 3_600_000).toISOString().replace("T", " ").slice(0, 16) : "");
const snap = (o: LedgerOrder) => (o.itemSnapshot ?? {}) as { name?: string };
const SOURCE = { real: "Cobrado por el proveedor", venta: "Guardado al vender", estimado: "Estimado (costo actual del paquete)" } as const;

/**
 * Libro de ventas del periodo para Excel: un movimiento por fila (venta por fecha de pago, reembolso por fecha de
 * reembolso, premio del Top 3 por fecha de entrega y gasto del negocio por su día), con costo, comisión estimada y ganancia. Incluye el correo del
 * cliente: solo administradores con 2FA, igual que la exportación de pedidos.
 */
export async function GET(req: Request) {
  const user = await getCurrentUser().catch(() => null);
  if (!user || user.role !== "ADMIN" || !user.totpEnabledAt) return new Response("No autorizado", { status: user && isStaff(user.role) ? 403 : 401 });
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const period = resolvePeriod(sp);
  const [{ sales, refunds, prizes }, cfg, rates, expenses] = await Promise.all([ledgerOrders(period), accountingConfig(), loadRates(period), listExpenses(period)]);

  type Row = { at: Date; cells: (string | number | null)[] };
  const rows: Row[] = [];
  const line = (kind: "Venta" | "Reembolso" | "Premio Top 3", at: Date, o: LedgerOrder) => {
    const s = snap(o);
    const c = costOf(o);
    const cents = c?.cents ?? null;
    // Tasa del día de la venta (en un premio, del día de la entrega).
    const rate = Math.round(rateOn(rates, kind === "Premio Top 3" ? o.deliveredAt! : (o.paidAt ?? at), o));
    const cost = cents != null ? centsToCop(cents, rate) : 0;
    let total = o.total;
    let fee = 0;
    let costCol: number | null = cost;
    let profit = 0;
    if (kind === "Venta") {
      fee = feeFor(o.total, cfg.fee);
      profit = o.total - fee - cost;
    } else if (kind === "Reembolso") {
      // Si la recarga nunca se entregó, su costo vuelve (costo negativo).
      const back = o.deliveredAt == null ? cost : 0;
      total = -o.total;
      costCol = back ? -back : 0;
      profit = back - o.total;
    } else {
      total = 0;
      profit = -cost;
    }
    rows.push({
      at,
      cells: [
        bogota(at),
        kind,
        o.number,
        o.type === "TOPUP" ? "Recarga" : "Cuenta",
        s.name ?? "",
        o.customerEmail,
        o.playerId ?? "",
        kind === "Premio Top 3" ? "Premio (sin cobro)" : paymentLabel(o.paymentProvider, o.payments[0]?.method, o.chargeCurrency),
        kind === "Venta" ? o.subtotal : null,
        kind === "Venta" ? -o.discount || 0 : null,
        kind === "Venta" ? o.promoCode ?? "" : "",
        total,
        cents != null ? (cents / 100).toFixed(2) : "",
        cents != null ? rate : null,
        c ? SOURCE[c.kind] : o.type === "TOPUP" ? "Sin costo" : "",
        costCol,
        fee || null,
        profit,
        ORDER_STATUS_META[o.status].label,
        kind === "Reembolso" ? (o.refundClose ? `#${o.refundClose.number}` : "Abierta") : kind === "Venta" ? (o.cashClose ? `#${o.cashClose.number}` : "Abierta") : "",
      ],
    });
  };
  for (const o of sales) line("Venta", o.paidAt!, o);
  for (const o of refunds) line("Reembolso", o.refundedAt!, o);
  for (const o of prizes) line("Premio Top 3", o.deliveredAt!, o);
  // Gastos del negocio anotados a mano: restan de la ganancia (van al final de su día).
  for (const e of expenses) {
    const at = new Date(ymdStart(e.day).getTime() + 86_399_000);
    rows.push({ at, cells: [e.day, "Gasto", "", e.category, e.concept, "", "", "", null, null, "", -e.amountCop, "", null, "", null, null, -e.amountCop, "", ""] });
  }
  rows.sort((a, b) => a.at.getTime() - b.at.getTime());

  const csv = toCsv(
    [
      "Fecha (hora Colombia)",
      "Movimiento",
      "Pedido",
      "Tipo",
      "Producto",
      "Cliente (correo)",
      "ID jugador",
      "Medio de pago",
      "Precio de lista",
      "Descuento",
      "Código",
      "Total (COP)",
      "Costo proveedor (USD)",
      "Tasa del dólar (COP)",
      "Fuente del costo",
      "Costo (COP)",
      "Comisión estimada (COP)",
      "Ganancia estimada (COP)",
      "Estado hoy",
      "Cierre de caja",
    ],
    rows.map((r) => r.cells),
  );
  await audit({ actorId: user.id, action: "export.ledger", entity: "Order", data: { desde: period.fromYmd, hasta: period.toYmd, rows: rows.length } });
  return csvResponse(`libro-ventas-${period.fromYmd}-a-${period.toYmd}.csv`, csv);
}
