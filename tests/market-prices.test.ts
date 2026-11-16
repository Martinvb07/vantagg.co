/**
 * Ganancia mínima del 30 % (ya descontada la comisión de Bold) y precios de mercado (5 % debajo de la tienda oficial).
 *   TEST_DATABASE_URL=mysql://usuario:clave@localhost:3306/vanta_test npx vitest run tests/market-prices.test.ts
 * Nada sale a internet: paquetes armados a mano en la base de pruebas.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const cfg = vi.hoisted(() => {
  const url = process.env.TEST_DATABASE_URL ?? "";
  const safe = /\/[^/?]*test[^/?]*(\?|$)/i.test(url);
  if (safe) process.env.DATABASE_URL = url;
  return { enabled: safe };
});

const state = vi.hoisted(() => ({
  // Tasa configurada 3.800 y la del día 4.000: la ganancia mínima se mide con la más alta.
  settings: { usdtCop: "3800", topupMargin: "30", minMarginPct: "30", minMarginSmallPct: "0", marketPricesAt: "", topupRegions: "latam", fxRates: "" } as Record<string, string>,
}));
vi.mock("@/server/settings", () => ({
  getSettings: vi.fn(async () => ({ ...state.settings, fxRates: JSON.stringify({ at: new Date().toISOString(), rates: { COP: 4000 } }) })),
  saveSettings: vi.fn(async (v: Record<string, string>) => void Object.assign(state.settings, v)),
}));
vi.mock("@/server/integrations/topup", () => ({ activeTopUpProvider: () => null, activeWholesale: () => null, getTopUpProvider: () => null }));

import { db } from "@/lib/db";
import { floorPrice, marketPrice, netMarginOf } from "@/domain/topup-regions";
import { applyMarketPrices, enforceMinimumMargins, MARKET_PRICES_VERSION, supplierRate } from "@/server/supplier";

describe.skipIf(!cfg.enabled)("Ganancia mínima y precios de mercado (base de pruebas)", () => {
  const RUN = `mk${Date.now().toString(36)}`;
  const pkg = (key: string, data: { diamonds: number; bonusDiamonds: number; price: number; costCents: number; region?: string; active?: boolean; compareAtPrice?: number | null }) =>
    db.diamondPackage.create({
      data: { slug: `${RUN}-${key}`, name: `${data.diamonds + data.bonusDiamonds} diamantes ${RUN}`, region: "latam", active: true, available: true, providerSku: `topup/free-fire/latam/${RUN}/${key}`, sortOrder: 0, ...data },
    });

  beforeAll(async () => {
    await db.diamondPackage.deleteMany({ where: { slug: { startsWith: RUN } } });
  });
  afterAll(async () => {
    await db.diamondPackage.deleteMany({ where: { slug: { startsWith: RUN } } });
    await db.auditLog.deleteMany({ where: { action: { in: ["package.market_price", "package.min_margin"] } } });
    await db.$disconnect();
  });

  it("la tasa para la ganancia mínima es la más alta entre la configurada y la del día", async () => {
    const r = await supplierRate();
    expect([r.usdtCop, r.costRate]).toEqual([3800, 4000]);
  });

  it("sube lo que quedó por debajo del 30 % limpio (con la tasa del día) y nunca baja", async () => {
    // 1,50 USD × 4.000 = 6.000 de costo: a $7.999 queda muy por debajo del 30 % limpio.
    const low = await pkg("bajo", { diamonds: 310, bonusDiamonds: 31, price: 7999, costCents: 150, compareAtPrice: 8999 });
    const high = await pkg("alto", { diamonds: 2180, bonusDiamonds: 218, price: 99999, costCents: 1500 });
    const changes = (await enforceMinimumMargins()).filter((c) => c.id === low.id || c.id === high.id);
    const after = await db.diamondPackage.findUniqueOrThrow({ where: { id: low.id } });
    expect(changes.map((c) => c.id)).toEqual([low.id]);
    expect(after.price).toBe(floorPrice(150, 4000, 30));
    expect(netMarginOf(after.price, 150, 4000)!).toBeGreaterThanOrEqual(30);
    expect(after.compareAtPrice).toBeNull(); // el «antes» ya no es mayor que el precio
    expect((await db.diamondPackage.findUniqueOrThrow({ where: { id: high.id } })).price).toBe(99999);
  });

  it("acerca al precio de mercado lo que está más barato, una sola vez y sin bajar de la ganancia mínima", async () => {
    // 572 con costo 2,50 USD (10.000): el mínimo (≈ $16.999) cabe debajo del mercado ($18.599) → sube al mercado.
    const room = await pkg("hueco", { diamonds: 520, bonusDiamonds: 52, price: 17499, costCents: 250 });
    // 6160 ya más caro que el mercado: no se toca (nunca baja).
    const above = await pkg("caro", { diamonds: 5600, bonusDiamonds: 560, price: 179999, costCents: 3000 });
    // 1166 con costo 6 USD (24.000): el 30 % pide ≈ $37.999 y el mercado da $36.499 → el mercado no se aplica (manda la ganancia mínima).
    const tight = await pkg("justo", { diamonds: 1060, bonusDiamonds: 106, price: 29999, costCents: 600 });
    expect(floorPrice(600, 4000, 30)).toBeGreaterThan(marketPrice(1166)!);
    // Inactivo y de otra región: no se tocan.
    const off = await pkg("apagado", { diamonds: 310, bonusDiamonds: 31, price: 9999, costCents: 100, active: false });
    const br = await pkg("brasil", { diamonds: 310, bonusDiamonds: 31, price: 9999, costCents: 100, region: "brazil" });
    const mine = new Set([room.id, above.id, tight.id, off.id, br.id]);

    const changes = (await applyMarketPrices()).filter((c) => mine.has(c.id));
    expect(changes).toEqual([{ id: room.id, name: room.name, region: "latam", from: 17499, to: marketPrice(572) }]);
    expect(state.settings.marketPricesAt).toBe(MARKET_PRICES_VERSION);
    const price = async (id: string) => (await db.diamondPackage.findUniqueOrThrow({ where: { id } })).price;
    expect([await price(above.id), await price(tight.id), await price(off.id), await price(br.id)]).toEqual([179999, 29999, 9999, 9999]);

    // Si después bajan un precio a mano, no se vuelve a subir solo (ya se aplicó esta versión).
    await db.diamondPackage.update({ where: { id: room.id }, data: { price: 17999 } });
    expect(await applyMarketPrices()).toEqual([]);
    expect(await price(room.id)).toBe(17999);
  });
});
