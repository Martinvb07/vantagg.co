import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildTargetPayload, idempotencyKeyFor, isFreeFireItem, mapCoOrder, normalizeCatalog, parseDiamondAmount, regionSlugOf, targetSchemaOf, type CoCatalogItem } from "@/server/integrations/topup/centralone-core";
import { verifyCentralOneWebhook } from "@/server/integrations/payments/signatures";

const item = (over: Partial<CoCatalogItem>): CoCatalogItem => ({
  product_id: "22222222-3333-4444-5555-666666666666",
  name: "Free Fire 110 Diamantes",
  product_family_name: "Free Fire",
  product_type: "game_topup",
  category: "gaming_topup",
  region: "LATAM",
  currency: "USD",
  reseller_price: "0.9800",
  status: "active",
  requires_target: true,
  target_fields: ["player_id"],
  target_schema: [{ key: "player_id", label: "Player ID", type: "text", options: null }],
  in_stock: true,
  available_stock: null,
  ...over,
});

describe("Central One · catálogo", () => {
  it("reconoce productos de Free Fire y descarta otros juegos", () => {
    expect(isFreeFireItem(item({}))).toBe(true);
    expect(isFreeFireItem(item({ name: "Free Fire MAX 520 Diamonds", product_family_name: "Free Fire MAX" }))).toBe(true);
    expect(isFreeFireItem(item({ name: "PUBG 60 UC", product_family_name: "PUBG Mobile" }))).toBe(false);
    expect(isFreeFireItem(item({ product_type: "gift_card", category: "gift_card", name: "Free Fire gift card" }))).toBe(false);
  });

  it("cuenta los diamantes del nombre", () => {
    expect(parseDiamondAmount("Free Fire 110 Diamantes")).toBe(110);
    expect(parseDiamondAmount("Free Fire - 100+10 Diamonds")).toBe(110);
    expect(parseDiamondAmount("FF 1.060 + 106 diamantes")).toBe(1166);
    expect(parseDiamondAmount("Free Fire 2,398 💎")).toBe(2398);
    expect(parseDiamondAmount("Free Fire 5600 Bonus Diamonds")).toBe(5600);
    expect(parseDiamondAmount("Free Fire Tarjeta semanal")).toBeNull();
    expect(parseDiamondAmount("Free Fire Pase Booyah 100 diamantes")).toBeNull();
    expect(parseDiamondAmount("Free Fire Membresía mensual")).toBeNull();
  });

  it("traduce la región de Central One al slug de la tienda", () => {
    expect(regionSlugOf("LATAM")).toBe("latam");
    expect(regionSlugOf("Latinoamérica")).toBe("latam");
    expect(regionSlugOf("BR")).toBe("brazil");
    expect(regionSlugOf("GLOBAL")).toBe("global");
    expect(regionSlugOf(null)).toBe("global");
    expect(regionSlugOf("Middle East")).toBe("middle-east");
    expect(regionSlugOf("Latin America (LATAM)")).toBe("latam");
    expect(regionSlugOf("Free Fire Brasil")).toBe("brazil");
    expect(regionSlugOf("Global / Worldwide")).toBe("global");
  });

  it("agrupa por región y marca lo que no se puede entregar con solo el ID", () => {
    const { currency, groups } = normalizeCatalog([
      item({}),
      item({ product_id: "a", name: "Free Fire 572 Diamantes", reseller_price: "4.9000", in_stock: false }),
      item({ product_id: "b", name: "Free Fire 341 Diamantes", region: "BR" }),
      item({ product_id: "c", name: "Free Fire 110 Diamantes", target_fields: ["player_id", "zone_id"], target_schema: null }),
      item({ product_id: "d", name: "PUBG 60 UC", product_family_name: "PUBG Mobile" }),
      item({ product_id: "e", name: "Free Fire 110 Diamantes", status: "paused" }),
    ]);
    expect(currency).toBe("USD");
    const latam = groups.find((g) => g.slug === "latam")!;
    expect(latam.key).toBe("LATAM");
    expect(latam.products.map((p) => [p.product_key, p.amount, p.price, p.out_of_stock, p.delivery])).toEqual([
      ["22222222-3333-4444-5555-666666666666", 110, 0.98, false, "player_id"],
      ["a", 572, 4.9, true, "player_id"],
      ["c", 110, 0.98, false, "unsupported"],
    ]);
    expect(groups.find((g) => g.slug === "brazil")!.products).toHaveLength(1);
    expect(groups.some((g) => g.products.some((p) => p.product_key === "d" || p.product_key === "e"))).toBe(false);
  });
});

