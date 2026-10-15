import "server-only";
import { db } from "@/lib/db";

export type AdminCounts = { orders: number; claims: number; tickets: number; chats: number };

/** Pendientes que se muestran en el menú del panel. */
export async function getAdminCounts(): Promise<AdminCounts> {
  const [orders, claims, tickets, chats] = await Promise.all([
    db.order.count({ where: { status: { in: ["DELIVERY_FAILED", "REFUND_REQUESTED"] } } }),
    db.listingClaim.count({ where: { status: { in: ["OPEN", "REVIEWING"] } } }),
    db.supportTicket.count({ where: { status: "OPEN" } }),
    db.order.count({ where: { type: "ACCOUNT", chatUnreadStaff: { gt: 0 } } }),
  ]);
  return { orders, claims, tickets, chats };
}
