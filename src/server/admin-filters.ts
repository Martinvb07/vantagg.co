import "server-only";
import type { Prisma } from "@prisma/client";
import { ORDER_STATUSES, type OrderStatusValue } from "@/domain/order-status";

export type OrderFilterParams = { q?: string; estado?: string; tipo?: string; prueba?: string; desde?: string; hasta?: string; orden?: string; fecha?: string };

/** Fecha que usan «desde/hasta»: creación (predeterminada), pago o entrega. */
export type DateField = "createdAt" | "paidAt" | "deliveredAt";
export function dateField(sp: OrderFilterParams): DateField {
  return sp.fecha === "pagado" ? "paidAt" : sp.fecha === "entregado" ? "deliveredAt" : "createdAt";
}

/** Pedidos de fragmentos o cajas Evo: el producto guardado en el pedido es «evo-frag-…» o «evo-box-…». */
export const TOKEN_ORDER: Prisma.OrderWhereInput = { OR: [{ itemSnapshot: { path: "$.pass", string_starts_with: "evo-frag-" } }, { itemSnapshot: { path: "$.pass", string_starts_with: "evo-box-" } }] };
/**
 * Lo contrario (diamantes, tarjetas y pases). Los pedidos de diamantes no guardan «pass» y en SQL negar algo vacío no
 * devuelve la fila, así que se aceptan por tener diamantes; las tarjetas y pases, por no ser «evo-frag/evo-box».
 */
export const NOT_TOKEN_ORDER: Prisma.OrderWhereInput = { OR: [{ itemSnapshot: { path: "$.diamonds", gt: 0 } }, { NOT: TOKEN_ORDER }] };

const YMD = /^\d{4}-\d{2}-\d{2}$/;

/** "2026-10-01" → inicio de ese día en Bogotá (UTC−5). */
export function bogotaDay(ymd: string, endOfDay = false): Date | null {
  if (!YMD.test(ymd)) return null;
  const d = new Date(`${ymd}T${endOfDay ? "23:59:59.999" : "00:00:00"}-05:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Orden del listado: por fecha de compra (predeterminado), igual que Bold y «Booyah en tiempo real» (el link de pago
 * vence una hora después de crearse el pedido, así que la compra siempre queda junto a su fecha de creación);
 * «actividad» pone arriba lo último que cambió (pagado, entregado, cancelado…).
 */
export function orderSort(sp: OrderFilterParams): Prisma.OrderOrderByWithRelationInput[] {
  if (sp.orden === "actividad") return [{ updatedAt: "desc" }, { createdAt: "desc" }];
  // Buscando por fecha de pago o de entrega, el listado sigue esa misma fecha.
  const field = dateField(sp);
  return field === "createdAt" ? [{ createdAt: "desc" }] : [{ [field]: "desc" }, { createdAt: "desc" }];
}

/** Filtros de pedidos compartidos por el listado y la exportación. */
export function orderWhere(sp: OrderFilterParams): Prisma.OrderWhereInput {
  const q = sp.q?.trim().slice(0, 80);
  const from = sp.desde ? bogotaDay(sp.desde) : null;
  const to = sp.hasta ? bogotaDay(sp.hasta, true) : null;
  const field = dateField(sp);
  return {
    ...(q ? { OR: [{ number: { contains: q.toUpperCase() } }, { customerEmail: { contains: q.toLowerCase() } }, { playerId: { contains: q } }] } : {}),
    ...(ORDER_STATUSES.includes(sp.estado as OrderStatusValue) ? { status: sp.estado as OrderStatusValue } : {}),
    ...(sp.tipo === "TOPUP" || sp.tipo === "ACCOUNT" ? { type: sp.tipo } : {}),
    // Fragmentos y cajas Evo (se toman aparte: tienen 24 h de plazo) o solo diamantes, tarjetas y pases.
    ...(sp.tipo === "TOKENS" ? { type: "TOPUP" as const, AND: [TOKEN_ORDER] } : {}),
    ...(sp.tipo === "RECARGAS" ? { type: "TOPUP" as const, AND: [NOT_TOKEN_ORDER] } : {}),
    ...(sp.prueba === "0" ? { isTest: false } : {}),
    // Por fecha de pago o de entrega solo salen los pedidos que tienen esa fecha.
    ...(from || to || field !== "createdAt" ? { [field]: { ...(field !== "createdAt" ? { not: null } : {}), ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
  };
}
