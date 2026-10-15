import "server-only";
import type { Prisma } from "@prisma/client";
import { ORDER_STATUSES, type OrderStatusValue } from "@/domain/order-status";

export type OrderFilterParams = { q?: string; estado?: string; tipo?: string; prueba?: string; desde?: string; hasta?: string };

const YMD = /^\d{4}-\d{2}-\d{2}$/;

/** "2026-10-01" → inicio de ese día en Bogotá (UTC−5). */
export function bogotaDay(ymd: string, endOfDay = false): Date | null {
  if (!YMD.test(ymd)) return null;
  const d = new Date(`${ymd}T${endOfDay ? "23:59:59.999" : "00:00:00"}-05:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Filtros de pedidos compartidos por el listado y la exportación. */
export function orderWhere(sp: OrderFilterParams): Prisma.OrderWhereInput {
  const q = sp.q?.trim().slice(0, 80);
  const from = sp.desde ? bogotaDay(sp.desde) : null;
  const to = sp.hasta ? bogotaDay(sp.hasta, true) : null;
  return {
    ...(q ? { OR: [{ number: { contains: q.toUpperCase() } }, { customerEmail: { contains: q.toLowerCase() } }, { playerId: { contains: q } }] } : {}),
    ...(ORDER_STATUSES.includes(sp.estado as OrderStatusValue) ? { status: sp.estado as OrderStatusValue } : {}),
    ...(sp.tipo === "TOPUP" || sp.tipo === "ACCOUNT" ? { type: sp.tipo } : {}),
    ...(sp.prueba === "0" ? { isTest: false } : {}),
    ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
  };
}
