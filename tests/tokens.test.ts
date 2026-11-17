import { describe, expect, it } from "vitest";
import { isTokenItem, isTokenKind } from "@/domain/packs";
import { TOKEN_DELIVERY_MAX_MS, TOKEN_DELIVERY_TIME } from "@/domain/delivery-time";
import { orderEmail, type OrderTemplate } from "@/server/email-templates";
import { staffTokenOverdueEmail, tokenOrderEmail, tokenTemplateName, type TokenOrderTemplate } from "@/server/email-templates-tokens";

const brand = { storeName: "VANTA", appUrl: "https://tienda.test" };
const tokenOrder = { number: "VX-1", type: "TOPUP" as const, item: "100 Fragmentos de arma Evo Free Fire", total: "$ 21.900", playerId: "123456789", link: "https://tienda.test/pedido/VX-1?t=x", isTest: false, expiresAt: "3:45 p. m.", isPass: true };
const diamondOrder = { ...tokenOrder, item: "110 diamantes Free Fire", isPass: false };
const TOKEN_TEMPLATES: TokenOrderTemplate[] = ["order_created", "payment_reminder", "payment_confirmed", "delivered", "delivery_failed", "refunded", "cancelled", "order_recovery", "delay_apology"];

describe("tokens Evo (fragmentos y cajas): aparte de los diamantes", () => {
  it("solo los fragmentos y las cajas Evo son tokens (no diamantes, pases ni acceso Evo)", () => {
    expect(isTokenKind("evo-frag-100")).toBe(true);
    expect(isTokenKind("evo-box-5")).toBe(true);
    expect(isTokenKind("evo-7")).toBe(false);
    expect(isTokenKind("weekly")).toBe(false);
    expect(isTokenKind(null)).toBe(false);
    expect(isTokenItem({ diamonds: 0, name: "100 Fragmentos de arma Evo Free Fire" })).toBe(true);
    expect(isTokenItem({ diamonds: 0, name: "cualquiera", pass: "evo-box-10" })).toBe(true);
    expect(isTokenItem({ diamonds: 0, name: "5 Cajas de fragmentos Evo Free Fire" })).toBe(true);
    expect(isTokenItem({ diamonds: 100, bonusDiamonds: 10, name: "110 diamantes Free Fire" })).toBe(false);
    expect(isTokenItem({ diamonds: 0, name: "Tarjeta Semanal Free Fire", pass: "weekly" })).toBe(false);
    expect(isTokenItem({ diamonds: 0, name: "Acceso Evo 7 días Free Fire", pass: "evo-7" })).toBe(false);
    expect(isTokenItem(null)).toBe(false);
  });

  it("el plazo de entrega de los tokens es de 24 horas hábiles", () => {
    expect(TOKEN_DELIVERY_MAX_MS).toBe(24 * 3600_000);
    expect(TOKEN_DELIVERY_TIME.description).toMatch(/no llegan de manera instantánea.*24 horas hábiles/);
    expect(TOKEN_DELIVERY_TIME.checkout).toContain("24 horas hábiles");
    expect(TOKEN_DELIVERY_TIME.processing).toContain("24 horas hábiles");
  });

  it("los correos de tokens nunca hablan de diamantes ni llevan a /recargas: van a /fragmentos", () => {
    for (const t of TOKEN_TEMPLATES) {
      const e = tokenOrderEmail(brand, t, tokenOrder);
      expect(`${e.subject}\n${e.text}\n${e.html}`, t).not.toMatch(/diamante|\/recargas/i);
      expect(e.html, t).toContain("https://tienda.test/fragmentos");
      expect(e.text, t).toContain("100 Fragmentos de arma Evo");
      expect(tokenTemplateName(t)).toBe(`token_${t}`);
    }
  });

  it("el correo de pago confirmado de tokens avisa del plazo de 24 horas hábiles; el de diamantes no cambia", () => {
    const token = tokenOrderEmail(brand, "payment_confirmed", tokenOrder);
    expect(token.text).toContain("24 horas hábiles");
    expect(token.subject).not.toBe(orderEmail(brand, "payment_confirmed", diamondOrder).subject);
    for (const t of ["payment_confirmed", "delivered", "delivery_failed", "order_created"] as OrderTemplate[]) {
      const e = orderEmail(brand, t, diamondOrder);
      expect(`${e.subject}\n${e.text}`, t).not.toMatch(/24 horas hábiles|fragmento|\bEvo\b/i);
      expect(e.html, t).toContain("Recargar diamantes");
    }
  });

  it("aviso al equipo: solo existe el de plazo vencido, con las horas y sin cancelar el pedido", () => {
    const e = staffTokenOverdueEmail(brand, { number: "VX-1", item: tokenOrder.item, hours: 13, state: "en proceso con el proveedor", lastError: "caído", adminLink: "https://tienda.test/admin/pedidos/1" });
    expect(e.subject).toContain("24 horas hábiles");
    expect(e.text).toContain("13 h");
    expect(e.text).toContain("no se canceló");
  });
});
