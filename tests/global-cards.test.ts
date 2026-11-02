/**
 * Tarjetas de Global en Latinoamérica y regiones apagadas a mano. Base MySQL de PRUEBAS:
 *   TEST_DATABASE_URL=mysql://usuario:clave@localhost:3306/vanta_test npx vitest run tests/global-cards.test.ts
 * Nada sale a internet: el catálogo de Central One, su verificación de IDs y la tasa del día son simulados.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const cfg = vi.hoisted(() => {
  const url = process.env.TEST_DATABASE_URL ?? "";
  const safe = /\/[^/?]*test[^/?]*(\?|$)/i.test(url);
  if (safe) process.env.DATABASE_URL = url;
  return { enabled: safe };
});

const state = vi.hoisted(() => ({
  settings: { usdtCop: "4000", topupMargin: "30", topupRegions: "latam,id,global", topupRegionsOff: "", supplierSyncedAt: "", minMarginPct: "30", minMarginSmallPct: "40" } as Record<string, string>,
  groups: [] as Array<{ key: string; slug: string; products: Array<Record<string, unknown>> }>,
  /** Productos que Central One acepta para las cuentas de Latinoamérica, y los que no tienen verificación de IDs. */
  accepts: new Set<string>(),
  unsupported: new Set<string>(),
  validate: vi.fn(),
}));

vi.mock("@/server/settings", () => ({
  getSettings: vi.fn(async () => ({ ...state.settings })),
  saveSettings: vi.fn(async (v: Record<string, string>) => void Object.assign(state.settings, v)),
}));
vi.mock("@/server/integrations/topup", () => {
  const wholesale = { playerCheck: "per-product", catalog: async () => ({ currency: "USD", groups: state.groups }) };
  const provider = { id: "centralone", wholesale, validatePlayer: state.validate };
  return { activeWholesale: () => provider, activeTopUpProvider: () => provider };
});

import { db } from "@/lib/db";
import { floorPrice, marginOf } from "@/domain/topup-regions";
import { targetPayloadFor } from "@/server/integrations/topup/centralone-core";
import { activateAllFreeFire, globalDeliveredToLatam, globalNameCoversLatam, moveGlobalCardsToLatam, syncSupplierCatalog, turnOffRegions } from "@/server/supplier";

const RUN = Date.now().toString(36);
const key = (s: string) => `topup/free-fire/${RUN}/${s}`;
const item = (k: string, name: string, usd: number, extra: Record<string, unknown> = {}) => ({ product_key: key(k), name, price: usd, delivery: "player_id", out_of_stock: false, ...extra });
const PLAYERS = ["611111111", "622222222", "633333333"];

describe("ficha de Central One: ¿la tarjeta de Global sirve en Latinoamérica?", () => {
  it("sí cuando dice «excepto …» y Latinoamérica no está entre las excluidas", () => {
    expect(globalNameCoversLatam("Free Fire · Tarjeta Semanal (excepto VN/TH/ID/Medio Oriente)")).toBe(true);
    expect(globalNameCoversLatam("Free Fire · Weekly Membership (except VN/TH/ID/Middle East)")).toBe(true);
    expect(globalNameCoversLatam("Free Fire · Tarjeta Semanal")).toBe(false);
    expect(globalNameCoversLatam("Free Fire · Tarjeta Semanal (excepto LATAM/BR)")).toBe(false);
    expect(globalNameCoversLatam("Free Fire · Tarjeta Semanal (excepto Latinoamérica)")).toBe(false);
  });
});

