import "server-only";
import type { PromoCode } from "@prisma/client";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { checkPromo, normalizePromoCode, PROMO_CODE_PATTERN, type PromoCheck } from "@/domain/pricing";

/**
 * Códigos promocionales.
 * - La validación y el cálculo ocurren solo en el servidor.
 * - El uso se reserva con un UPDATE condicional atómico: aunque lleguen muchas
 *   compras a la vez, nunca se supera `maxUses`.
 * - Si el pedido se cancela o expira sin pago, el uso se devuelve.
 */

const ACTIVE_REDEMPTION = { in: ["RESERVED", "CONFIRMED"] as Array<"RESERVED" | "CONFIRMED"> };

async function findPromo(raw: string): Promise<PromoCode | null> {
  const code = normalizePromoCode(raw);
  if (!PROMO_CODE_PATTERN.test(code)) return null;
  return db.promoCode.findUnique({ where: { code } });
}

async function emailUses(promoCodeId: string, email: string | undefined) {
  if (!email) return 0;
  return db.promoRedemption.count({ where: { promoCodeId, email: email.toLowerCase(), status: ACTIVE_REDEMPTION } });
}

export type PromoPreview = (PromoCheck & { code: string }) | { ok: false; reason: "INVALID"; message: string; code: string };

export async function previewPromo(input: { code: string; kind: "TOPUP" | "ACCOUNT"; subtotal: number; email?: string }): Promise<PromoPreview> {
  const code = normalizePromoCode(input.code);
  const promo = await findPromo(code);
  const result = checkPromo(promo, { kind: input.kind, subtotal: input.subtotal, emailUses: promo ? await emailUses(promo.id, input.email) : 0 }, formatMoney);
  return { ...result, code };
}

export type PromoReservation = { promoCodeId: string; code: string; discount: number } | { error: string };

/**
 * Valida y reserva un uso del código para la orden `orderId` (aún no creada).
 * Quien llama debe crear la orden con la redención o, si falla, invocar `undoPromoReservation`.
 */
export async function reservePromo(input: {
  code: string;
  kind: "TOPUP" | "ACCOUNT";
  subtotal: number;
  email: string;
}): Promise<PromoReservation> {
  const promo = await findPromo(input.code);
  const check = checkPromo(promo, { kind: input.kind, subtotal: input.subtotal, emailUses: promo ? await emailUses(promo.id, input.email) : 0 }, formatMoney);
  if (!check.ok || !promo) return { error: check.ok ? "El código no es válido o ya no está vigente." : check.message };

  const affected = await db.$executeRaw`
    UPDATE \`PromoCode\`
       SET uses = uses + 1
     WHERE id = ${promo.id}
       AND active = 1
       AND (maxUses IS NULL OR uses < maxUses)`;
  if (affected !== 1) return { error: "Este código ya alcanzó su límite de usos." };
  return { promoCodeId: promo.id, code: promo.code, discount: check.discount };
}

export async function undoPromoReservation(promoCodeId: string) {
  await db.$executeRaw`UPDATE \`PromoCode\` SET uses = GREATEST(uses - 1, 0) WHERE id = ${promoCodeId}`;
}

/** Pago confirmado: la redención queda definitiva. */
export async function confirmRedemption(orderId: string) {
  const r = await db.promoRedemption.findUnique({ where: { orderId } });
  if (!r || r.status === "CONFIRMED") return;
  if (r.status === "RELEASED") {
    // Pago tardío de un pedido ya expirado: el cliente pagó con descuento, se vuelve a contar el uso.
    await db.$executeRaw`UPDATE \`PromoCode\` SET uses = uses + 1 WHERE id = ${r.promoCodeId}`;
  }
  await db.promoRedemption.update({ where: { orderId }, data: { status: "CONFIRMED" } });
}

/** Pedido cancelado o expirado sin pago: devuelve el uso del código. */
export async function releaseRedemption(orderId: string) {
  const res = await db.promoRedemption.updateMany({ where: { orderId, status: "RESERVED" }, data: { status: "RELEASED" } });
  if (res.count !== 1) return;
  const r = await db.promoRedemption.findUnique({ where: { orderId }, select: { promoCodeId: true } });
  if (r) await undoPromoReservation(r.promoCodeId);
}
