import "server-only";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { getSettings } from "./settings";

/**
 * Límites contra pedidos falsos o de spam (Panel → Ajustes → Límites de pedidos sin pagar). Se cuentan por correo
 * (sin trucos de alias: «ana+1@gmail.com» y «a.na@gmail.com» son el mismo) y por ID de jugador:
 *  - pedidos esperando pago al mismo tiempo (por defecto 2; cuentas en venta: 1, porque cada uno reserva la cuenta),
 *  - pedidos sin pagar en las últimas 24 horas (por defecto 5).
 * Quien paga no se ve afectado: solo cuentan los pedidos sin ningún cobro. También sigue el límite por conexión
 * (8 pedidos cada 10 minutos por dirección IP) en las acciones de la tienda.
 */

const DAY = 86400_000;

/** Correo «canónico» para contar: minúsculas, sin «+etiqueta» y, en Gmail, sin puntos. */
export function canonicalEmail(email: string): string {
  const e = email.trim().toLowerCase();
  const at = e.lastIndexOf("@");
  if (at < 1) return e;
  let local = e.slice(0, at).split("+")[0];
  let domain = e.slice(at + 1);
  if (domain === "googlemail.com") domain = "gmail.com";
  if (domain === "gmail.com") local = local.replace(/\./g, "");
  return `${local}@${domain}`;
}

const hour = (d: Date) => new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" }).format(d);

export type OrderLimits = { open: number; unpaid24h: number };

export async function orderLimits(): Promise<OrderLimits> {
  const s = await getSettings();
  const n = (v: string | undefined, def: number) => (v != null && v !== "" && Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : def);
  return { open: n(s.orderLimitOpen, 2), unpaid24h: n(s.orderLimitUnpaid, 5) };
}

/** null si puede crear el pedido; si no, el mensaje para el cliente (y queda en la auditoría). */
export async function orderLimitError(p: { type: "TOPUP" | "ACCOUNT"; email: string; playerId?: string | null; now?: Date }): Promise<string | null> {
  const now = p.now ?? new Date();
  const limits = await orderLimits();
  const openLimit = p.type === "ACCOUNT" ? Math.min(limits.open || 1, 1) : limits.open;
  if (!openLimit && !limits.unpaid24h) return null;

  const key = canonicalEmail(p.email);
  const recent = await db.order.findMany({
    where: { isTest: false, createdAt: { gte: new Date(now.getTime() - DAY) }, status: { in: ["PENDING_PAYMENT", "CANCELLED"] }, payments: { none: { status: { in: ["APPROVED", "VOIDED"] } } } },
    select: { customerEmail: true, playerId: true, status: true, expiresAt: true, createdAt: true, type: true },
    orderBy: { createdAt: "asc" },
    take: 5000,
  });
  const mine = recent.filter((o) => canonicalEmail(o.customerEmail) === key || (!!p.playerId && o.type === "TOPUP" && o.playerId === p.playerId));

  let reason: string | null = null;
  let message: string | null = null;
  const open = mine.filter((o) => o.status === "PENDING_PAYMENT" && o.expiresAt > now && (p.type === "TOPUP" || o.type === "ACCOUNT"));
  if (openLimit && open.length >= openLimit) {
    const freeAt = open.map((o) => o.expiresAt).sort((a, b) => a.getTime() - b.getTime())[0];
    reason = "open";
    message =
      open.length === 1
        ? `Ya tienes un pedido esperando pago. Complétalo con el enlace que te enviamos al correo, o espera a que venza (a las ${hour(freeAt)}) para hacer otro.`
        : `Ya tienes ${open.length} pedidos esperando pago. Completa uno con el enlace que te enviamos al correo, o espera a que venzan (el primero, a las ${hour(freeAt)}).`;
  } else if (limits.unpaid24h && mine.length >= limits.unpaid24h) {
    // Se libera cuando el pedido más viejo de las últimas 24 h sale de la cuenta.
    const freeAt = new Date(mine[mine.length - limits.unpaid24h].createdAt.getTime() + DAY);
    reason = "unpaid24h";
    message = `Hiciste muchos pedidos sin pagar en las últimas 24 horas. Podrás crear otro a partir de las ${hour(freeAt)}. Si tuviste un problema para pagar, escríbenos y te ayudamos.`;
  }
  if (!message) return null;
  await audit({ actorId: null, action: "order.limit_blocked", entity: "Order", data: { reason, type: p.type, email: key, playerId: p.playerId ?? null } }).catch(() => {});
  return message;
}

/** Intentos bloqueados en las últimas 24 horas (para el panel). */
export async function blockedAttempts(now = new Date()) {
  return db.auditLog.count({ where: { action: "order.limit_blocked", createdAt: { gte: new Date(now.getTime() - DAY) } } });
}
