import { audit } from "@/lib/audit";
import { getCurrentUser, isStaff } from "@/lib/auth";
import { csvResponse, toCsv } from "@/lib/csv";
import { db } from "@/lib/db";
import { REVENUE_STATUSES } from "@/domain/order-status";

export const dynamic = "force-dynamic";

/** Exporta clientes agrupados por correo, con compras y gasto confirmados. */
export async function GET(req: Request) {
  const user = await getCurrentUser().catch(() => null);
  // Datos personales en bloque: solo administradores.
  if (!user || user.role !== "ADMIN" || !user.totpEnabledAt) return new Response("No autorizado", { status: user && isStaff(user.role) ? 403 : 401 });
  const base = new URL(req.url).searchParams.get("prueba") === "0" ? { isTest: false } : {};

  const [all, paid] = await Promise.all([
    db.order.groupBy({ by: ["customerEmail"], where: base, _count: { _all: true }, _min: { createdAt: true }, _max: { createdAt: true, customerName: true, customerPhone: true }, orderBy: { _max: { createdAt: "desc" } }, take: 20_000 }),
    db.order.groupBy({ by: ["customerEmail"], where: { ...base, status: { in: [...REVENUE_STATUSES] } }, _count: { _all: true }, _sum: { total: true }, orderBy: { _sum: { total: "desc" } }, take: 20_000 }),
  ]);
  const paidBy = new Map(paid.map((p) => [p.customerEmail, p]));
  const csv = toCsv(
    ["Correo", "Nombre", "Teléfono", "Compras confirmadas", "Pedidos", "Gasto (COP)", "Primer pedido (UTC)", "Último pedido (UTC)"],
    all.map((a) => {
      const p = paidBy.get(a.customerEmail);
      return [a.customerEmail, a._max.customerName, a._max.customerPhone, p?._count._all ?? 0, a._count._all, p?._sum.total ?? 0, a._min.createdAt, a._max.createdAt];
    }),
  );
  await audit({ actorId: user.id, action: "export.customers", entity: "Order", data: { rows: all.length } });
  return csvResponse(`clientes-${new Date().toISOString().slice(0, 10)}.csv`, csv);
}
