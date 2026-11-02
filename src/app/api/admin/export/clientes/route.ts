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
  // Clientes cuyos pedidos sin pagar se borraron: quedan con cuántos dejaron sin pagar.
  const contacts = await db.emailContact.findMany({ select: { email: true, unpaidOrders: true, lastOrderAt: true, optIn: true, createdAt: true }, take: 50_000 });
  const contactBy = new Map(contacts.map((c) => [c.email.toLowerCase(), c]));
  const inOrders = new Set(all.map((a) => a.customerEmail.toLowerCase()));
  const csv = toCsv(
    ["Correo", "Nombre", "Teléfono", "Compras confirmadas", "Pedidos", "Sin pagar (borrados)", "Acepta ofertas", "Gasto (COP)", "Primer pedido (UTC)", "Último pedido (UTC)"],
    [
      ...all.map((a) => {
        const p = paidBy.get(a.customerEmail);
        const c = contactBy.get(a.customerEmail.toLowerCase());
        return [a.customerEmail, a._max.customerName, a._max.customerPhone, p?._count._all ?? 0, a._count._all + (c?.unpaidOrders ?? 0), c?.unpaidOrders ?? 0, c?.optIn ? "Sí" : "No", p?._sum.total ?? 0, a._min.createdAt, c?.lastOrderAt && a._max.createdAt && c.lastOrderAt > a._max.createdAt ? c.lastOrderAt : a._max.createdAt];
      }),
      ...contacts.filter((c) => !inOrders.has(c.email.toLowerCase())).map((c) => [c.email, null, null, 0, c.unpaidOrders, c.unpaidOrders, c.optIn ? "Sí" : "No", 0, null, c.lastOrderAt ?? c.createdAt]),
    ],
  );
  await audit({ actorId: user.id, action: "export.customers", entity: "Order", data: { rows: all.length } });
  return csvResponse(`clientes-${new Date().toISOString().slice(0, 10)}.csv`, csv);
}
