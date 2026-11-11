/**
 * Regla de la tienda: lo que no se puede comprar no se muestra. Paquetes inactivos, marcados «no disponible» o
 * agotados en el proveedor, y cuentas reservadas en otro checkout o vendidas, no salen en la tienda; vuelven solos
 * cuando se pueden comprar otra vez. Base MySQL de PRUEBAS:
 *   TEST_DATABASE_URL=mysql://usuario:clave@localhost:3306/vanta_test npx vitest run tests/hide-unavailable.test.ts
 */
import { afterAll, describe, expect, it, vi } from "vitest";

const cfg = vi.hoisted(() => {
  const url = process.env.TEST_DATABASE_URL ?? "";
  const safe = /\/[^/?]*test[^/?]*(\?|$)/i.test(url);
  if (safe) process.env.DATABASE_URL = url;
  return { enabled: safe };
});

vi.mock("@/server/settings", () => ({
  getSettings: vi.fn(async () => ({ topupRegions: "latam", accountsMode: "auto" })),
  saveSettings: vi.fn(async () => {}),
}));

import { db } from "@/lib/db";
import { getAccounts, getPackages, getRelatedAccounts } from "@/server/catalog";

const RUN = `oc${Date.now().toString(36)}`;
const slugs = (rows: Array<{ slug: string }>) => rows.map((r) => r.slug).filter((s) => s.includes(RUN));

describe.skipIf(!cfg.enabled)("Ocultar lo que no está disponible (base de pruebas)", () => {
  afterAll(async () => {
    await db.diamondPackage.deleteMany({ where: { slug: { contains: RUN } } });
    await db.accountListing.deleteMany({ where: { slug: { contains: RUN } } });
    await db.$disconnect();
  });

  it("paquetes: solo se muestran los que se pueden comprar, y el agotado vuelve solo", async () => {
    const base = { diamonds: 100, bonusDiamonds: 10, price: 5000, region: "latam" };
    const mk = (s: string, data: Record<string, unknown>) => db.diamondPackage.create({ data: { ...base, slug: `${s}-${RUN}`, name: s, ...data } });
    await mk("ok", { active: true, available: true });
    const agotado = await mk("agotado", { active: true, available: true, supplierOutOfStock: true });
    await mk("nodisp", { active: true, available: false });
    await mk("inactivo", { active: false, available: true });

    expect(slugs(await getPackages({ regions: ["latam"] }))).toEqual([`ok-${RUN}`]);

    // El proveedor lo vuelve a tener (la sincronización del catálogo quita la marca): reaparece.
    await db.diamondPackage.update({ where: { id: agotado.id }, data: { supplierOutOfStock: false } });
    expect(slugs(await getPackages({ regions: ["latam"] })).sort()).toEqual([`agotado-${RUN}`, `ok-${RUN}`]);
  });

  it("cuentas: las reservadas en otro checkout y las vendidas no salen; si la reserva vence, vuelven", async () => {
    const base = { description: "x", price: 90000, inventoryItems: "x", deliveryConditions: "x", isDemo: true };
    const mk = (s: string, data: Record<string, unknown>) => db.accountListing.create({ data: { ...base, slug: `${s}-${RUN}`, title: `Cuenta ${s} ${RUN}`, ...data } });
    await mk("publicada", { status: "PUBLISHED" });
    const reservada = await mk("reservada", { status: "RESERVED", reservedUntil: new Date(Date.now() + 10 * 60_000) });
    await mk("vencida", { status: "RESERVED", reservedUntil: new Date(Date.now() - 60_000) });
    await mk("vendida", { status: "SOLD", soldAt: new Date() });
    await mk("borrador", { status: "DRAFT" });

    const list = await getAccounts({ q: RUN });
    expect(slugs(list).sort()).toEqual([`publicada-${RUN}`, `vencida-${RUN}`]);
    expect(list.every((a) => a.available)).toBe(true);
    expect(slugs(await getRelatedAccounts("ninguna", 60)).sort()).toEqual([`publicada-${RUN}`, `vencida-${RUN}`]);

    // Su reserva venció sin pago: vuelve a la tienda sola.
    await db.accountListing.update({ where: { id: reservada.id }, data: { reservedUntil: new Date(Date.now() - 1000) } });
    expect(slugs(await getAccounts({ q: RUN })).sort()).toEqual([`publicada-${RUN}`, `reservada-${RUN}`, `vencida-${RUN}`]);
  });
});