describe("Central One · datos del jugador", () => {
  it("pone el ID en el campo del jugador", () => {
    expect(buildTargetPayload(targetSchemaOf(item({})), "123456789")).toEqual({ player_id: "123456789" });
    expect(buildTargetPayload(targetSchemaOf(item({ target_schema: null, target_fields: ["uid"] })), "987654321")).toEqual({ uid: "987654321" });
  });

  it("elige el servidor según la región, o la única opción", () => {
    const schema = [
      { key: "player_id", type: "text", options: null },
      { key: "server", type: "select", options: [{ value: "latam", label: "Latinoamérica" }, { value: "br", label: "Brasil" }] },
    ];
    expect(buildTargetPayload(schema, "123456789", "LATAM")).toEqual({ player_id: "123456789", server: "latam" });
    expect(buildTargetPayload(schema, "123456789", "BR")).toEqual({ player_id: "123456789", server: "br" });
    expect(buildTargetPayload(schema, "123456789", "EU")).toBeNull();
    expect(buildTargetPayload([{ key: "player_id", type: "text" }, { key: "server", type: "select", options: [{ value: "only" }] }], "123456789", "EU")).toEqual({ player_id: "123456789", server: "only" });
  });

  it("no arma nada si el producto pide un dato que la tienda no tiene", () => {
    expect(buildTargetPayload([{ key: "player_id", type: "text" }, { key: "zone_id", type: "text" }], "123456789")).toBeNull();
    expect(buildTargetPayload([], "123456789")).toBeNull();
  });

  it("Idempotency-Key válida para Central One", () => {
    expect(idempotencyKeyFor("topup-clx1abc2def")).toBe("topup-clx1abc2def");
    expect(idempotencyKeyFor("topup-clx1abc2def-r2")).toBe("topup-clx1abc2def-r2");
    expect(idempotencyKeyFor("a.b c")).toMatch(/^[A-Za-z0-9_-]{8,255}$/);
  });
});

describe("Central One · estado de los pedidos", () => {
  const base = { id: "aaaa", reference_code: "CO-ORD-20260101-000001", status: "confirmed" };
  it("entregado cuando la línea se completa", () => {
    expect(mapCoOrder({ ...base, items: [{ id: "l1", status: "completed" }] }).status).toBe("SUCCESS");
    expect(mapCoOrder({ ...base, status: "completed" }).status).toBe("SUCCESS");
  });
  it("sigue en proceso mientras la línea está reservada o procesándose", () => {
    expect(mapCoOrder({ ...base, items: [{ id: "l1", status: "reserved" }] })).toMatchObject({ status: "PENDING", providerRef: "aaaa" });
    expect(mapCoOrder({ ...base, items: [{ id: "l1", status: "processing" }] }).status).toBe("PENDING");
    expect(mapCoOrder(base).status).toBe("PENDING");
  });
  it("fallido con el motivo de Central One", () => {
    const r = mapCoOrder({ ...base, status: "failed", items: [{ id: "l1", status: "failed", failure: { code: "invalid_player", message_es: "La cuenta no existe", action: "fix_and_retry" } }] });
    expect(r.status).toBe("FAILED");
    expect(r.message).toContain("[invalid_player]");
    expect(r.message).toContain("La cuenta no existe");
    expect(r.message).toContain("CO-ORD-20260101-000001");
    expect(mapCoOrder({ ...base, items: [{ id: "l1", status: "refunded" }] }).status).toBe("FAILED");
    expect(mapCoOrder({ ...base, items: [{ id: "l1", status: "cancelled" }] }).status).toBe("FAILED");
  });
});

describe("Central One · firma del webhook", () => {
  const secret = "secreto-de-prueba";
  const body = JSON.stringify({ event_id: "e1", event: "order.delivered", order: { idempotency_key: "topup-x" } });
  const ts = "1700000000";
  const sign = (s: string) => `sha256=${createHmac("sha256", s).update(`${ts}.${body}`).digest("hex")}`;

  it("acepta la firma correcta dentro de los 5 minutos", () => {
    expect(verifyCentralOneWebhook({ timestamp: ts, signature: sign(secret), body, secret, nowSec: 1700000100 })).toBe(true);
  });
  it("acepta la firma anterior durante la rotación del secreto", () => {
    expect(verifyCentralOneWebhook({ timestamp: ts, signature: sign("secreto-nuevo"), previousSignature: sign(secret), body, secret, nowSec: 1700000000 })).toBe(true);
  });
  it("rechaza firma inválida, cuerpo cambiado o timestamp viejo", () => {
    expect(verifyCentralOneWebhook({ timestamp: ts, signature: sign("otro"), body, secret, nowSec: 1700000000 })).toBe(false);
    expect(verifyCentralOneWebhook({ timestamp: ts, signature: sign(secret), body: body + " ", secret, nowSec: 1700000000 })).toBe(false);
    expect(verifyCentralOneWebhook({ timestamp: ts, signature: sign(secret), body, secret, nowSec: 1700000400 })).toBe(false);
    expect(verifyCentralOneWebhook({ timestamp: null, signature: sign(secret), body, secret })).toBe(false);
  });
});
