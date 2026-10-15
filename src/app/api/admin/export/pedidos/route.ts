import { audit } from "@/lib/audit";
import { getCurrentUser, isStaff } from "@/lib/auth";
import { csvResponse, toCsv } from "@/lib/csv";
import { db } from "@/lib/db";
import { ORDER_STATUS_META } from "@/domain/order-status";
import { orderWhere } from "@/server/admin-filters";

export const dynamic = "force-dynamic";

/** Exporta los pedidos con los mismos filtros del listado. */
export async function GET(req: Request) {
  const user = await getCurrentUser().catch(() => null);
  // Datos personales en bloque: solo administradores.
  if (!user || user.role !== "ADMIN" || !user.totpEnabledAt) return new Response("No autorizado", { status: user && isStaff(user.role) ? 403 : 401 });
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const orders = await db.order.findMany({ where: orderWhere(sp), orderBy: { createdAt: "desc" }, take: 10_000 });

  const csv = toCsv(
    ["Pedido", "Creado (UTC)", "Pagado (UTC)", "Entregado (UTC)", "Tipo", "Producto", "Correo", "Nombre", "Teléfono", "ID jugador", "Subtotal", "Descuento", "Código", "Total", "Moneda", "Estado", "Pasarela", "Prueba"],
    orders.map((o) => [
      o.number,
      o.createdAt,
      o.paidAt,
      o.deliveredAt,
      o.type === "TOPUP" ? "Recarga" : "Cuenta",
      (o.itemSnapshot as { name?: string }).name ?? "",
      o.customerEmail,
      o.customerName,
      o.customerPhone,
      o.playerId,
      o.subtotal,
      o.discount,
      o.promoCode,
      o.total,
      o.currency,
      ORDER_STATUS_META[o.status].label,
      o.paymentProvider,
      o.isTest,
    ]),
  );
  await audit({ actorId: user.id, action: "export.orders", entity: "Order", data: { rows: orders.length } });
  return csvResponse(`pedidos-${new Date().toISOString().slice(0, 10)}.csv`, csv);
}
