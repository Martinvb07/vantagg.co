/**
 * Fragmentos y cajas Evo: al menos el 30 % limpio (ya descontada la comisión de Bold), con la tasa más alta entre la
 * configurada y la del día. Los diamantes, tarjetas y pases siguen con su ganancia mínima de siempre (no se tocan).
 *   TEST_DATABASE_URL=mysql://usuario:clave@localhost:3306/vanta_test npx vitest run tests/evo-ganancia.test.ts
 * Nada sale a internet: paquetes armados a mano en la base de pruebas.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const cfg = vi.hoisted(() => {
  const url = process.env.TEST_DATABASE_URL ?? "";
  const safe = /\/[^/?]*test[^/?]*(\?|$)/i.test(url);
  if (safe) process.env.DATABASE_URL = url;
  return { enabled: safe };
});

// Tasa configurada 3.800 y la del día 4.000. Ganancia mínima general 20 % (la de Panel → Proveedor).
vi.mock("@/server/settings", () => ({
  getSettings: vi.fn(async () => ({ usdtCop: "3800", topupMargin: "30", minMarginPct: "20", minMarginSmallPct: "0", topupRegions: "latam", fxRates: JSON.stringify({ at: new Date().toISOString(), rates: { COP: 4000 } }) })),
  saveSettings: vi.fn(async () => {}),
}));
vi.mock("@/server/integrations/topup", () => ({ activeTopUpProvider: () => null, activeWholesale: () => null, getTopUpProvider: () => null }));

import { db } from "@/lib/db";
import { EVO_MIN_MARGIN_PCT, evoFloorPrice, floorPrice, marginOf, netMarginOf, paymentFee } from "@/domain/topup-regions";
import { enforceMinimumMargins, evoMinPrice } from "@/server/supplier";

describe("precio mínimo de los fragmentos y cajas Evo", () => {
  it("comisión de Bold que se descuenta: la de tarjeta (2,99 % + $900) con IVA", () => {
    expect(paymentFee(100000)).toBe(4629); // (2.990 + 900) × 1,19
    expect(paymentFee(0)).toBe(0);
    expect(netMarginOf(10000, 100, 3400)).toBe(51.7); // 10.000 − 3.400 de costo − 1.427 de comisión = 5.173
  });

  it("deja limpio al menos el 30 % del precio, redondeado a $500 y terminado en 9, sin sobrar un escalón", () => {
    expect(EVO_MIN_MARGIN_PCT).toBe(30);
    for (const cents of [1, 76, 150, 420, 950, 3186, 25000]) {
      const p = evoFloorPrice(cents, 4000);
      expect(netMarginOf(p, cents, 4000)!).toBeGreaterThanOrEqual(30);
      expect(p % 500).toBe(499);
      const q = p - 500; // un escalón abajo ya no alcanza
      if (p > 1999) expect(q - (cents / 100) * 4000 - paymentFee(q)).toBeLessThan(q * 0.3 + 1);
    }
    expect(evoFloorPrice(950, 4000)).toBe(58999); // (38.000 + 1.071) ÷ (1 − 0,30 − 0,0356) = 58.805 → 59.000 → 58.999
    expect(evoFloorPrice(1, 3400)).toBe(1999); // casi solo la comisión fija
  });
});

describe.skipIf(!cfg.enabled)("Ganancia de Armas Evo en la tienda (base de pruebas)", () => {
  const RUN = `eg${Date.now().toString(36)}`;
  const pkg = (key: string, data: { name: string; diamonds?: number; bonusDiamonds?: number; price: number; costCents: number; active?: boolean; compareAtPrice?: number | null }) =>
    db.diamondPackage.create({ data: { slug: `${RUN}-${key}`, region: "latam", diamonds: 0, bonusDiamonds: 0, available: true, active: true, providerSku: `topup/free-fire/latam/${RUN}/${key}`, sortOrder: 0, ...data } });

  beforeAll(async () => {
    await db.diamondPackage.deleteMany({ where: { slug: { startsWith: RUN } } });
  });
  afterAll(async () => {
    await db.diamondPackage.deleteMany({ where: { slug: { startsWith: RUN } } });
    await db.auditLog.deleteMany({ where: { action: "package.min_margin" } });
    await db.$disconnect();
  });

  it("el precio mínimo de Evo usa la tasa más alta (la del día)", async () => {
    expect(await evoMinPrice(950)).toBe(evoFloorPrice(950, 4000));
  });

  it("sube fragmentos y cajas por debajo del 30 % limpio; diamantes y tarjetas quedan como están; nunca baja", async () => {
    // Fragmentos: con la ganancia general (20 % bruto) bastaba $47.999; ahora pide el 30 % limpio de Bold.
    const frag = await pkg("frag", { name: "100 Fragmentos de arma Evo", price: floorPrice(950, 3800, 20), costCents: 950, compareAtPrice: 49999 });
    const box = await pkg("caja", { name: "5 Cajas de fragmentos Evo", price: 9999, costCents: 420 });
    // Ya por encima del mínimo: no se toca (no se bajan precios).
    const rich = await pkg("rico", { name: "500 Fragmentos de arma Evo", price: 999999, costCents: 4000 });
    // Diamantes y tarjeta con ganancia bruta del 20 % pero menos del 30 % limpio: no cambian.
    const dia = await pkg("diamantes", { name: `572 diamantes ${RUN}`, diamonds: 520, bonusDiamonds: 52, price: floorPrice(300, 3800, 20), costCents: 300 });
    const card = await pkg("semanal", { name: "Tarjeta Semanal", price: floorPrice(200, 3800, 20), costCents: 200 });
    // Acceso Evo (no es fragmento ni caja): tampoco.
    const access = await pkg("acceso", { name: "Acceso Evo 7 días", price: floorPrice(150, 3800, 20), costCents: 150 });
    // Apagado: no se toca.
    const off = await pkg("apagado", { name: "50 Fragmentos de arma Evo", price: 1000, costCents: 500, active: false });

    const mine = new Set([frag.id, box.id, rich.id, dia.id, card.id, access.id, off.id]);
    const changes = (await enforceMinimumMargins()).filter((c) => mine.has(c.id));
    expect(changes.map((c) => c.name).sort()).toEqual(["100 Fragmentos de arma Evo", "5 Cajas de fragmentos Evo"]);

    const get = (id: string) => db.diamondPackage.findUniqueOrThrow({ where: { id } });
    const f = await get(frag.id);
    expect(f.price).toBe(evoFloorPrice(950, 4000));
    expect(netMarginOf(f.price, 950, 4000)!).toBeGreaterThanOrEqual(30);
    expect(f.compareAtPrice).toBeNull(); // el «antes» ya no era mayor que el precio
    expect((await get(box.id)).price).toBe(evoFloorPrice(420, 4000));
    expect((await get(rich.id)).price).toBe(999999);
    expect((await get(dia.id)).price).toBe(dia.price);
    expect(marginOf(dia.price, 300, 3800)!).toBeGreaterThanOrEqual(20);
    expect(netMarginOf(dia.price, 300, 4000)!).toBeLessThan(30); // a propósito: los diamantes no siguen la regla Evo
    expect((await get(card.id)).price).toBe(card.price);
    expect((await get(access.id)).price).toBe(access.price);
    expect((await get(off.id)).price).toBe(1000);

    // Segunda pasada: ya nada por debajo.
    expect((await enforceMinimumMargins()).filter((c) => mine.has(c.id))).toEqual([]);
  });
});
