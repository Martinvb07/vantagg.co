/**
 * Si el proveedor devuelve el catálogo vacío (o sin la mayoría de los productos vinculados), la sincronización
 * no se aplica: los paquetes no quedan «agotados» por una falla del proveedor. Base MySQL de PRUEBAS:
 *   TEST_DATABASE_URL=mysql://usuario:clave@localhost:3306/vanta_test npx vitest run tests/catalog-guard.test.ts
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const cfg = vi.hoisted(() => {
  const url = process.env.TEST_DATABASE_URL ?? "";
  const safe = /\/[^/?]*test[^/?]*(\?|$)/i.test(url);
  if (safe) process.env.DATABASE_URL = url;
  return { enabled: safe };
});

const fake = vi.hoisted(() => ({ groups: [] as Array<{ key: string; slug: string; products: Array<Record<string, unknown>> }> }));

vi.mock("@/server/settings", () => ({
  getSettings: vi.fn(async () => ({ usdtCop: "4000", topupMargin: "30", topupRegions: "latam", supplierSyncedAt: "" })),
  saveSettings: vi.fn(async () => {}),
}));
vi.mock("@/server/integrations/topup", () => ({
  activeWholesale: () => ({ id: "centralone", wholesale: { catalog: async () => ({ currency: "USD", groups: fake.groups }) } }),
}));

import { db } from "@/lib/db";
import { syncSupplierCatalog } from "@/server/supplier";

const RUN = Date.now().toString(36);
const skus = [110, 341, 572, 1166].map((n) => `${RUN}-${n}`);

describe.skipIf(!cfg.enabled)("Sincronización del catálogo (base de pruebas)", () => {
  beforeAll(async () => {
    // Solo estos paquetes activos para que la prueba sea independiente del resto de la base.
    await db.diamondPackage.updateMany({ where: { active: true }, data: { active: false } });
    for (const [i, sku] of skus.entries()) {
      await db.diamondPackage.create({ data: { slug: `guard-${RUN}-${i}`, name: sku, diamonds: 100, bonusDiamonds: 10, price: 5000, region: "latam", providerSku: sku, active: true } });
    }
  });

  afterAll(async () => {
    await db.diamondPackage.deleteMany({ where: { slug: { startsWith: `guard-${RUN}` } } });
    await db.$disconnect();
  });

  it("un catálogo vacío no se aplica y los paquetes siguen disponibles", async () => {
    fake.groups = [];
    await expect(syncSupplierCatalog()).rejects.toThrow(/vacío/);
    const rows = await db.diamondPackage.findMany({ where: { providerSku: { in: skus } } });
    expect(rows.every((r) => !r.supplierOutOfStock)).toBe(true);
  });

  it("un catálogo sin la mayoría de los productos vinculados tampoco se aplica", async () => {
    fake.groups = [{ key: "LATAM", slug: "latam", products: [{ name: "Free Fire 110 Diamantes", amount: 110, unit: "Diamonds", price: 1, delivery: "player_id", product_key: skus[0], out_of_stock: false }] }];
    await expect(syncSupplierCatalog()).rejects.toThrow(/incompleto/);
    const rows = await db.diamondPackage.findMany({ where: { providerSku: { in: skus } } });
    expect(rows.every((r) => !r.supplierOutOfStock)).toBe(true);
  });

  it("un catálogo completo sí se aplica", async () => {
    fake.groups = [{ key: "LATAM", slug: "latam", products: skus.map((k, i) => ({ name: `Free Fire ${[110, 341, 572, 1166][i]} Diamantes`, amount: [110, 341, 572, 1166][i], unit: "Diamonds", price: 1, delivery: "player_id", product_key: k, out_of_stock: k === skus[3] })) }];
    await expect(syncSupplierCatalog()).resolves.toMatchObject({ products: 4 });
    const last = await db.diamondPackage.findFirstOrThrow({ where: { providerSku: skus[3] } });
    expect(last.supplierOutOfStock).toBe(true);
  });
});
