import { describe, expect, it, beforeEach } from "vitest";
import { _resetRateLimits, rateLimit } from "@/lib/rate-limit";
import { generateOrderNumber, safeEqual } from "@/lib/crypto";
import { hashPassword, verifyPassword } from "@/lib/password";
import { playerIdSchema, topUpOrderSchema, trackingSchema } from "@/lib/validation";

describe("rate limit", () => {
  beforeEach(() => _resetRateLimits());
  it("bloquea al superar el límite y libera tras la ventana", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 3; i++) expect(rateLimit("k", 3, 1000, t0 + i).ok).toBe(true);
    const blocked = rateLimit("k", 3, 1000, t0 + 10);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
    expect(rateLimit("k", 3, 1000, t0 + 1500).ok).toBe(true);
  });
  it("la limpieza periódica no borra contadores de ventanas largas antes de tiempo", () => {
    const hour = 60 * 60_000;
    const t0 = Date.now() + 10 * hour; // posterior a la última limpieza real
    for (let i = 0; i < 3; i++) rateLimit("largo", 3, hour, t0);
    // 20 minutos después otra clave de ventana corta dispara la limpieza.
    rateLimit("corto", 5, 60_000, t0 + 20 * 60_000);
    expect(rateLimit("largo", 3, hour, t0 + 20 * 60_000).ok).toBe(false);
    expect(rateLimit("largo", 3, hour, t0 + hour + 1).ok).toBe(true);
  });
  it("aísla claves distintas", () => {
    for (let i = 0; i < 2; i++) rateLimit("a", 2, 1000, 1);
    expect(rateLimit("a", 2, 1000, 2).ok).toBe(false);
    expect(rateLimit("b", 2, 1000, 2).ok).toBe(true);
  });
});

describe("contraseñas", () => {
  it("hash scrypt verificable y con sal aleatoria", async () => {
    const h1 = await hashPassword("ClaveSegura123");
    const h2 = await hashPassword("ClaveSegura123");
    expect(h1).not.toBe(h2);
    expect(await verifyPassword("ClaveSegura123", h1)).toBe(true);
    expect(await verifyPassword("otra", h1)).toBe(false);
    expect(await verifyPassword("x", "formato-invalido")).toBe(false);
  });
});

describe("utilidades criptográficas", () => {
  it("número de pedido legible y sin caracteres ambiguos", () => {
    for (let i = 0; i < 200; i++) {
      const n = generateOrderNumber("VX");
      expect(n).toMatch(/^VX-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);
    }
  });
  it("comparación en tiempo constante", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});

describe("validación de entradas", () => {
  it("ID de jugador: solo 6 a 12 dígitos", () => {
    expect(playerIdSchema.safeParse("123456789").success).toBe(true);
    expect(playerIdSchema.safeParse("12345").success).toBe(false);
    expect(playerIdSchema.safeParse("12345abc9").success).toBe(false);
    expect(playerIdSchema.safeParse("1234567890123").success).toBe(false);
  });
  it("la orden exige términos aceptados y clave de idempotencia UUID", () => {
    const base = { packageId: "p", playerId: "123456789", email: "a@b.co", paymentProvider: "bold", idempotencyKey: crypto.randomUUID(), acceptTerms: true };
    expect(topUpOrderSchema.safeParse(base).success).toBe(true);
    expect(topUpOrderSchema.safeParse({ ...base, acceptTerms: false }).success).toBe(false);
    expect(topUpOrderSchema.safeParse({ ...base, idempotencyKey: "x" }).success).toBe(false);
  });
  it("normaliza el número de pedido del seguimiento", () => {
    const r = trackingSchema.safeParse({ number: " vx-7k2m-9qht ", email: "A@B.CO" });
    expect(r.success && r.data).toEqual({ number: "VX-7K2M-9QHT", email: "a@b.co" });
  });
});
