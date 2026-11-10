import "server-only";
import { db } from "@/lib/db";

export type AdminCounts = { orders: number; claims: number; tickets: number; chats: number; /** Cambia con cualquier pedido nuevo, actualizado o borrado. */ ordersVersion: string };

/** Pendientes que se muestran en el menú del panel. */
export async function getAdminCounts(): Promise<AdminCounts> {
  const [orders, claims, tickets, chats, latest] = await Promise.all([
    db.order.count({ where: { status: { in: ["DELIVERY_FAILED", "REFUND_REQUESTED"] } } }),
    db.listingClaim.count({ where: { status: { in: ["OPEN", "REVIEWING"] } } }),
    db.supportTicket.count({ where: { status: "OPEN" } }),
    db.order.count({ where: { type: "ACCOUNT", chatUnreadStaff: { gt: 0 } } }),
    db.order.aggregate({ _max: { updatedAt: true }, _count: { _all: true } }),
  ]);
  return { orders, claims, tickets, chats, ordersVersion: `${latest._count._all}:${latest._max.updatedAt?.getTime() ?? 0}` };
}
