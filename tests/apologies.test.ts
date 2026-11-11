/**
 * Disculpas por demora, contra la base MySQL de PRUEBAS (nada sale a internet: el correo no está configurado y fetch
 * queda bloqueado):
 *   TEST_DATABASE_URL=mysql://usuario:clave@localhost:3306/vanta_test npx vitest run tests/apologies.test.ts
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const cfg = vi.hoisted(() => {
  const url = process.env.TEST_DATABASE_URL ?? "";
  const safe = /\/[^/?]*test[^/?]*(\?|$)/i.test(url);
  if (safe) process.env.DATABASE_URL = url;
  // Sin proveedor de correo: los envíos quedan registrados como «SKIPPED» (nunca salen).
  Object.assign(process.env, { RESEND_API_KEY: "", NOTIFY_PROVIDER: "", APP_URL: "https://tienda.test" });
  return { enabled: safe };
});

import { db } from "@/lib/db";
import { notifyOrder, sendDelayApologies } from "@/server/notifications";
import { orderEmail } from "@/server/email-templates";

const RUN = Date.now().toString(36);
const H = 3600_000;
let seq = 0;

async function delivered(waitedMs: number) {
  seq++;
  const deliveredAt = new Date(Date.now() - 5 * 60_000);
  return db.order.create({
    data: {
      number: `AP-${RUN}-${seq}`.toUpperCase(), type: "TOPUP", status: "DELIVERED", idempotencyKey: `ap-${RUN}-${seq}`, trackingToken: `ap-token-${RUN}-${seq}`,
      customerEmail: `ap-${RUN}-${seq}@example.com`, playerId: "123456789", itemSnapshot: { kind: "TOPUP", name: "110 diamantes", diamonds: 100, bonusDiamonds: 10 },
      subtotal: 3999, total: 3999, currency: "COP", paymentProvider: "bold", expiresAt: new Date(), paidAt: new Date(deliveredAt.getTime() - waitedMs), deliveredAt,
    },
  });
}

describe.skipIf(!cfg.enabled)("Disculpas por demora (base de pruebas)", () => {
  beforeAll(() => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("Red bloqueada en pruebas"); }));
  });
  afterAll(async () => {
    await db.notification.deleteMany({ where: { recipient: { startsWith: `ap-${RUN}-` } } });
    await db.order.deleteMany({ where: { number: { startsWith: `AP-${RUN}-`.toUpperCase() } } });
    await db.$disconnect();
    vi.unstubAllGlobals();
  });

  it("el correo dice que hubo un retraso en el sistema y pide disculpas", () => {
    const e = orderEmail({ storeName: "VANTA", appUrl: "https://tienda.test", supportEmail: null } as never, "delay_apology", { number: "VX-1", type: "TOPUP", item: "110 diamantes", total: "$ 1", link: "https://tienda.test/pedido/VX-1?t=x", isTest: false });
    expect(e.subject).toContain("disculpas");
    expect(e.text).toContain("retraso en nuestro sistema");
    const d = orderEmail({ storeName: "VANTA", appUrl: "https://tienda.test", supportEmail: null } as never, "delivered", { number: "VX-1", type: "TOPUP", item: "110 diamantes", total: "$ 1", link: "https://tienda.test/pedido/VX-1?t=x", isTest: false, late: true });
    expect(d.text).toContain("retraso en nuestro sistema");
  });

  it("solo a quien esperó más de 1 hora, una sola vez; si la disculpa ya iba en el correo de entrega, no se repite", async () => {
    const slow = await delivered(2 * H);
    const fast = await delivered(2 * 60_000);
    const inMail = await delivered(3 * H);
    // Este ya recibió su correo de entrega con la disculpa incluida.
    await notifyOrder(inMail.id, "delivered");
    expect(await db.notification.count({ where: { orderId: inMail.id, template: "delay_apology", status: "SKIPPED" } })).toBe(1);

    const preview = (await sendDelayApologies({ dryRun: true })).map((o) => o.number);
    expect(preview).toContain(slow.number);
    expect(preview).not.toContain(fast.number);
    expect(preview).not.toContain(inMail.number);
    expect(await db.notification.count({ where: { orderId: slow.id, template: "delay_apology" } })).toBe(0); // revisar no envía

    await sendDelayApologies({ dryRun: false });
    expect(await db.notification.count({ where: { orderId: slow.id, template: "delay_apology" } })).toBe(1);
    expect(await db.notification.count({ where: { orderId: fast.id, template: "delay_apology" } })).toBe(0);
    // Otra vez: nada pendiente para estos pedidos (nunca dos disculpas).
    const again = (await sendDelayApologies({ dryRun: false })).map((o) => o.number);
    expect(again).not.toContain(slow.number);
    expect(await db.notification.count({ where: { orderId: slow.id, template: "delay_apology" } })).toBe(1);
  });
});
