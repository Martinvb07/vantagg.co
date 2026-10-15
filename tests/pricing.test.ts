import { describe, expect, it } from "vitest";
import { checkPromo, normalizePromoCode, PROMO_CODE_PATTERN, promoDiscount, quotePrice, type PromoLike } from "@/domain/pricing";

const now = new Date("2026-10-03T12:00:00Z");
const promo = (over: Partial<PromoLike> = {}): PromoLike => ({
  discountType: "PERCENT",
  value: 10,
  maxDiscount: null,
  minSubtotal: null,
  scope: "ALL",
  startsAt: null,
  endsAt: null,
  maxUses: null,
  maxUsesPerEmail: 1,
  uses: 0,
  active: true,
  ...over,
});
const ctx = { kind: "TOPUP" as const, subtotal: 24900, emailUses: 0, now };

describe("quotePrice", () => {
  it("sin precio anterior devuelve el precio base", () => {
    expect(quotePrice(20000, null)).toEqual({ price: 20000, original: null, discount: 0, discountPct: 0 });
  });
  it("usa el precio anterior solo si es mayor", () => {
    expect(quotePrice(249900, 259900)).toEqual({ price: 249900, original: 259900, discount: 10000, discountPct: 4 });
    expect(quotePrice(249900, 200000).original).toBeNull();
  });
});

describe("códigos promocionales", () => {
  it("normaliza y valida el formato", () => {
    expect(normalizePromoCode("  bienvenida 10 ")).toBe("BIENVENIDA10");
    expect(PROMO_CODE_PATTERN.test("BIENVENIDA10")).toBe(true);
    expect(PROMO_CODE_PATTERN.test("AB")).toBe(false);
    expect(PROMO_CODE_PATTERN.test("<script>")).toBe(false);
  });

  it("calcula porcentaje, tope y valor fijo sin superar el 90%", () => {
    expect(promoDiscount(24900, { discountType: "PERCENT", value: 10, maxDiscount: null })).toBe(2490);
    expect(promoDiscount(100000, { discountType: "PERCENT", value: 50, maxDiscount: 20000 })).toBe(20000);
    expect(promoDiscount(10000, { discountType: "FIXED", value: 50000, maxDiscount: null })).toBe(9000);
    expect(promoDiscount(10000, { discountType: "PERCENT", value: 200, maxDiscount: null })).toBe(9000);
  });

  it("acepta un código vigente", () => {
    expect(checkPromo(promo(), ctx)).toEqual({ ok: true, discount: 2490 });
  });

  it("responde igual para inexistente, inactivo, futuro o vencido (no revela existencia)", () => {
    const msgs = [
      checkPromo(null, ctx),
      checkPromo(promo({ active: false }), ctx),
      checkPromo(promo({ startsAt: new Date("2026-11-01") }), ctx),
      checkPromo(promo({ endsAt: new Date("2026-10-01") }), ctx),
    ];
    for (const m of msgs) expect(m).toMatchObject({ ok: false, reason: "INVALID" });
  });

  it("respeta alcance, límites y compra mínima", () => {
    expect(checkPromo(promo({ scope: "ACCOUNT" }), ctx)).toMatchObject({ reason: "SCOPE" });
    expect(checkPromo(promo({ maxUses: 5, uses: 5 }), ctx)).toMatchObject({ reason: "EXHAUSTED" });
    expect(checkPromo(promo({ maxUsesPerEmail: 1 }), { ...ctx, emailUses: 1 })).toMatchObject({ reason: "PER_EMAIL" });
    expect(checkPromo(promo({ minSubtotal: 50000 }), ctx)).toMatchObject({ reason: "MIN_SUBTOTAL" });
  });
});
