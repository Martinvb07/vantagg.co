import { audit } from "@/lib/audit";
import { getCurrentUser, isStaff } from "@/lib/auth";
import { csvResponse, toCsv } from "@/lib/csv";
import { ORDER_STATUS_META } from "@/domain/order-status";
import { paymentLabel } from "@/domain/cash";
import { closeDetail } from "@/server/cash";

export const dynamic = "force-dynamic";

/** Hora de Colombia «2026-11-15 08:30». */
const bogota = (d: Date | null) => (d ? new Date(d.getTime() - 5 * 3_600_000).toISOString().replace("T", " ").slice(0, 16) : "");

/** Un cierre de caja para Excel: sus ventas y los reembolsos descontados en él (sin datos personales). */
export async function GET(_req: Request, { params }: { params: Promise<{ number: string }> }) {
  const user = await getCurrentUser().catch(() => null);
  if (!user || user.role !== "ADMIN") return new Response("No autorizado", { status: user && isStaff(user.role) ? 403 : 401 });
  const d = await closeDetail(Number((await params).number));
  if (!d) return new Response("No existe ese cierre", { status: 404 });
  const { close, sales, refunds } = d;
  const line = (kind: string, o: (typeof sales)[number]) => {
    const cost = d.costOf(o);
    return [
      kind,
      o.number,
      bogota(o.paidAt),
      o.type === "TOPUP" ? "Recarga" : "Cuenta",
      (o.itemSnapshot as { name?: string }).name ?? "",
      paymentLabel(o.paymentProvider, o.payments[0]?.method, o.chargeCurrency),
      kind === "Reembolso" ? -o.total : o.total,
      cost != null ? (cost / 100).toFixed(2) : "",
      ORDER_STATUS_META[o.status].label,
    ];
  };
  const csv = toCsv(
    ["Movimiento", "Pedido", "Pagado (hora Colombia)", "Tipo", "Producto", "Medio de pago", "Total (COP)", `Costo proveedor (${close.supplierCurrency ?? "USD"})`, "Estado hoy"],
    [...sales.map((o) => line("Venta", o)), ...refunds.map((o) => line("Reembolso", o))],
  );
  await audit({ actorId: user.id, action: "export.cash_close", entity: "CashClose", entityId: String(close.number), data: { rows: sales.length + refunds.length } });
  return csvResponse(`caja-${close.number}-${bogota(close.closedAt).slice(0, 10)}.csv`, csv);
}
