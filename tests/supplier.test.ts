import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { charmPrice, costInCop, floorPrice, isFreeFireProductKey, marginOf, marketPrice, minMarginFor, MIN_MARGIN_PCT, netMarginOf, OFFICIAL_COP, paymentFee, parseRegionList, regionalPrice, sameRegion, splitBonus, suggestedPrice } from "@/domain/topup-regions";
import { verifyStandardWebhook } from "@/server/integrations/payments/signatures";

describe("precios por región", () => {
  it("convierte el costo en USDT a pesos", () => {
    expect(costInCop(67, 3400)).toBe(2278); // 0,67 USDT
    expect(costInCop(3186, 3400)).toBe(108324);
  });

  it("precio sugerido = costo + margen, redondeado a $500 y terminado en 9", () => {
    expect(suggestedPrice(76, 3400, 30)).toBe(3499); // 0,76 × 3400 × 1,3 = 3359,2 → 3.500 → 3.499
    expect(suggestedPrice(3576, 3400, 30)).toBe(158499); // 158.059,2 → 158.500 → 158.499
    expect(suggestedPrice(1, 3400, 0)).toBe(500); // mínimo
  });

  it("ganancia mínima: queda limpio al menos ese % del precio de venta, ya descontada la comisión de Bold", () => {
    for (const cents of [1, 67, 76, 150, 999, 3186, 3576, 25000]) {
      for (const pct of [30, 40]) {
        const p = floorPrice(cents, 3400, pct);
        expect(netMarginOf(p, cents, 3400)!).toBeGreaterThanOrEqual(pct); // nunca por debajo del mínimo
        expect(marginOf(p, cents, 3400)!).toBeGreaterThan(pct); // sin la comisión, el % del panel bruto es mayor
        expect(p % 500 === 499 || p % 500 === 0).toBe(true); // redondeo a $500 terminado en 9
        // y no sobra más de un escalón de $500: un escalón abajo ya no alcanza
        const q = p - 500;
        if (p > 1999) expect(q - (cents / 100) * 3400 - paymentFee(q)).toBeLessThan((q * pct) / 100 + 1);
      }
    }
    // 0,76 USD × 3.400 = 2.584; comisión de Bold (tarjeta, con IVA) 3,5581 % + $1.071
    expect(floorPrice(76, 3400, 30)).toBe(5999); // (2.584 + 1.071) ÷ (1 − 0,30 − 0,0356) = 5.501 → 6.000 → 5.999
    expect(floorPrice(76, 3400, 40)).toBe(6499); // ÷ 0,5644 = 6.476 → 6.500 → 6.499
    expect(floorPrice(1, 3400, 30)).toBe(1999); // casi solo la comisión fija: 1.663 → 2.000 → 1.999
  });

  it("comisión de Bold que se descuenta: la de tarjeta, con IVA", () => {
    expect(paymentFee(100000)).toBe(4629); // 100.000 × 2,99 % = 2.990 + 900 = 3.890 × 1,19
    expect(paymentFee(0)).toBe(0);
    expect(netMarginOf(10000, 100, 3400)).toBe(51.7); // 10.000 − 3.400 de costo − 1.427 de comisión = 5.173
  });

  it("precio de mercado: 5 % debajo de la tienda oficial en Colombia, terminado en 9", () => {
    expect(OFFICIAL_COP[110]).toBe(4200);
    expect(marketPrice(110)).toBe(3899); // 3.990 → 3.900 → 3.899
    expect(marketPrice(572)).toBe(18599); // 18.620
    expect(marketPrice(6160)).toBe(172999); // 173.280 → 173.000 → 172.999
    expect(marketPrice(231)).toBeNull(); // sin referencia
    for (const total of Object.keys(OFFICIAL_COP).map(Number)) expect(marketPrice(total)!).toBeLessThan(OFFICIAL_COP[total]);
  });

  it("los paquetes de 100 diamantes (o menos) llevan su propia ganancia mínima", () => {
    const rule = { general: 30, small: 40 };
    expect(minMarginFor({ diamonds: 100, bonusDiamonds: 10 }, rule)).toBe(40);
    expect(minMarginFor({ diamonds: 100, bonusDiamonds: 0 }, rule)).toBe(40);
    expect(minMarginFor({ diamonds: 310, bonusDiamonds: 31 }, rule)).toBe(30);
    expect(minMarginFor({ diamonds: 0, bonusDiamonds: 0 }, rule)).toBe(30); // tarjetas y pases
    expect(minMarginFor({ diamonds: 100, bonusDiamonds: 10 }, { general: 30, small: 0 })).toBe(30);
  });

  it("precio psicológico solo en precios redondos", () => {
    expect(charmPrice(150000)).toBe(149999);
    expect(charmPrice(15500)).toBe(15499);
    expect(charmPrice(149999)).toBe(149999);
    expect(charmPrice(500)).toBe(500);
  });

  it("margen sobre el precio de venta", () => {
    expect(marginOf(3500, 67, 3400)).toBeCloseTo(34.9, 1);
    expect(marginOf(2000, 67, 3400)).toBeLessThan(0); // vende por debajo del costo
    expect(marginOf(3500, null, 3400)).toBeNull();
  });

  it("separa base + bonus (estándar conocido o 10 % del total)", () => {
    expect(splitBonus(110)).toEqual({ diamonds: 100, bonusDiamonds: 10 });
    expect(splitBonus(6160)).toEqual({ diamonds: 5600, bonusDiamonds: 560 });
    // Bonus de Garena (+10 % de la base): el total es múltiplo de 11.
    expect(splitBonus(231)).toEqual({ diamonds: 210, bonusDiamonds: 21 });
    expect(splitBonus(2420)).toEqual({ diamonds: 2200, bonusDiamonds: 220 });
    // El nombre del proveedor manda cuando lo dice.
    expect(splitBonus(110, "Free Fire 110 Diamantes (100 + 10% de bono)")).toEqual({ diamonds: 100, bonusDiamonds: 10 });
    expect(splitBonus(572, "520 + 52 Diamonds")).toEqual({ diamonds: 520, bonusDiamonds: 52 });
    // Sin dato confiable no se inventa bonus.
    expect(splitBonus(100)).toEqual({ diamonds: 100, bonusDiamonds: 0 });
    expect(splitBonus(5600)).toEqual({ diamonds: 5600, bonusDiamonds: 0 });
    expect(splitBonus(22640)).toEqual({ diamonds: 22640, bonusDiamonds: 0 });
  });
});