describe("tarjeta de otra región que pide servidor", () => {
  const schema = [
    { key: "player_id", type: "text", options: null },
    { key: "server", type: "select", options: [{ value: "SG", label: "Global" }, { value: "IND", label: "India" }] },
  ];
  it("se entrega con el servidor de su propia región (no con el de la tienda)", () => {
    expect(targetPayloadFor({ target_schema: schema, region: "Global" }, "123456789", "LATAM")).toEqual({ player_id: "123456789", server: "SG" });
    expect(targetPayloadFor({ target_schema: schema, region: "Global" }, "123456789", "Global")).toEqual({ player_id: "123456789", server: "SG" });
    expect(targetPayloadFor({ target_schema: [{ key: "player_id", type: "text", options: null }], region: "Global" }, "123456789", "LATAM")).toEqual({ player_id: "123456789" });
  });
});

describe.skipIf(!cfg.enabled)("Tarjetas de Global en Latinoamérica e Indonesia apagada (base de pruebas)", () => {
  let weeklyId = "";
  let monthlyId = "";

  beforeAll(async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ result: "success", rates: { COP: 3900 } })));
    await db.diamondPackage.updateMany({ where: { active: true }, data: { active: false } });
    state.groups = [
      { key: "LATAM", slug: "latam", products: [item("l110", "Free Fire 110 Diamantes", 0.76, { amount: 110, unit: "Diamonds" }), item("lsem", "Tarjeta Semanal", 2.0), item("lmes", "Tarjeta Mensual", 2.4)] },
      { key: "ID", slug: "id", products: [item("i110", "Free Fire 110 Diamantes", 0.7, { amount: 110, unit: "Diamonds" })] },
      { key: "GLOBAL", slug: "global", products: [item("g110", "Free Fire 110 Diamantes", 0.9, { amount: 110, unit: "Diamonds" }), item("gsem", "Free Fire · Tarjeta Semanal (excepto VN/TH/ID/Medio Oriente)", 1.5), item("gmes", "Free Fire · Tarjeta Mensual (excepto VN/TH/ID/Medio Oriente)", 2.6), item("gbas", "Free Fire · Tarjeta Semanal Básica", 0.8)] },
    ];
    await syncSupplierCatalog();
    const pkg = (slug: string, data: Record<string, unknown>) => db.diamondPackage.create({ data: { slug: `gc-${RUN}-${slug}`, region: "latam", diamonds: 0, bonusDiamonds: 0, price: 1000, active: true, ...data } as never });
    weeklyId = (await pkg("lsem", { name: "Tarjeta Semanal", price: 13999, compareAtPrice: 12999, providerSku: key("lsem"), costCents: 200 })).id;
    monthlyId = (await pkg("lmes", { name: "Tarjeta Mensual", price: 14999, providerSku: key("lmes"), costCents: 240 })).id;
    await pkg("l110", { name: "110", diamonds: 100, bonusDiamonds: 10, price: 4999, providerSku: key("l110"), costCents: 76 });
    await pkg("gsem", { name: "Tarjeta Semanal", region: "global", price: 9999, providerSku: key("gsem"), costCents: 150 });
    await pkg("i110", { name: "110 ID", region: "id", diamonds: 100, bonusDiamonds: 10, price: 4999, providerSku: key("i110"), costCents: 70 });
    // Cuentas reales de Latinoamérica (recargas entregadas) y una de ellas también recibió una de Global.
    for (const [i, playerId] of PLAYERS.entries()) {
      await db.order.create({
        data: {
          id: `gc_${RUN}_${i}`, number: `GC-${RUN}-${i}`.toUpperCase(), type: "TOPUP", status: "DELIVERED", idempotencyKey: `gc-${RUN}-${i}`, trackingToken: `gc-token-${RUN}-${i}`,
          customerEmail: "cliente@example.com", playerId, itemSnapshot: { kind: "TOPUP", name: "110 diamantes", diamonds: 100, bonusDiamonds: 10, region: "latam" }, subtotal: 4999, total: 4999, currency: "COP",
          paymentProvider: "bold", expiresAt: new Date(), paidAt: new Date(), deliveredAt: new Date(Date.now() - i * 60_000),
        },
      });
    }
    await db.order.create({
      data: {
        id: `gc_${RUN}_g`, number: `GC-${RUN}-G`.toUpperCase(), type: "TOPUP", status: "DELIVERED", idempotencyKey: `gc-${RUN}-g`, trackingToken: `gc-token-${RUN}-g`,
        customerEmail: "cliente@example.com", playerId: PLAYERS[0], itemSnapshot: { kind: "TOPUP", name: "110 diamantes", diamonds: 100, bonusDiamonds: 10, region: "global" }, subtotal: 4999, total: 4999, currency: "COP",
        paymentProvider: "bold", expiresAt: new Date(), paidAt: new Date(), deliveredAt: new Date(),
      },
    });
    state.validate.mockImplementation(async (_id: string, o: { productKey: string }) =>
      state.accepts.has(o.productKey) ? { valid: true, verifiable: true } : state.unsupported.has(o.productKey) ? { valid: true, verifiable: false } : { valid: false, verifiable: true },
    );
  });

  afterAll(async () => {
    await db.order.deleteMany({ where: { id: { startsWith: `gc_${RUN}_` } } });
    await db.diamondPackage.deleteMany({ where: { OR: [{ slug: { startsWith: `gc-${RUN}` } }, { providerSku: { startsWith: `topup/free-fire/${RUN}/` } }] } });
    await db.supplierProduct.deleteMany({ where: { productKey: { startsWith: `topup/free-fire/${RUN}/` } } });
    await db.$disconnect();
    vi.unstubAllGlobals();
  });

  it("el historial muestra recargas de Global entregadas a cuentas de Latinoamérica", async () => {
    expect(await globalDeliveredToLatam()).toMatchObject({ latamAccounts: expect.any(Number) });
    const r = await globalDeliveredToLatam();
    expect(r.globalDelivered).toBeGreaterThanOrEqual(1);
    expect(r.latamAccounts).toBeGreaterThanOrEqual(1);
  });

  it("si Central One RECHAZA cuentas de Latinoamérica, no se mueve aunque la ficha diga que sirve", async () => {
    const { moves } = await moveGlobalCardsToLatam({ dryRun: true });
    const weekly = moves.find((m) => m.card === "Tarjeta Semanal")!;
    expect(weekly.action).toBe("skipped");
    expect(weekly.checks).toEqual({ valid: 0, invalid: 3, unverified: 0 });
  });

  it("modo revisar: sin verificación de IDs, vale lo que dice la ficha; informa y no cambia nada", async () => {
    // Como en Central One: las tarjetas de Global no tienen verificación de IDs («not_supported»).
    state.unsupported = new Set([key("gsem"), key("gbas")]);
    const before = await db.diamondPackage.findUniqueOrThrow({ where: { id: weeklyId } });
    const { moves, accounts } = await moveGlobalCardsToLatam({ dryRun: true });
    expect(accounts).toBe(3);
    const by = Object.fromEntries(moves.map((m) => [m.card, m]));
    expect(by["Tarjeta Semanal"]).toMatchObject({ action: "moved", priceFrom: 13999, priceTo: 9999 });
    expect(by["Tarjeta Semanal"].reason).toContain("excepto VN/TH/ID/Medio Oriente");
    expect(by["Tarjeta Mensual"]).toMatchObject({ action: "kept" }); // la de Latinoamérica es más barata
    // Sin verificación y su ficha no dice dónde sirve: no se mueve.
    expect(by["Tarjeta Semanal Básica"]).toMatchObject({ action: "skipped" });
    expect(by["Tarjeta Semanal Básica"].checks).toEqual({ valid: 0, invalid: 0, unverified: 3 });
    expect(await db.diamondPackage.findUniqueOrThrow({ where: { id: weeklyId } })).toEqual(before);
  });

  it("aplica: la Semanal usa la de Global a mejor precio (con ganancia mínima), la Mensual no se toca", async () => {
    state.validate.mockClear();
    const { moves } = await moveGlobalCardsToLatam();
    expect(moves.find((m) => m.card === "Tarjeta Semanal")!.action).toBe("moved");
    // Se comprobó con cuentas reales de Latinoamérica, con el producto de Global y el nombre de región de Latinoamérica.
    expect(state.validate).toHaveBeenCalledWith(PLAYERS[0], { productKey: key("gsem"), region: "LATAM" });
    const weekly = await db.diamondPackage.findUniqueOrThrow({ where: { id: weeklyId } });
    expect(weekly).toMatchObject({ region: "latam", providerSku: key("gsem"), costCents: 150, price: 9999, compareAtPrice: null, active: true });
    expect(marginOf(weekly.price, weekly.costCents, 4000)!).toBeGreaterThanOrEqual(30);
    expect(await db.diamondPackage.findUniqueOrThrow({ where: { id: monthlyId } })).toMatchObject({ providerSku: key("lmes"), price: 14999 });
    expect(await db.diamondPackage.count({ where: { region: "latam", name: "Tarjeta Semanal Básica" } })).toBe(0);
    expect(await db.auditLog.count({ where: { action: "supplier.global_cards_latam", createdAt: { gte: new Date(Date.now() - 60_000) } } })).toBeGreaterThanOrEqual(1);

    // La sincronización siguiente conserva el vínculo con Global (no vuelve a la de Latinoamérica).
    await syncSupplierCatalog();
    expect((await db.diamondPackage.findUniqueOrThrow({ where: { id: weeklyId } })).providerSku).toBe(key("gsem"));
  });

  it("si Central One acepta la Semanal Básica de Global, se agrega a Latinoamérica; correrlo otra vez no repite nada", async () => {
    state.accepts = new Set([key("gsem"), key("gbas")]);
    const { moves } = await moveGlobalCardsToLatam();
    const lite = moves.find((m) => m.card === "Tarjeta Semanal Básica")!;
    expect(lite.action).toBe("created");
    const pkg = await db.diamondPackage.findFirstOrThrow({ where: { region: "latam", providerSku: key("gbas"), active: true } });
    expect(pkg.price).toBe(lite.priceTo);
    expect(pkg.price).toBeGreaterThanOrEqual(floorPrice(80, 4000, 30));

    const again = await moveGlobalCardsToLatam();
    expect(again.moves.map((m) => m.action).sort()).toEqual(["kept", "kept", "kept"]);
  });

  it("Indonesia apagada: sale de la tienda y «Activar todo» no la vuelve a mostrar", async () => {
    const r = await turnOffRegions(["id"]);
    expect(r.after).toEqual(["latam", "global"]);
    expect(state.settings.topupRegions).toBe("latam,global");
    expect(state.settings.topupRegionsOff).toBe("id");
    expect(r.deactivated).toBeGreaterThanOrEqual(1);
    expect((await db.diamondPackage.findUniqueOrThrow({ where: { slug: `gc-${RUN}-i110` } })).active).toBe(false);
    const all = await activateAllFreeFire({ general: 30, small: 40 });
    expect(all.regions).not.toContain("id");
    // «Activar todo» no reactiva ni crea paquetes de la región quitada.
    expect(await db.diamondPackage.count({ where: { region: "id", active: true } })).toBe(0);
    expect(state.settings.topupRegions.split(",")).not.toContain("id");
    // Sus paquetes no se borran.
    expect(await db.diamondPackage.count({ where: { slug: `gc-${RUN}-i110` } })).toBe(1);
    // «Activar todo» tampoco devolvió la Semanal de Latinoamérica a su producto anterior.
    expect((await db.diamondPackage.findUniqueOrThrow({ where: { id: weeklyId } })).providerSku).toBe(key("gsem"));
  });

  it("nunca deja la tienda sin regiones", async () => {
    state.settings.topupRegions = "latam";
    const r = await turnOffRegions(["latam"]);
    expect(r.after).toEqual(["latam"]);
  });
});
