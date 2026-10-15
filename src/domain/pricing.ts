/**
 * Motor de precios. Todo precio se calcula a partir de los datos guardados en
 * la base de datos; ningún componente define precios por su cuenta.
 */
export type PriceQuote = {
  price: number; // precio a cobrar antes de códigos promocionales
  original: number | null; // precio anterior real a mostrar tachado
  discount: number; // ahorro frente al precio anterior
  discountPct: number;
};

export function quotePrice(base: number, compareAtPrice: number | null | undefined): PriceQuote {
  if (compareAtPrice && compareAtPrice > base) {
    const discount = compareAtPrice - base;
    return { price: base, original: compareAtPrice, discount, discountPct: Math.round((discount / compareAtPrice) * 100) };
  }
  return { price: base, original: null, discount: 0, discountPct: 0 };
}

// ---------------------------------------------------------------------
// Códigos promocionales
// ---------------------------------------------------------------------

export const PROMO_CODE_PATTERN = /^[A-Z0-9][A-Z0-9-]{2,30}[A-Z0-9]$/;

export function normalizePromoCode(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, "");
}

export type PromoLike = {
  discountType: "PERCENT" | "FIXED";
  value: number;
  maxDiscount: number | null;
  minSubtotal: number | null;
  scope: "ALL" | "TOPUP" | "ACCOUNT";
  startsAt: Date | null;
  endsAt: Date | null;
  maxUses: number | null;
  maxUsesPerEmail: number;
  uses: number;
  active: boolean;
};

export type PromoCheck =
  | { ok: true; discount: number }
  | { ok: false; reason: "INVALID" | "SCOPE" | "MIN_SUBTOTAL" | "EXHAUSTED" | "PER_EMAIL"; message: string };

/** Descuento de un código sobre un subtotal: nunca supera el 90% del valor. */
export function promoDiscount(subtotal: number, p: Pick<PromoLike, "discountType" | "value" | "maxDiscount">): number {
  const cap = Math.floor(subtotal * 0.9);
  let d = p.discountType === "PERCENT" ? Math.round((subtotal * Math.min(Math.max(p.value, 0), 90)) / 100) : Math.max(p.value, 0);
  if (p.discountType === "PERCENT" && p.maxDiscount != null) d = Math.min(d, p.maxDiscount);
  return Math.max(0, Math.min(d, cap));
}

/**
 * Valida un código frente a un pedido. Los mensajes no revelan si un código
 * inexistente, inactivo o vencido existe: todos responden "INVALID".
 */
export function checkPromo(
  p: PromoLike | null,
  ctx: { kind: "TOPUP" | "ACCOUNT"; subtotal: number; emailUses: number; now?: Date },
  formatMoney: (n: number) => string = (n) => `$${n}`,
): PromoCheck {
  const now = ctx.now ?? new Date();
  const invalid: PromoCheck = { ok: false, reason: "INVALID", message: "El código no es válido o ya no está vigente." };
  if (!p || !p.active) return invalid;
  if (p.startsAt && p.startsAt > now) return invalid;
  if (p.endsAt && p.endsAt <= now) return invalid;
  if (p.scope !== "ALL" && p.scope !== ctx.kind) {
    return { ok: false, reason: "SCOPE", message: p.scope === "TOPUP" ? "Este código aplica solo a recargas de diamantes." : "Este código aplica solo a cuentas." };
  }
  if (p.maxUses != null && p.uses >= p.maxUses) return { ok: false, reason: "EXHAUSTED", message: "Este código ya alcanzó su límite de usos." };
  if (ctx.emailUses >= p.maxUsesPerEmail) return { ok: false, reason: "PER_EMAIL", message: "Ya usaste este código el máximo de veces permitido." };
  if (p.minSubtotal != null && ctx.subtotal < p.minSubtotal) {
    return { ok: false, reason: "MIN_SUBTOTAL", message: `Este código requiere una compra mínima de ${formatMoney(p.minSubtotal)}.` };
  }
  const discount = promoDiscount(ctx.subtotal, p);
  if (discount <= 0) return invalid;
  return { ok: true, discount };
}
