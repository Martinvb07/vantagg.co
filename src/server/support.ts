import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export type SupportOwner = { id: string; email: string; emailVerifiedAt: Date | null };

/**
 * Solicitudes que un cliente puede ver: las que abrió desde su cuenta y, si su correo está verificado,
 * también las que envió como invitado con ese mismo correo. Sin verificar no se ven las de otros.
 */
export function ticketScope(u: SupportOwner): Prisma.SupportTicketWhereInput {
  return { OR: [{ userId: u.id }, ...(u.emailVerifiedAt ? [{ email: u.email }] : [])] };
}

export async function listUserTickets(u: SupportOwner) {
  return db.supportTicket.findMany({
    where: ticketScope(u),
    orderBy: { updatedAt: "desc" },
    take: 30,
    include: {
      order: { select: { number: true, trackingToken: true } },
      replies: { orderBy: { createdAt: "asc" }, select: { id: true, body: true, fromCustomer: true, createdAt: true } },
    },
  });
}

export type UserTicket = Awaited<ReturnType<typeof listUserTickets>>[number];

/** El equipo respondió y el cliente aún no contesta (se resalta en Mi cuenta). */
export function awaitingCustomer(t: Pick<UserTicket, "status" | "replies">) {
  const last = t.replies[t.replies.length - 1];
  return !!last && !last.fromCustomer && t.status !== "CLOSED" && t.status !== "RESOLVED";
}
