/**
 * Correos automáticos para atraer y recuperar clientes, contra la base MySQL de PRUEBAS:
 *   TEST_DATABASE_URL=mysql://usuario:clave@localhost:3306/vanta_test npx vitest run tests/marketing.test.ts
 * Nada sale a internet: el envío de correos es simulado.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const cfg = vi.hoisted(() => {
  const url = process.env.TEST_DATABASE_URL ?? "";
  const safe = /\/[^/?]*test[^/?]*(\?|$)/i.test(url);
  if (safe) process.env.DATABASE_URL = url;
  process.env.APP_URL = "https://tienda.test";
  return { enabled: safe };
});

const state = vi.hoisted(() => ({
  settings: { maintenanceMode: "false", autoRecovery: "true", mktFirstPurchase: "true", mktWinbackDays: "21", marketingPromoCode: "", emailAutomationsAt: "", orderPrefix: "VT" } as Record<string, string>,
}));
const mail = vi.hoisted(() => ({
  sendEmail: vi.fn(async () => ({ status: "SENT" as const })),
  notifyOrder: vi.fn(async () => {}),
}));

vi.mock("@/server/settings", () => ({ getSettings: vi.fn(async () => ({ ...state.settings })), saveSettings: vi.fn(async (v: Record<string, string>) => void Object.assign(state.settings, v)) }));
vi.mock("@/server/notifications", () => ({ sendEmail: mail.sendEmail, notifyOrder: mail.notifyOrder, getBrand: async () => ({ storeName: "VANTAGG", appUrl: "https://tienda.test" }) }));

import { db } from "@/lib/db";
import { marketingPromo, recordCheckoutConsent, runEmailAutomations, setMarketingConsent, unsubscribeToken, unsubscribeUrl, validUnsubscribe } from "@/server/marketing";
import { POST as oneClick } from "@/app/api/correos/baja/route";

const RUN = Date.now().toString(36);
const DAY = 86400_000;
const NOW = new Date(Date.now() + 2 * DAY); // a las 10 a. m. de Colombia (ver abajo)
NOW.setUTCHours(15, 0, 0, 0);
const email = (k: string) => `mkt-${RUN}-${k}@example.com`;
const sentTo = (template: string) => (mail.sendEmail.mock.calls as unknown as Array<[string, string]>).filter((c) => c[1] === template).map((c) => c[0]);

async function user(k: string, opts: { optIn?: boolean; daysAgo?: number; playerId?: string } = {}) {
  return db.user.create({
    data: { email: email(k), name: "Cliente Prueba", passwordHash: "x", role: "CUSTOMER", marketingOptIn: opts.optIn ?? true, createdAt: new Date(NOW.getTime() - (opts.daysAgo ?? 2) * DAY), ffPlayerId: opts.playerId ?? null },
  });
}
let seq = 0;
async function order(k: string, status: string, daysAgo: number, extra: Record<string, unknown> = {}) {
  seq++;
  const at = new Date(NOW.getTime() - daysAgo * DAY);
  return db.order.create({
    data: {
      number: `MK-${RUN}-${seq}`.toUpperCase(), type: "TOPUP", status: status as never, idempotencyKey: `mk-${RUN}-${seq}`, trackingToken: `mk-token-${RUN}-${seq}`,
      customerEmail: email(k), playerId: "123456789", itemSnapshot: { kind: "TOPUP", name: "110 diamantes", diamonds: 100, bonusDiamonds: 10, region: "latam" },
      subtotal: 3999, total: 3999, currency: "COP", paymentProvider: "bold", createdAt: at, expiresAt: at, ...extra,
    },
  });
}

describe.skipIf(!cfg.enabled)("Correos automáticos (base de pruebas)", () => {
  beforeAll(async () => {
    await db.$connect();
  });
  afterAll(async () => {
    await db.notification.deleteMany({ where: { recipient: { startsWith: `mkt-${RUN}-` } } });
    await db.order.deleteMany({ where: { customerEmail: { startsWith: `mkt-${RUN}-` } } });
    await db.auditLog.deleteMany({ where: { entity: "User", entityId: { in: (await db.user.findMany({ where: { email: { startsWith: `mkt-${RUN}-` } }, select: { id: true } })).map((u) => u.id) } } });
    await db.user.deleteMany({ where: { email: { startsWith: `mkt-${RUN}-` } } });
    await db.emailContact.deleteMany({ where: { email: { startsWith: `mkt-${RUN}-` } } });
    await db.promoCode.deleteMany({ where: { code: { startsWith: `MK${RUN}`.toUpperCase() } } });
    await db.$disconnect();
  });
  beforeEach(() => {
    vi.clearAllMocks();
    state.settings.emailAutomationsAt = "";
  });

  it("primera recarga: solo a registrados que aceptaron ofertas, con más de un día y sin compras; una sola vez", async () => {
    await user("nuevo", { optIn: true, daysAgo: 2, playerId: "987654321" });
    await user("sin-permiso", { optIn: false, daysAgo: 2 });
    await user("recien", { optIn: true, daysAgo: 0.1 });
    await user("ya-compro", { optIn: true, daysAgo: 3 });
    await order("ya-compro", "DELIVERED", 1);

    const r = await runEmailAutomations({ now: NOW, force: true });
    expect(r.ran).toBe(true);
    const to = sentTo("mkt_first_purchase");
    expect(to).toContain(email("nuevo"));
    expect(to).not.toContain(email("sin-permiso"));
    expect(to).not.toContain(email("recien"));
    expect(to).not.toContain(email("ya-compro"));

    // El correo trae «Darte de baja» y la baja de un clic; el enlace lleva su ID guardado.
    const call = (mail.sendEmail.mock.calls as unknown as Array<[string, string, { html: string; text: string }, { headers: Record<string, string> }]>).find((c) => c[0] === email("nuevo"))!;
    expect(call[2].html).toContain("Darte de baja");
    expect(call[2].html).toContain("id=987654321");
    expect(call[3].headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");

    vi.clearAllMocks();
    await runEmailAutomations({ now: NOW, force: true });
    expect(sentTo("mkt_first_purchase")).not.toContain(email("nuevo"));
  });

  it("te extrañamos: a los N días sin comprar, una vez por racha y nunca a quien no aceptó", async () => {
    await user("inactivo", { optIn: true, daysAgo: 60 });
    await order("inactivo", "DELIVERED", 30);
    await user("activo", { optIn: true, daysAgo: 60 });
    await order("activo", "DELIVERED", 5);
    await user("inactivo-sin-permiso", { optIn: false, daysAgo: 60 });
    await order("inactivo-sin-permiso", "DELIVERED", 40);

    await runEmailAutomations({ now: NOW, force: true });
    const to = sentTo("mkt_winback");
    expect(to).toContain(email("inactivo"));
    expect(to).not.toContain(email("activo"));
    expect(to).not.toContain(email("inactivo-sin-permiso"));

    // Otra vuelta (aunque pase la semana de espera): no se repite hasta que vuelva a comprar.
    vi.clearAllMocks();
    await runEmailAutomations({ now: new Date(NOW.getTime() + 10 * DAY), force: true });
    expect(sentTo("mkt_winback")).not.toContain(email("inactivo"));
  });

  it("no envía de noche, en mantenimiento ni más de una vez cada 10 minutos", async () => {
    await user("noche", { optIn: true, daysAgo: 2 });
    const night = new Date(NOW);
    night.setUTCHours(7, 0, 0, 0); // 2 a. m. en Colombia
    expect((await runEmailAutomations({ now: night, force: true })).ran).toBe(false);

    state.settings.maintenanceMode = "true";
    try {
      expect((await runEmailAutomations({ now: NOW, force: true })).ran).toBe(false);
    } finally {
      state.settings.maintenanceMode = "false";
    }
    expect(mail.sendEmail).not.toHaveBeenCalled();

    expect((await runEmailAutomations({ now: NOW })).ran).toBe(true);
    expect((await runEmailAutomations({ now: new Date(NOW.getTime() + 5 * 60_000) })).ran).toBe(false); // 5 minutos después
  });

  it("comprar de nuevo sale solo 1 hora después de vencer, no antes", async () => {
    const old = await order("vencido", "CANCELLED", 0, { cancelledAt: new Date(NOW.getTime() - 2 * 3600_000), createdAt: new Date(NOW.getTime() - 3 * 3600_000) });
    const fresh = await order("vencido-reciente", "CANCELLED", 0, { cancelledAt: new Date(NOW.getTime() - 20 * 60_000), createdAt: new Date(NOW.getTime() - 80 * 60_000) });
    for (const o of [old, fresh]) await db.orderEvent.create({ data: { orderId: o.id, type: "EXPIRED", message: "Venció.", actor: "SYSTEM" } });
    await runEmailAutomations({ now: NOW, force: true });
    const ids = (mail.notifyOrder.mock.calls as unknown as Array<[string, string]>).filter((c) => c[1] === "order_recovery").map((c) => c[0]);
    expect(ids).toContain(old.id);
    expect(ids).not.toContain(fresh.id);
  });

  it("darse de baja: enlace firmado, baja de un clic y nada más le llega", async () => {
    const u = await user("baja", { optIn: true, daysAgo: 2 });
    expect(validUnsubscribe(u.id, unsubscribeToken(u.id))).toBe(true);
    expect(validUnsubscribe(u.id, "x".repeat(32))).toBe(false);
    expect(unsubscribeUrl(u.id)).toContain(`/correos/baja?u=${u.id}&t=`);

    const bad = await oneClick(new Request(`https://tienda.test/api/correos/baja?u=${u.id}&t=${"0".repeat(32)}`, { method: "POST" }));
    expect(bad.status).toBe(400);
    const res = await oneClick(new Request(`https://tienda.test/api/correos/baja?u=${u.id}&t=${unsubscribeToken(u.id)}`, { method: "POST" }));
    expect(res.status).toBe(200);
    const after = await db.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(after.marketingOptIn).toBe(false);
    expect(after.marketingOptOutAt).not.toBeNull();

    await runEmailAutomations({ now: NOW, force: true });
    expect(sentTo("mkt_first_purchase")).not.toContain(email("baja"));

    // Si vuelve a aceptar, queda la fecha del nuevo consentimiento.
    await setMarketingConsent(u.id, true, "prueba");
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).marketingConsentAt).not.toBeNull();
  });

  it("compradores sin cuenta: si aceptan al pagar quedan como contacto, reciben ofertas y se dan de baja con un clic", async () => {
    await recordCheckoutConsent({ userId: null, email: ` ${email("invitado").toUpperCase()} `, playerId: "555666777", source: "checkout-recarga" });
    const c = await db.emailContact.findUniqueOrThrow({ where: { email: email("invitado") } });
    expect(c.optIn).toBe(true);
    expect(c.playerId).toBe("555666777");
    expect(c.consentAt).not.toBeNull();
    // Con sesión, el permiso queda en la cuenta (no se crea contacto).
    const u = await user("con-cuenta-al-pagar", { optIn: false, daysAgo: 0.5 });
    await recordCheckoutConsent({ userId: u.id, email: u.email, source: "checkout-recarga" });
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).marketingOptIn).toBe(true);
    expect(await db.emailContact.count({ where: { email: u.email } })).toBe(0);

    // Un día después recibe «primera recarga» con su ID y su propio enlace de baja.
    await db.emailContact.update({ where: { id: c.id }, data: { consentAt: new Date(NOW.getTime() - 2 * DAY) } });
    await runEmailAutomations({ now: NOW, force: true });
    const call = (mail.sendEmail.mock.calls as unknown as Array<[string, string, { html: string }, { headers: Record<string, string> }]>).find((x) => x[0] === email("invitado") && x[1] === "mkt_first_purchase")!;
    expect(call).toBeTruthy();
    expect(call[2].html).toContain("id=555666777");
    expect(call[2].html).toContain(`/correos/baja?c=${c.id}`);
    expect(call[3].headers["List-Unsubscribe"]).toContain(`?c=${c.id}`);

    const res = await oneClick(new Request(`https://tienda.test/api/correos/baja?c=${c.id}&t=${unsubscribeToken(c.id, "c")}`, { method: "POST" }));
    expect(res.status).toBe(200);
    expect((await db.emailContact.findUniqueOrThrow({ where: { id: c.id } })).optIn).toBe(false);
    // La firma de una cuenta no sirve para un contacto (y al revés).
    expect(validUnsubscribe(c.id, unsubscribeToken(c.id, "u"), "c")).toBe(false);
  });

  it("el código de descuento solo se usa si está vigente", async () => {
    const code = `MK${RUN}`.toUpperCase().slice(0, 30);
    await db.promoCode.create({ data: { code, discountType: "PERCENT", value: 10, active: true } });
    expect(await marketingPromo(code.toLowerCase(), NOW)).toMatchObject({ code, text: "10 % de descuento" });
    await db.promoCode.update({ where: { code }, data: { active: false } });
    expect(await marketingPromo(code, NOW)).toBeNull();
    expect(await marketingPromo("NO-EXISTE", NOW)).toBeNull();
  });
});
