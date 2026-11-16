/**
 * Armas Evo: fragmentos de arma y cajas de fragmentos Evo de Central One como categoría propia de la tienda.
 *   TEST_DATABASE_URL=mysql://usuario:clave@localhost:3306/vanta_test npx vitest run tests/armas-evo.test.ts
 * Nada sale a internet: se usan filas del catálogo armadas a mano (los nombres son los reales de Central One).
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const cfg = vi.hoisted(() => {
  const url = process.env.TEST_DATABASE_URL ?? "";
  const safe = /\/[^/?]*test[^/?]*(\?|$)/i.test(url);
  if (safe) process.env.DATABASE_URL = url;
  return { enabled: safe };
});

vi.mock("@/server/settings", () => ({
  getSettings: vi.fn(async () => ({ usdtCop: "3800", topupMargin: "30", minMarginPct: "20", minMarginSmallPct: "0", topupRegions: "latam", fxRates: JSON.stringify({ at: new Date().toISOString(), rates: { COP: 4000 } }) })),
  saveSettings: vi.fn(async () => {}),
}));
vi.mock("@/server/integrations/topup", () => ({ activeTopUpProvider: () => null, activeWholesale: () => null, getTopUpProvider: () => null }));

import { db } from "@/lib/db";
import { isEvoKind, packPath, passGroup, PASS_GROUP_TITLE, PASS_INFO, passKindOf, passOf } from "@/domain/packs";
import { evoFloorPrice, floorPrice, suggestedPrice } from "@/domain/topup-regions";
import { ensureEvoPackages } from "@/server/supplier";

describe("Armas Evo en el catálogo", () => {
  it("reconoce los nombres reales de Central One", () => {
    expect(passKindOf("Free Fire LATAM · 10 Fragmentos de arma Evo")).toBe("evo-frag-10");
    expect(passKindOf("Free Fire LATAM · 500 Fragmentos de arma Evo")).toBe("evo-frag-500");
    expect(passKindOf("Free Fire LATAM · 1 Caja de fragmentos Evo")).toBe("evo-box-1");
    expect(passKindOf("Free Fire LATAM · 50 Cajas de fragmentos Evo")).toBe("evo-box-50");
    expect(passKindOf("Free Fire LATAM · 7 Fragmentos de arma Evo")).toBeNull(); // cantidad que no se vende
    // Lo que ya existía sigue igual.
    expect(passKindOf("Free Fire (BR) · Acceso Evo 7 días")).toBe("evo-7");
    expect(passKindOf("Tarjeta Semanal de Free Fire")).toBe("weekly");
  });

  it("el título de la tienda vuelve a la misma clase (el pedido y el correo usan el título)", () => {
    for (const kind of ["evo-frag-10", "evo-frag-100", "evo-box-1", "evo-box-5"] as const) {
      expect(passKindOf(PASS_INFO[kind].title)).toBe(kind);
      expect(passOf({ diamonds: 0, name: PASS_INFO[kind].title })).toBe(kind);
    }
    expect(PASS_INFO["evo-box-1"].title).toBe("1 Caja de fragmentos Evo");
    expect(PASS_INFO["evo-box-10"].title).toBe("10 Cajas de fragmentos Evo");
    expect(PASS_INFO["evo-frag-100"]).toMatchObject({ headline: "×100", caption: "Fragmentos Evo", art: "evo-frag" });
  });

  it("categoría, subtítulos y página de cada producto", () => {
    expect(passGroup("evo-frag-50")).toBe("evo-frag");
    expect(passGroup("evo-box-5")).toBe("evo-box");
    expect(passGroup("evo-30")).toBe("evo-access");
    expect(passGroup("monthly")).toBe("pass");
    expect(isEvoKind("evo-3")).toBe(true);
    expect(isEvoKind("weekly")).toBe(false);
    expect(isEvoKind(null)).toBe(false);
    expect(PASS_GROUP_TITLE["evo-frag"]).toBe("Fragmentos de arma Evo");
    expect(packPath({ slug: "100-fragmentos-de-arma-evo", pass: "evo-frag-100" })).toBe("/armas-evo?paquete=100-fragmentos-de-arma-evo");
    expect(packPath({ slug: "diamantes-572", pass: null })).toBe("/recargas?paquete=diamantes-572");
  });
});

describe.skipIf(!cfg.enabled)("Activación automática (base de pruebas)", () => {
  const RUN = `ev${Date.now().toString(36)}`;
  const row = (name: string, priceCents: number, regionSlug = "latam", extra: Partial<{ outOfStock: boolean; delivery: string; amount: number | null }> = {}) => ({
    productKey: `topup/free-fire/${regionSlug}/${RUN}/${name}`,
    regionSlug,
    name: `Free Fire LATAM · ${name}`,
    amount: null,
    priceCents,
    outOfStock: false,
    delivery: "player_id",
    ...extra,
  });
  const rows = [
    row("100 Fragmentos de arma Evo", 950),
    row("5 Cajas de fragmentos Evo", 420, "latam", { outOfStock: true }),
    row("50 Fragmentos de arma Evo", 520, "brazil"), // región no visible en la tienda
    row("50 Cajas de fragmentos Evo", 4000, "latam", { delivery: "pin" }), // no se entrega con el ID
    row("10 Fragmentos de arma Evo", 120), // la tienda ya no vende los 10 fragmentos
    row("1 Caja de fragmentos Evo", 90), // ni la caja de 1
    row("Tarjeta Semanal de Free Fire", 200), // no es Arma Evo: la activación de tarjetas va aparte
  ];

  beforeAll(async () => {
    await db.diamondPackage.deleteMany({ where: { providerSku: { contains: RUN } } });
  });
  afterAll(async () => {
    await db.diamondPackage.deleteMany({ where: { providerSku: { contains: RUN } } });
    await db.auditLog.deleteMany({ where: { action: "package.evo_activated" } });
    await db.$disconnect();
  });

  it("crea solo los fragmentos y cajas que faltan, con precio por la tasa más alta y la ganancia mínima", async () => {
    // Ya existían otros paquetes Evo con el mismo título en LATAM (de otra prueba o creados a mano): se borran para empezar limpio.
    await db.diamondPackage.deleteMany({ where: { region: "latam", diamonds: 0, name: { in: ["100 Fragmentos de arma Evo", "5 Cajas de fragmentos Evo"] } } });
    const created = await ensureEvoPackages(rows);
    expect(created.sort()).toEqual(["100 Fragmentos de arma Evo (latam)", "5 Cajas de fragmentos Evo (latam)"]);
    const pkgs = await db.diamondPackage.findMany({ where: { providerSku: { contains: RUN } }, orderBy: { sortOrder: "asc" } });
    expect(pkgs.map((p) => [p.name, p.region, p.diamonds, p.active, p.supplierOutOfStock])).toEqual([
      ["100 Fragmentos de arma Evo", "latam", 0, true, false],
      ["5 Cajas de fragmentos Evo", "latam", 0, true, true],
    ]);
    // Tasa: la del día (4.000) es más alta que la configurada (3.800). Margen general 30 %, ganancia mínima 20 %.
    const frag = pkgs[0];
    // Y al menos el 30 % limpio de la comisión de Bold (regla de fragmentos y cajas Evo).
    expect(frag.price).toBe(Math.max(suggestedPrice(950, 4000, 30), floorPrice(950, 4000, 20), evoFloorPrice(950, 4000)));
    expect(frag.costCents).toBe(950);
    expect(passOf(frag)).toBe("evo-frag-100");
  });

  it("no duplica ni reactiva lo que se apagó a mano", async () => {
    await db.diamondPackage.updateMany({ where: { providerSku: { contains: RUN }, name: "100 Fragmentos de arma Evo" }, data: { active: false, price: 12345 } });
    expect(await ensureEvoPackages(rows)).toEqual([]);
    const frag = await db.diamondPackage.findFirstOrThrow({ where: { providerSku: { contains: RUN }, name: "100 Fragmentos de arma Evo" } });
    expect([frag.active, frag.price]).toEqual([false, 12345]);
    expect(await db.diamondPackage.count({ where: { providerSku: { contains: RUN } } })).toBe(2);
  });
});
