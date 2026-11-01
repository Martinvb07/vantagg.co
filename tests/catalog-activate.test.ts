/**
 * «Activar todo Free Fire»: todas las regiones del proveedor, diamantes (desde 100), tarjetas, pases, paquetes de
 * nivel y acceso Evo, con la ganancia mínima (30 % general, 40 % en los de 100 diamantes). Base MySQL de PRUEBAS:
 *   TEST_DATABASE_URL=mysql://usuario:clave@localhost:3306/vanta_test npx vitest run tests/catalog-activate.test.ts
 * Nada sale a internet: el catálogo del proveedor y la tasa del día son simulados.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const cfg = vi.hoisted(() => {
  const url = process.env.TEST_DATABASE_URL ?? "";
  const safe = /\/[^/?]*test[^/?]*(\?|$)/i.test(url);
  if (safe) process.env.DATABASE_URL = url;
  return { enabled: safe };
});

const state = vi.hoisted(() => ({
  settings: { usdtCop: "4000", topupMargin: "30", topupRegions: "latam", supplierSyncedAt: "", minMarginPct: "0", minMarginSmallPct: "0" } as Record<string, string>,
  groups: [] as Array<{ key: string; slug: string; products: Array<Record<string, unknown>> }>,
}));

vi.mock("@/server/settings", () => ({
  getSettings: vi.fn(async () => ({ ...state.settings })),
  saveSettings: vi.fn(async (v: Record<string, string>) => void Object.assign(state.settings, v)),
}));
vi.mock("@/server/integrations/topup", () => ({
  activeWholesale: () => ({ id: "centralone", wholesale: { catalog: async () => ({ currency: "USD", groups: state.groups }) } }),
}));

import { db } from "@/lib/db";
import { activateAllFreeFire, syncSupplierCatalog } from "@/server/supplier";
import { marginOf } from "@/domain/topup-regions";

const RUN = Date.now().toString(36);
const key = (s: string) => `topup/free-fire/${RUN}/${s}`;
const item = (k: string, name: string, usd: number, extra: Record<string, unknown> = {}) => ({ product_key: key(k), name, price: usd, delivery: "player_id", out_of_stock: false, ...extra });
const dia = (k: string, amount: number, usd: number, extra: Record<string, unknown> = {}) => item(k, `Free Fire ${amount} Diamantes`, usd, { amount, unit: "Diamonds", ...extra });

describe.skipIf(!cfg.enabled)("Activar todo el catálogo Free Fire (base de pruebas)", () => {
  beforeAll(async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ result: "success", rates: { COP: 4100 } })));
    // Solo los paquetes de esta prueba quedan activos (la base de pruebas es compartida).
    await db.diamondPackage.updateMany({ where: { active: true }, data: { active: false } });
    state.groups = [
      { key: "LATAM", slug: "latam", products: [dia("l110", 110, 0.76), dia("l341", 341, 2.2), item("lmes", "Tarjeta Mensual de Free Fire", 2.4), item("lpin", "Free Fire 110 Diamantes · PIN", 0.7, { delivery: "unsupported", amount: 110, unit: "Diamonds" })] },
      { key: "BR", slug: "brazil", products: [dia("b110", 110, 0.8), dia("b22640", 22640, 150), item("bn10", "Free Fire (BR) · Paquete de Nivel 10", 0.5), item("bevo", "Free Fire (BR) · Acceso Evo 7 días", 0.6), item("bplus", "Free Fire (BR) · Pase Booyah Premium Plus", 3.1)] },
      { key: "EU", slug: "eu", products: [dia("e25", 25, 0.2), dia("e231", 231, 1.9)] },
      { key: "GLOBAL", slug: "global", products: [dia("g110", 110, 0.9, { out_of_stock: false })] },
    ];
    const pkg = (slug: string, data: Record<string, unknown>) => db.diamondPackage.create({ data: { slug: `act-${RUN}-${slug}`, region: "latam", diamonds: 0, bonusDiamonds: 0, price: 1000, active: true, ...data } as never });
    // LATAM 110 vendido por debajo de la ganancia mínima; 341 con precio alto (no debe bajar).
    await pkg("l110", { name: "110", diamonds: 100, bonusDiamonds: 10, price: 3499, compareAtPrice: 3999, providerSku: key("l110") });
    await pkg("l341", { name: "341", diamonds: 310, bonusDiamonds: 31, price: 25999, providerSku: key("l341") });
    // Tarjeta Mensual desactivada a mano: se reactiva con precio que cumple.
    await pkg("lmes", { name: "Tarjeta Mensual", price: 5000, providerSku: key("lmes"), active: false });
    // Productos que el proveedor ya no vende: se desactivan, no se borran.
    await pkg("b24640", { name: "24640", region: "brazil", diamonds: 22400, bonusDiamonds: 2240, providerSku: key("b24640") });
    await pkg("eviejo", { name: "100", region: "eu", diamonds: 90, bonusDiamonds: 10, providerSku: key("eviejo") });
    // Brasil 110 ya existe activo.
    await pkg("b110", { name: "110 BR", region: "brazil", diamonds: 100, bonusDiamonds: 10, price: 4999, providerSku: key("b110") });
  });

  afterAll(async () => {
    await db.diamondPackage.deleteMany({ where: { OR: [{ slug: { startsWith: `act-${RUN}` } }, { providerSku: { startsWith: `topup/free-fire/${RUN}/` } }] } });
    await db.supplierProduct.deleteMany({ where: { productKey: { startsWith: `topup/free-fire/${RUN}/` } } });
    await db.$disconnect();
    vi.unstubAllGlobals();
  });

  it("activa todo con la ganancia mínima, desactiva lo que ya no existe y no repite al correrlo de nuevo", async () => {
    const r = await activateAllFreeFire({ general: 30, small: 40 });

    // Tasa: el dólar del día + 2 % (4.182) supera la guardada (4.000): se usa esa para no perder.
    expect(r.rate).toEqual({ before: 4000, after: 4182, dailyUsd: 4100 });
    expect(state.settings.usdtCop).toBe("4182");
    expect(state.settings.minMarginPct).toBe("30");
    expect(state.settings.minMarginSmallPct).toBe("40");

    // Regiones: Latinoamérica primero, «Global» al final.
    expect(r.regions).toEqual(["latam", "brazil", "eu", "global"]);
    expect(state.settings.topupRegions).toBe("latam,brazil,eu,global");

    const names = (xs: Array<{ region: string; name: string }>) => xs.map((x) => `${x.region}:${x.name}`).sort();
    expect(names(r.created)).toEqual(
      ["brazil:22640 diamantes (Brasil)", "brazil:Acceso Evo 7 días", "brazil:Paquete de Nivel 10", "brazil:Pase Booyah Premium Plus", "eu:231 diamantes (Europa)", "global:110 diamantes (Global · otras regiones)"].sort(),
    );
    expect(names(r.reactivated)).toEqual(["latam:Tarjeta Mensual"]);
    expect(names(r.deactivated)).toEqual(["brazil:24640", "eu:100"]);
    expect(r.skippedSmall).toBe(1); // los 25 diamantes de Europa
    expect(await db.diamondPackage.count({ where: { providerSku: { in: [key("lpin"), key("e25")] } } })).toBe(0);

    // EU 231 = 210 + 21 (bonus de Garena); los desactivados siguen en la base.
    const eu = await db.diamondPackage.findFirstOrThrow({ where: { providerSku: key("e231") } });
    expect([eu.diamonds, eu.bonusDiamonds]).toEqual([210, 21]);
    expect(await db.diamondPackage.count({ where: { providerSku: { in: [key("b24640"), key("eviejo")] }, active: false } })).toBe(2);

    // Ganancia mínima en todos los activos: 40 % hasta 110 diamantes, 30 % el resto.
    const active = await db.diamondPackage.findMany({ where: { active: true, providerSku: { startsWith: `topup/free-fire/${RUN}/` } } });
    expect(active.length).toBe(10); // LATAM 3 · Brasil 5 · Europa 1 · Global 1
    for (const p of active) {
      const need = p.diamonds > 0 && p.diamonds + p.bonusDiamonds <= 110 ? 40 : 30;
      expect(marginOf(p.price, p.costCents, 4182)!, p.name).toBeGreaterThanOrEqual(need);
    }
    // El 110 de LATAM subió (y el «antes» que ya no es mayor se quita); el 341 caro no bajó.
    const l110 = active.find((p) => p.providerSku === key("l110"))!;
    expect(l110.price).toBeGreaterThan(3499);
    expect(l110.compareAtPrice).toBeNull();
    expect(active.find((p) => p.providerSku === key("l341"))!.price).toBe(25999);
    expect(r.repriced.map((x) => x.name)).toContain("110");

    // Otra vez: nada nuevo.
    const again = await activateAllFreeFire({ general: 30, small: 40 });
    expect([again.created.length, again.reactivated.length, again.deactivated.length, again.repriced.length]).toEqual([0, 0, 0, 0]);
  });

  it("si el proveedor sube un costo, la sincronización sube el precio hasta la ganancia mínima", async () => {
    const before = await db.diamondPackage.findFirstOrThrow({ where: { providerSku: key("l341") } });
    state.groups[0].products[1] = dia("l341", 341, 20); // el costo pasa de 2,2 a 20 USDT
    const s = await syncSupplierCatalog();
    expect(s.repriced).toBeGreaterThanOrEqual(1);
    const after = await db.diamondPackage.findFirstOrThrow({ where: { providerSku: key("l341") } });
    expect(after.price).toBeGreaterThan(before.price);
    expect(marginOf(after.price, after.costCents, 4182)!).toBeGreaterThanOrEqual(30);
  });
});
