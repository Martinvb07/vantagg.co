/**
 * Tarjetas y pases (Tarjeta Semanal, Mensual, Pase Booyah…) contra la base MySQL de PRUEBAS, como
 * tests/payment-flow.test.ts: se crean desde el catálogo del proveedor y se entregan con su producto.
 *   TEST_DATABASE_URL=mysql://usuario:clave@localhost:3306/vanta_test npx vitest run tests/passes.test.ts
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const cfg = vi.hoisted(() => {
  const url = process.env.TEST_DATABASE_URL ?? "";
  const safe = /\/[^/?]*test[^/?]*(\?|$)/i.test(url);
  if (safe) process.env.DATABASE_URL = url;
  return { enabled: safe };
});

vi.mock("@/server/settings", () => ({
  getSettings: vi.fn(async () => ({ usdtCop: "4000", topupMargin: "30", topupRegions: "latam", supplierSyncedAt: "" })),
  saveSettings: vi.fn(async () => {}),
}));

import { db } from "@/lib/db";
import { importRegionPasses } from "@/server/supplier";
import { suggestedPrice } from "@/domain/topup-regions";

const RUN = Date.now().toString(36);
const REGION = `pruebas-${RUN}`;
const product = (key: string, name: string, cents: number, extra: Partial<{ amount: number; unit: string; delivery: string }> = {}) => ({
  productKey: `${RUN}-${key}`,
  game: "free-fire",
  regionSlug: REGION,
  regionName: "LATAM",
  name,
  amount: extra.amount ?? null,
  unit: extra.unit ?? null,
  priceCents: cents,
  outOfStock: false,
  delivery: extra.delivery ?? "player_id",
  syncedAt: new Date(),
});

describe.skipIf(!cfg.enabled)("Tarjetas y pases (base de pruebas)", () => {
  beforeAll(async () => {
    await db.supplierProduct.createMany({
      data: [
        product("semanal-basica", "Tarjeta Semanal Básica de Free Fire", 150),
        product("semanal", "Tarjeta Semanal de Free Fire", 300),
        product("mensual", "Tarjeta Mensual de Free Fire", 1000),
        product("booyah", "Pase Booyah Premium de Free fire", 400),
        product("plus", "Pase Booyah Premium Plus", 900),
        product("pin", "Free Fire 110 Diamantes · PIN", 100, { delivery: "unsupported" }),
        product("110", "Free Fire 110 Diamantes", 100, { amount: 110, unit: "Diamonds" }),
      ],
    });
  });

  afterAll(async () => {
    await db.diamondPackage.deleteMany({ where: { region: REGION } });
    await db.supplierProduct.deleteMany({ where: { regionSlug: REGION } });
    await db.$disconnect();
  });

  it("crea las 4 tarjetas y pases (sin diamantes, con su nombre y precio sugerido) y no los repite", async () => {
    const first = await importRegionPasses(REGION);
    expect(first.created).toBe(4);
    expect(first.names.sort()).toEqual(["Pase Booyah Premium", "Tarjeta Mensual", "Tarjeta Semanal", "Tarjeta Semanal Básica"]);
    const rows = await db.diamondPackage.findMany({ where: { region: REGION }, orderBy: { sortOrder: "asc" } });
    expect(rows.map((r) => [r.name, r.diamonds, r.bonusDiamonds, r.active])).toEqual([
      ["Tarjeta Semanal Básica", 0, 0, true],
      ["Tarjeta Semanal", 0, 0, true],
      ["Tarjeta Mensual", 0, 0, true],
      ["Pase Booyah Premium", 0, 0, true],
    ]);
    const weekly = rows.find((r) => r.name === "Tarjeta Semanal")!;
    expect(weekly.providerSku).toBe(`${RUN}-semanal`);
    expect(weekly.costCents).toBe(300);
    expect(weekly.price).toBe(suggestedPrice(300, 4000, 30));
    // El Booyah Premium Plus, los PIN y los diamantes no se agregan como tarjetas.
    expect(rows.some((r) => r.providerSku === `${RUN}-plus` || r.providerSku === `${RUN}-pin` || r.providerSku === `${RUN}-110`)).toBe(false);

    const again = await importRegionPasses(REGION);
    expect(again.created).toBe(0);
  });
});