describe("regiones", () => {
  it("compara nombres del verificador con slugs del catálogo", () => {
    expect(sameRegion("LATAM", "latam")).toBe(true);
    expect(sameRegion("Brazil", "brazil")).toBe(true);
    expect(sameRegion("Singapore / Malaysia", "singapore-malaysia")).toBe(true);
    expect(sameRegion("LATAM", "brazil")).toBe(false);
    expect(sameRegion(null, "latam")).toBe(false);
  });

  it("limpia la lista de regiones activas", () => {
    expect(parseRegionList(" latam, Brazil ,latam,<x>, ")).toEqual(["latam", "brazil"]);
  });

  it("reconoce claves de producto de Free Fire", () => {
    expect(isFreeFireProductKey("topup/free-fire/latam/110 Diamonds")).toBe(true);
    expect(isFreeFireProductKey("topup/mobile-legends/global/86 Diamonds")).toBe(false);
    expect(isFreeFireProductKey("FF-100")).toBe(false);
  });
});

describe("webhook del proveedor (Standard Webhooks)", () => {
  const key = Buffer.from("clave-de-prueba-del-webhook-1234");
  const secret = `whsec_${key.toString("base64")}`;
  const body = JSON.stringify({ type: "order.delivered", data: { order_id: "ORD-1", buyer_ref: "topup-x" } });
  const id = "msg_1";
  const ts = "1790000000";
  const sign = (b: string, t = ts) => "v1," + createHmac("sha256", key).update(`${id}.${t}.${b}`).digest("base64");

  it("acepta una firma válida (también entre varias)", () => {
    expect(verifyStandardWebhook({ id, timestamp: ts, signature: sign(body), body, secret, nowSec: 1790000010 })).toBe(true);
    expect(verifyStandardWebhook({ id, timestamp: ts, signature: `v1,otra ${sign(body)}`, body, secret, nowSec: 1790000010 })).toBe(true);
  });

  it("rechaza cuerpo alterado, secreto equivocado o evento viejo", () => {
    expect(verifyStandardWebhook({ id, timestamp: ts, signature: sign(body), body: body.replace("delivered", "failed"), secret, nowSec: 1790000010 })).toBe(false);
    expect(verifyStandardWebhook({ id, timestamp: ts, signature: sign(body), body, secret: "whsec_" + Buffer.from("otra").toString("base64"), nowSec: 1790000010 })).toBe(false);
    expect(verifyStandardWebhook({ id, timestamp: ts, signature: sign(body), body, secret, nowSec: 1790000000 + 600 })).toBe(false);
    expect(verifyStandardWebhook({ id, timestamp: ts, signature: null, body, secret })).toBe(false);
  });
});

describe("precio regional con la lógica de LATAM", () => {
  // Paquetes y costos reales de LATAM (USDT) a 3.400 por USDT.
  const latam = [
    { amount: 110, price: 3500, costCents: 67 },
    { amount: 341, price: 10000, costCents: 201 },
    { amount: 572, price: 16000, costCents: 340 },
    { amount: 1166, price: 34000, costCents: 630 },
    { amount: 2398, price: 65000, costCents: 1252 },
    { amount: 6160, price: 150000, costCents: 3186 },
  ];
  const price = (amount: number, costCents: number) => regionalPrice({ amount, costCents, usdtCop: 3400, latam })!;

  it("nunca pasa el precio de LATAM en la misma cantidad", () => {
    expect(price(110, 76).price).toBe(3499); // Brasil cuesta más: precio de LATAM, terminado en 9
    expect(price(6160, 3576).price).toBe(149999);
    expect(price(341, 238).marginPct).toBeGreaterThan(15);
  });

  it("si cuesta menos, usa el mismo margen que LATAM (más barato que LATAM)", () => {
    const r = price(110, 50); // costo $1.700, margen LATAM 34,9 %
    expect(r.price).toBe(2999);
    expect(r.price).toBeLessThanOrEqual(3500);
  });

  it("sin cantidad igual, no pasa el precio por diamante de LATAM", () => {
    const r = price(24640, 14959);
    expect(r.exact).toBe(false);
    expect(r.price).toBeLessThanOrEqual((150000 / 6160) * 24640);
  });

  it("nunca vende por debajo del margen mínimo (sube lo justo)", () => {
    const r = price(310, 290); // Europa: costo $9.860
    expect(r.aboveLatam).toBe(true);
    expect(r.marginPct).toBeGreaterThanOrEqual(MIN_MARGIN_PCT);
    expect(r.price).toBe(10999);
  });
});
