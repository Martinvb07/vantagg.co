/**
 * Filtro del panel que separa los fragmentos y cajas Evo de las demás recargas, contra la base MySQL de PRUEBAS:
 *   TEST_DATABASE_URL=mysql://usuario:clave@localhost:3306/vanta_test npx vitest run tests/admin-filters.test.ts
 */
import { afterAll, describe, expect, it, vi } from "vitest";

const cfg = vi.hoisted(() => {
  const url = process.env.TEST_DATABASE_URL ?? "";
  const safe = /\/[^/?]*test[^/?]*(\?|$)/i.test(url);
  if (safe) process.env.DATABASE_URL = url;
  return { enabled: safe };
});

import { db } from "@/lib/db";
import { orderWhere } from "@/server/admin-filters";

const RUN = `AF${Date.now().toString(36)}`.toUpperCase();
let seq = 0;
const make = (itemSnapshot: Record<string, unknown>, type: "TOPUP" | "ACCOUNT" = "TOPUP") => {
  seq++;
  return db.order.create({
    data: { number: `${RUN}-${seq}`, type, status: "PROCESSING", idempotencyKey: `${RUN}-${seq}`, trackingToken: `${RUN}-token-${seq}`, customerEmail: "af@example.com", itemSnapshot: itemSnapshot as never, subtotal: 1000, total: 1000, currency: "COP", paymentProvider: "bold", expiresAt: new Date() },
  });
};

describe.skipIf(!cfg.enabled)("Panel: fragmentos y cajas Evo aparte de las recargas (base de pruebas)", () => {
  afterAll(async () => {
    await db.order.deleteMany({ where: { number: { startsWith: RUN } } });
    await db.$disconnect();
  });

  it("«Fragmentos y cajas Evo» y «Diamantes, tarjetas y pases» no se mezclan ni pierden pedidos", async () => {
    const frag = await make({ kind: "TOPUP", name: "100 Fragmentos de arma Evo Free Fire", pass: "evo-frag-100", diamonds: 0 });
    const box = await make({ kind: "TOPUP", name: "5 Cajas de fragmentos Evo Free Fire", pass: "evo-box-5", diamonds: 0 });
    const diamonds = await make({ kind: "TOPUP", name: "110 diamantes Free Fire", pass: null, diamonds: 100, bonusDiamonds: 10 });
    const old = await make({ kind: "TOPUP", name: "572 diamantes Free Fire", diamonds: 520 }); // pedido viejo, sin «pass»
    const card = await make({ kind: "TOPUP", name: "Tarjeta Semanal Free Fire", pass: "weekly", diamonds: 0 });
    const access = await make({ kind: "TOPUP", name: "Acceso Evo 7 días Free Fire", pass: "evo-7", diamonds: 0 });
    const account = await make({ kind: "ACCOUNT", name: "Cuenta Heroico" }, "ACCOUNT");
    const ids = async (tipo: string) => (await db.order.findMany({ where: { ...orderWhere({ tipo, q: RUN }) }, select: { id: true } })).map((o) => o.id).sort();
    expect(await ids("TOKENS")).toEqual([frag.id, box.id].sort());
    expect(await ids("RECARGAS")).toEqual([diamonds.id, old.id, card.id, access.id].sort());
    expect(await ids("TOPUP")).toHaveLength(6);
    expect(await ids("ACCOUNT")).toEqual([account.id]);
  });
});
