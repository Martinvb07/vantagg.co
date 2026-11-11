/**
 * Flujo completo pago → entrega contra una base de datos MySQL de PRUEBAS (nunca la real):
 *   TEST_DATABASE_URL=mysql://usuario:clave@localhost:3306/vanta_test npx vitest run tests/payment-flow.test.ts
 * La base debe tener «test» en el nombre y el esquema aplicado (npx prisma db push). Sin TEST_DATABASE_URL
 * estas pruebas se omiten.
 *
 * Nada sale a internet: la API de Bold se simula (fetch interceptado) y el proveedor de recargas es un doble
 * de prueba; los webhooks pasan por la ruta real /api/webhooks/bold con la verificación de firma real.
 */
import { createHmac } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const cfg = vi.hoisted(() => {
  const url = process.env.TEST_DATABASE_URL ?? "";
  const safe = /\/[^/?]*test[^/?]*(\?|$)/i.test(url);
  if (safe) process.env.DATABASE_URL = url;
  Object.assign(process.env, {
    PAYMENT_PROVIDER: "bold",
    BOLD_API_KEY: "llave_identidad_de_prueba",
    BOLD_SECRET_KEY: "llave_secreta_de_prueba",
    BOLD_TEST_MODE: "",
    TOPUP_TEST_MODE: "",
    APP_URL: "https://tienda.test",
  });
  return { enabled: safe, secret: "llave_secreta_de_prueba" };
});

const fakes = vi.hoisted(() => ({
  notify: {
    notifyOrder: vi.fn(async () => {}),
    notifyStaffAccountSold: vi.fn(async () => {}),
    notifyStaffDeliveryIssue: vi.fn(async () => {}),
    notifyStaffPaymentIssue: vi.fn(async () => {}),
    notifyStaffUnknownPayment: vi.fn(async () => {}),
    notifyStaffOrderAlert: vi.fn(async () => {}),
    notifyStaffSystemAlert: vi.fn(async () => {}),
  },
  topup: {
    id: "fake",
    displayName: "Proveedor de prueba",
    simulated: false,
    retryCooldownMs: 15 * 60_000,
    mode: () => "production" as const,
    missingConfig: () => [],
    isEnabled: () => true,
    getProducts: vi.fn(),
    validatePlayer: vi.fn(),
    createTopUp: vi.fn(),
    processDelivery: vi.fn(),
    getTransactionStatus: vi.fn(),
    handleWebhook: vi.fn(),
    healthCheck: vi.fn(),
  },
}));

vi.mock("@/server/notifications", () => fakes.notify);
vi.mock("@/server/integrations/topup", () => ({ activeTopUpProvider: () => fakes.topup, getTopUpProvider: () => fakes.topup, activeWholesale: () => null }));
vi.mock("@/server/chat", () => ({ postSystemMessage: vi.fn(async () => {}) }));
vi.mock("@/server/settings", () => ({ getSettings: vi.fn(async () => ({ orderPrefix: "VT", topupRegions: "latam" })) }));
vi.mock("@/server/supplier", () => ({ checkPlayerRegion: vi.fn(), supplierRate: vi.fn(async () => ({ usdtCop: 4000 })), supplierRegionName: vi.fn(async () => "LATAM") }));
vi.mock("@/lib/auth", () => ({ isStaff: (r: string) => r === "ADMIN" || r === "SUPPORT" }));

import { db } from "@/lib/db";
import { canTransitionManually, ORDER_STATUSES } from "@/domain/order-status";
import { boldReference } from "@/server/integrations/payments/signatures";
import { applyVerifiedPayment, checkPendingPayment, confirmApprovedWebhook, expireStaleOrders, pollCancelledPayments, recheckCancelledPayment, markTopupDeliveredManually, verifyDeliveryWithProvider, createAccountOrder, createTopUpOrder, fulfillOrder, resumeCheckout, retryDelivery, sendPaymentReminders } from "@/server/orders";
import { getSettings } from "@/server/settings";
import { reminderState, sendReminders } from "@/server/reminders";
import { canonicalEmail } from "@/server/order-limits";
import { getOrderForCustomer } from "@/server/order-view";
import { POST as webhook } from "@/app/api/webhooks/[provider]/route";

const RUN = Date.now().toString(36);
let seq = 0;

// --- API de Bold simulada -------------------------------------------------
type Link = { id: string; total: number; status: string; reference: string | null; payment_method: string | null; transaction_id: string | null; expiration_date?: number };
const links = new Map<string, Link>();
const outbound: string[] = [];

function fakeFetch(input: string | URL | Request) {
  const url = String(input instanceof Request ? input.url : input);
  outbound.push(url);
  const m = /^https:\/\/integrations\.api\.bold\.co\/online\/link\/v1\/([^/?]+)$/.exec(url);
  if (m) {
    const link = links.get(decodeURIComponent(m[1]));
    return Promise.resolve(link ? Response.json(link) : new Response("{}", { status: 404 }));
  }
  if (url.startsWith("https://integrations.api.bold.co/payments/webhook/notifications/")) return Promise.resolve(new Response("{}", { status: 403 }));
  return Promise.reject(new Error(`Red bloqueada en pruebas: ${url}`));
}

// --- Utilidades -----------------------------------------------------------
async function makeOrder(opts: { total?: number; packageId?: string; snapshot?: Prisma.InputJsonObject } = {}) {
  seq++;
  const total = opts.total ?? 4900;
  const linkId = `LNK_${RUN}_${seq}`;
  const order = await db.order.create({
    data: {
      id: `ord_${RUN}_${seq}`,
      number: `VT-${RUN}-${seq}`.toUpperCase(),
      type: "TOPUP",
      idempotencyKey: `idem-${RUN}-${seq}`,
      trackingToken: `token-de-seguimiento-${RUN}-${seq}`,
      customerEmail: "cliente@example.com",
      playerId: "123456789",
      packageId: opts.packageId ?? null,
      itemSnapshot: opts.snapshot ?? { kind: "TOPUP", name: "110 diamantes Free Fire", diamonds: 100, bonusDiamonds: 10, sku: "sku-110", region: "latam", regionName: "LATAM", costCents: null, isDemo: false },
      subtotal: total,
      total,
      currency: "COP",
      paymentProvider: "bold",
      expiresAt: new Date(Date.now() + 3600_000),
      events: { create: { type: "CHECKOUT_STARTED", message: "Link de pago creado.", actor: "SYSTEM", data: { provider: "bold", checkoutRef: linkId } } },
    },
  });
  links.set(linkId, { id: linkId, total, status: "ACTIVE", reference: boldReference(order.number), payment_method: null, transaction_id: null, expiration_date: order.expiresAt.getTime() * 1e6 });
  return { order, linkId };
}

/** El cliente pagó el link en Bold (lo que la API de Bold reportará al consultarla). */
function payLink(linkId: string, txId: string, total?: number) {
  const l = links.get(linkId)!;
  links.set(linkId, { ...l, status: "PAID", transaction_id: txId, payment_method: "CARD", total: total ?? l.total });
}

async function addLink(orderId: string, number: string, total: number) {
  const linkId = `LNK_${RUN}_${++seq}`;
  await db.orderEvent.create({ data: { orderId, type: "CHECKOUT_STARTED", message: "Link de pago creado.", actor: "SYSTEM", data: { provider: "bold", checkoutRef: linkId } } });
  links.set(linkId, { id: linkId, total, status: "ACTIVE", reference: boldReference(number), payment_method: null, transaction_id: null });
  return linkId;
}

const sign = (body: string, key = cfg.secret) => createHmac("sha256", key).update(Buffer.from(body).toString("base64")).digest("hex");

function boldEvent(type: "SALE_APPROVED" | "SALE_REJECTED" | "VOID_APPROVED", number: string, txId: string, total: number) {
  return JSON.stringify({ id: `n-${txId}-${type}`, type, subject: txId, time: Date.now(), data: { payment_id: txId, amount: { currency: "COP", total }, metadata: { reference: boldReference(number) }, payment_method: "CARD" } });
}

let ip = 0;
async function postWebhook(body: string, signature: string | null = sign(body)) {
  const headers = new Headers({ "content-type": "application/json", "x-forwarded-for": `198.51.100.${++ip % 250}` });
  if (signature !== null) headers.set("x-bold-signature", signature);
  const res = await webhook(new Request("https://tienda.test/api/webhooks/bold", { method: "POST", body, headers }), { params: Promise.resolve({ provider: "bold" }) });
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
}

const approved = (number: string, providerRef: string, amount = 4900) => ({ providerRef, reference: number, status: "APPROVED" as const, amount, currency: "COP", method: "CARD" });
const statusOf = async (id: string) => (await db.order.findUniqueOrThrow({ where: { id } })).status;
const eventsOf = async (orderId: string, type: string) => db.orderEvent.count({ where: { orderId, type } });
const deliveredOk = { status: "SUCCESS" as const, providerRef: "prov-ok", simulated: false };

// ---------------------------------------------------------------------------

describe.skipIf(!cfg.enabled)("Flujo de pago y entrega (base de pruebas)", () => {
  beforeAll(async () => {
    vi.stubGlobal("fetch", vi.fn(fakeFetch));
    await db.$connect();
  });

  afterAll(async () => {
    const ids = { startsWith: `ord_${RUN}_` };
    await db.order.deleteMany({ where: { id: ids } });
    await db.webhookEvent.deleteMany({ where: { provider: "bold", externalId: { contains: RUN } } });
    await db.diamondPackage.deleteMany({ where: { slug: { startsWith: `pkg-${RUN}` } } });
    await db.$disconnect();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    fakes.topup.createTopUp.mockResolvedValue(deliveredOk);
    fakes.topup.getTransactionStatus.mockResolvedValue({ status: "FAILED", providerRef: "x", simulated: false });
  });

  it("un pedido sin pagar no se recarga", async () => {
    const { order } = await makeOrder();
    await fulfillOrder(order.id);
    await fulfillOrder(order.id, { force: true });
    expect(await statusOf(order.id)).toBe("PENDING_PAYMENT");
    expect(await db.delivery.count({ where: { orderId: order.id } })).toBe(0);
    expect(fakes.topup.createTopUp).not.toHaveBeenCalled();
  });

  it("volver de la pasarela (o consultar el estado) no marca pagado si Bold no reporta el cobro", async () => {
    const { order } = await makeOrder();
    expect(await checkPendingPayment(order.id)).toBe(false);
    expect(await statusOf(order.id)).toBe("PENDING_PAYMENT");
    expect(fakes.topup.createTopUp).not.toHaveBeenCalled();
  });

  it("al vencer un pedido viejo se consulta a Bold una última vez: si ya lo pagó se confirma; si no, se cancela", async () => {
    const paid = await makeOrder();
    const unpaid = await makeOrder();
    // Pedidos de hace 60 h (fuera de la revisión de las últimas 3 h), p. ej. si el mantenimiento estuvo detenido.
    const past = new Date(Date.now() - 60 * 3600_000);
    const linkExpired = new Date(past.getTime() + 3600_000);
    await db.order.updateMany({ where: { id: { in: [paid.order.id, unpaid.order.id] } }, data: { createdAt: past, expiresAt: linkExpired } });
    links.get(paid.linkId)!.expiration_date = linkExpired.getTime() * 1e6;
    payLink(paid.linkId, `TX-${RUN}-tarde`);
    await expireStaleOrders();
    expect(["PAID", "PROCESSING", "DELIVERED"]).toContain(await statusOf(paid.order.id));
    // Cuadra con Bold: «pagado» queda con la fecha en que se pagó a más tardar (vencimiento del link), no la de hoy.
    const paidAt = (await db.order.findUniqueOrThrow({ where: { id: paid.order.id }, select: { paidAt: true } })).paidAt!;
    expect(Math.abs(paidAt.getTime() - linkExpired.getTime())).toBeLessThan(1000);
    expect(await db.orderEvent.count({ where: { orderId: paid.order.id, type: "PAYMENT_CONFIRMED_LATE" } })).toBe(1);
    // El equipo recibe el aviso de que este cliente esperó.
    expect(fakes.notify.notifyStaffOrderAlert).toHaveBeenCalledWith(paid.order.id, "late", "Pago confirmado tarde", expect.stringContaining("a más tardar"), expect.any(String));
    expect(await statusOf(unpaid.order.id)).toBe("CANCELLED");
    expect(await db.orderEvent.count({ where: { orderId: unpaid.order.id, type: "EXPIRED" } })).toBe(1);
    expect(await db.orderEvent.count({ where: { orderId: paid.order.id, type: "EXPIRED" } })).toBe(0);
  });

  it("pagó después de vencer y el aviso no llegó: la consulta lo pasa a pagado y se entrega; lo que canceló el equipo no se toca", async () => {
    const late = await makeOrder();
    const staff = await makeOrder();
    const past = new Date(Date.now() - 2 * 3600_000);
    await db.order.update({ where: { id: late.order.id }, data: { expiresAt: past } });
    await expireStaleOrders(); // Bold aún no lo reporta pagado: se cancela por falta de pago
    expect(await statusOf(late.order.id)).toBe("CANCELLED");
    await db.order.update({ where: { id: staff.order.id }, data: { status: "CANCELLED", cancelledAt: new Date() } });
    payLink(late.linkId, `TX-${RUN}-despues`);
    payLink(staff.linkId, `TX-${RUN}-equipo`);
    expect(await pollCancelledPayments()).toBeGreaterThanOrEqual(1);
    expect(["PAID", "PROCESSING", "DELIVERED"]).toContain(await statusOf(late.order.id));
    expect(await db.order.findUniqueOrThrow({ where: { id: late.order.id }, select: { cancelledAt: true } })).toMatchObject({ cancelledAt: null });
    expect(await recheckCancelledPayment(staff.order.id)).toBe(false);
    expect(await statusOf(staff.order.id)).toBe("CANCELLED");
  });

  it("aviso de Bold con firma inválida: se rechaza y el registro dice si es del modo pruebas o de otra llave", async () => {
    const { order, linkId } = await makeOrder();
    payLink(linkId, `TX-${RUN}-pista`);
    const body = boldEvent("SALE_APPROVED", order.number, `TX-${RUN}-pista`, 4900);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      expect((await postWebhook(body, sign(body, ""))).status).toBe(401);
      expect(warn.mock.calls.map((c) => String(c[0])).join("\n")).toMatch(/MODO PRUEBAS.*pedido de esta tienda: sí/);
      warn.mockClear();
      expect((await postWebhook(body, sign(body, "otra-llave"))).status).toBe(401);
      expect(warn.mock.calls.map((c) => String(c[0])).join("\n")).toMatch(/OTRA llave secreta.*tipo SALE_APPROVED/);
    } finally {
      warn.mockRestore();
    }
    expect(await statusOf(order.id)).toBe("PENDING_PAYMENT");
  });

  it("rechaza el webhook con firma inválida, alterada o ausente", async () => {
    const { order, linkId } = await makeOrder();
    payLink(linkId, `TX-${RUN}-firma`);
    const body = boldEvent("SALE_APPROVED", order.number, `TX-${RUN}-firma`, 4900);
    expect((await postWebhook(body, sign(body, "otra-llave"))).status).toBe(401);
    expect((await postWebhook(body, null)).status).toBe(401);
    expect((await postWebhook(body.replace("4900", "4901"), sign(body))).status).toBe(401);
    expect(await statusOf(order.id)).toBe("PENDING_PAYMENT");
    expect(await db.webhookEvent.count({ where: { externalId: { contains: `TX-${RUN}-firma` } } })).toBe(0);
    expect(fakes.topup.createTopUp).not.toHaveBeenCalled();
  });

  it("un «aprobado» bien firmado que Bold no confirma (llave filtrada) no marca pagado", async () => {
    const { order } = await makeOrder(); // el link sigue sin pagar en Bold
    const r = await postWebhook(boldEvent("SALE_APPROVED", order.number, `TX-${RUN}-falso`, 4900));
    expect(r.status).toBe(503);
    expect(await statusOf(order.id)).toBe("PENDING_PAYMENT");
    expect(fakes.topup.createTopUp).not.toHaveBeenCalled();
  });

  it("un pago rechazado no recarga y se informa al cliente", async () => {
    const { order } = await makeOrder();
    const r = await postWebhook(boldEvent("SALE_REJECTED", order.number, `TX-${RUN}-rech`, 4900));
    expect(r.status).toBe(200);
    expect(await statusOf(order.id)).toBe("PENDING_PAYMENT");
    expect(await eventsOf(order.id, "PAYMENT_NOT_APPROVED")).toBe(1);
    expect(fakes.topup.createTopUp).not.toHaveBeenCalled();
  });

  it("un monto distinto al del pedido no se acepta", async () => {
    const { order, linkId } = await makeOrder({ total: 4900 });
    // Webhook con el monto del pedido pero Bold cobró otro monto → no lo confirma.
    payLink(linkId, `TX-${RUN}-monto`, 1000);
    expect((await postWebhook(boldEvent("SALE_APPROVED", order.number, `TX-${RUN}-monto`, 4900))).status).toBe(503);
    // Aunque Bold confirme un cobro aprobado de 1.000, el pedido es de 4.900: no se paga ni se entrega.
    expect((await postWebhook(boldEvent("SALE_APPROVED", order.number, `TX-${RUN}-monto`, 1000))).status).toBe(200);
    expect(await statusOf(order.id)).toBe("PENDING_PAYMENT");
    expect(await eventsOf(order.id, "PAYMENT_AMOUNT_MISMATCH")).toBe(1);
    expect(fakes.notify.notifyStaffPaymentIssue).toHaveBeenCalledWith(order.id, "amount", expect.any(String), expect.any(String));
    expect(fakes.topup.createTopUp).not.toHaveBeenCalled();
  });

  it("pago aprobado y confirmado por Bold → una sola recarga, con la clave idempotente del pedido", async () => {
    const { order, linkId } = await makeOrder();
    payLink(linkId, `TX-${RUN}-ok`);
    const r = await postWebhook(boldEvent("SALE_APPROVED", order.number, `TX-${RUN}-ok`, 4900));
    expect(r.status).toBe(200);
    expect(await statusOf(order.id)).toBe("DELIVERED");
    expect(fakes.topup.createTopUp).toHaveBeenCalledTimes(1);
    expect(fakes.topup.createTopUp.mock.calls[0][0]).toMatchObject({ idempotencyKey: `topup-${order.id}`, playerId: "123456789", sku: "sku-110", diamonds: 100, test: false });
  });

  it("la notificación duplicada se procesa una sola vez", async () => {
    const { order, linkId } = await makeOrder();
    payLink(linkId, `TX-${RUN}-dup`);
    const body = boldEvent("SALE_APPROVED", order.number, `TX-${RUN}-dup`, 4900);
    const first = await postWebhook(body);
    const second = await postWebhook(body);
    expect(first.status).toBe(200);
    expect(second.json).toMatchObject({ ok: true, duplicate: true });
    // También si llega por otra vía (consulta de estado / conciliación) con el mismo cobro.
    await applyVerifiedPayment("bold", approved(order.number, `TX-${RUN}-dup`), "POLL:bold");
    expect(fakes.topup.createTopUp).toHaveBeenCalledTimes(1);
    expect(await db.payment.count({ where: { orderId: order.id } })).toBe(1);
    expect(await db.delivery.count({ where: { orderId: order.id } })).toBe(1);
    expect(await eventsOf(order.id, "PAYMENT_CONFIRMED")).toBe(1);
  });

  it("confirmaciones simultáneas del mismo pago → una sola entrega", async () => {
    const { order } = await makeOrder();
    const runs = await Promise.allSettled(Array.from({ length: 6 }, () => applyVerifiedPayment("bold", approved(order.number, `TX-${RUN}-conc`), "WEBHOOK:bold")));
    // Alguna carrera puede fallar en la base (clave única) y la pasarela reintenta; lo que importa es que no duplica.
    expect(runs.some((r) => r.status === "fulfilled")).toBe(true);
    expect(await statusOf(order.id)).toBe("DELIVERED");
    expect(await db.delivery.count({ where: { orderId: order.id } })).toBe(1);
    expect(fakes.topup.createTopUp).toHaveBeenCalledTimes(1);
  });

  it("caos: vigilante, mantenimiento, página del cliente y 2 avisos de Bold a la vez → una sola compra; sin pago → ninguna", async () => {
    const { watchdogTick } = await import("@/server/watchdog");
    const { pollPendingPayments, expireStaleOrders: expire } = await import("@/server/orders");
    // Pedido pagado en Bold: todos los caminos intentan confirmarlo al mismo tiempo.
    const paid = await makeOrder();
    payLink(paid.linkId, `TX-${RUN}-caos`);
    const body = boldEvent("SALE_APPROVED", paid.order.number, `TX-${RUN}-caos`, 4900);
    // Pedido NO pagado: los mismos caminos no deben comprar nada.
    const unpaid = await makeOrder();
    await Promise.allSettled([
      watchdogTick(),
      pollPendingPayments(),
      checkPendingPayment(paid.order.id),
      checkPendingPayment(unpaid.order.id),
      postWebhook(body),
      postWebhook(body),
      expire(),
      fulfillOrder(paid.order.id),
      fulfillOrder(unpaid.order.id),
    ]);
    expect(await statusOf(paid.order.id)).toBe("DELIVERED");
    expect(await db.delivery.count({ where: { orderId: paid.order.id } })).toBe(1);
    expect(await db.payment.count({ where: { orderId: paid.order.id, status: "APPROVED" } })).toBe(1);
    // Una sola compra al proveedor para este pedido (el vigilante también entrega otros pedidos pagados de la base).
    const buys = (n: string) => fakes.topup.createTopUp.mock.calls.filter((c) => (c as unknown as [{ orderNumber: string }])[0].orderNumber === n).length;
    expect(buys(paid.order.number)).toBe(1);
    expect(buys(unpaid.order.number)).toBe(0);
    expect(await statusOf(unpaid.order.id)).toBe("PENDING_PAYMENT");
    expect(await db.delivery.count({ where: { orderId: unpaid.order.id } })).toBe(0);
  });

  it("varios procesos de entrega a la vez → una sola compra al proveedor", async () => {
    const { order } = await makeOrder();
    await db.order.update({ where: { id: order.id }, data: { status: "PAID" } });
    await Promise.all(Array.from({ length: 6 }, () => fulfillOrder(order.id)));
    expect(await db.delivery.count({ where: { orderId: order.id } })).toBe(1);
    expect(fakes.topup.createTopUp).toHaveBeenCalledTimes(1);
  });

  it("cambiar el paquete después de comprar no cambia lo que se entrega ni lo que se cobra", async () => {
    const pkg = await db.diamondPackage.create({ data: { slug: `pkg-${RUN}`, name: "110 diamantes", diamonds: 100, bonusDiamonds: 10, price: 4900, region: "latam", providerSku: "sku-110" } });
    const { order, linkId } = await makeOrder({ packageId: pkg.id });
    await db.diamondPackage.update({ where: { id: pkg.id }, data: { price: 100, diamonds: 5600, providerSku: "sku-5600" } });
    payLink(linkId, `TX-${RUN}-snap`);
    await postWebhook(boldEvent("SALE_APPROVED", order.number, `TX-${RUN}-snap`, 4900));
    expect(await statusOf(order.id)).toBe("DELIVERED");
    expect(fakes.topup.createTopUp.mock.calls[0][0]).toMatchObject({ sku: "sku-110", diamonds: 100 });
  });

  it("una tarjeta (sin diamantes) se entrega con su producto y se nombra por lo que es", async () => {
    const { order, linkId } = await makeOrder({
      snapshot: { kind: "TOPUP", name: "Tarjeta Semanal Free Fire", pass: "weekly", diamonds: 0, bonusDiamonds: 0, sku: "sku-semanal", region: "latam", regionName: "LATAM", costCents: null, isDemo: false },
    });
    payLink(linkId, `TX-${RUN}-tarjeta`);
    await postWebhook(boldEvent("SALE_APPROVED", order.number, `TX-${RUN}-tarjeta`, 4900));
    expect(await statusOf(order.id)).toBe("DELIVERED");
    expect(fakes.topup.createTopUp.mock.calls[0][0]).toMatchObject({ sku: "sku-semanal", diamonds: 0 });
    const delivered = await db.orderEvent.findFirstOrThrow({ where: { orderId: order.id, type: "DELIVERED" } });
    expect(delivered.message).toContain("Tarjeta Semanal Free Fire");
    expect(delivered.message).not.toContain("0 diamantes");
  });

  it("corte de red con el proveedor: el reintento usa la MISMA clave idempotente", async () => {
    fakes.topup.createTopUp.mockRejectedValueOnce(new Error("ECONNRESET"));
    const { order } = await makeOrder();
    await applyVerifiedPayment("bold", approved(order.number, `TX-${RUN}-red`), "WEBHOOK:bold");
    expect(await statusOf(order.id)).toBe("DELIVERY_FAILED");
    expect((await db.delivery.findUniqueOrThrow({ where: { orderId: order.id } })).providerRef).toBeNull();

    const r = await retryDelivery(order.id, "ADMIN:prueba");
    expect(r.ok).toBe(true);
    expect(fakes.topup.createTopUp).toHaveBeenCalledTimes(2);
    expect(fakes.topup.createTopUp.mock.calls.map((c) => c[0].idempotencyKey)).toEqual([`topup-${order.id}`, `topup-${order.id}`]);
    expect(await statusOf(order.id)).toBe("DELIVERED");
  });

  it("reintento tras un fallo del proveedor: espera, consulta el estado y no compra dos veces", async () => {
    fakes.topup.createTopUp.mockResolvedValueOnce({ status: "FAILED", providerRef: `co-${RUN}-1`, simulated: false, message: "[provider_unavailable] caído" });
    const { order } = await makeOrder();
    await applyVerifiedPayment("bold", approved(order.number, `TX-${RUN}-ret`), "WEBHOOK:bold");
    expect(await statusOf(order.id)).toBe("DELIVERY_FAILED");

    // Dentro de la espera: no se reintenta.
    const early = await retryDelivery(order.id, "ADMIN:prueba");
    expect(early.ok).toBe(false);
    expect(early.message).toMatch(/Espera \d+ min/);
    expect(fakes.topup.createTopUp).toHaveBeenCalledTimes(1);

    // Pasada la espera, el proveedor dice que al final sí entregó: no se compra otra vez.
    const d = await db.delivery.findUniqueOrThrow({ where: { orderId: order.id } });
    await db.delivery.update({ where: { id: d.id }, data: { updatedAt: new Date(Date.now() - 16 * 60_000) } });
    fakes.topup.getTransactionStatus.mockResolvedValueOnce({ status: "SUCCESS", providerRef: `co-${RUN}-1`, simulated: false });
    const late = await retryDelivery(order.id, "ADMIN:prueba");
    expect(late.ok).toBe(true);
    expect(fakes.topup.createTopUp).toHaveBeenCalledTimes(1);
    expect(await statusOf(order.id)).toBe("DELIVERED");
  });

  it("botón manual: reintenta en el momento (sin los 15 min) si el proveedor confirma que la anterior falló", async () => {
    fakes.topup.createTopUp.mockResolvedValueOnce({ status: "FAILED", providerRef: `co-${RUN}-man`, simulated: false, message: "[refunded] reembolsado" });
    const { order } = await makeOrder();
    await applyVerifiedPayment("bold", approved(order.number, `TX-${RUN}-man`), "WEBHOOK:bold");
    expect(await statusOf(order.id)).toBe("DELIVERY_FAILED");

    // Recién fallado: el automático esperaría; el botón no. Si el proveedor dice que se entregó, no compra de nuevo.
    fakes.topup.getTransactionStatus.mockResolvedValueOnce({ status: "SUCCESS", providerRef: `co-${RUN}-man`, simulated: false });
    const delivered = await retryDelivery(order.id, "ADMIN:prueba", { manual: true });
    expect(delivered.ok).toBe(true);
    expect(fakes.topup.createTopUp).toHaveBeenCalledTimes(1);
    expect(await statusOf(order.id)).toBe("DELIVERED");

    // Otro pedido: el proveedor confirma que falló (reembolsado) → se compra de inmediato con clave nueva.
    fakes.topup.createTopUp.mockResolvedValueOnce({ status: "FAILED", providerRef: `co-${RUN}-man2`, simulated: false, message: "[refunded] reembolsado" });
    const { order: o2 } = await makeOrder();
    await applyVerifiedPayment("bold", approved(o2.number, `TX-${RUN}-man2`), "WEBHOOK:bold");
    const now = await retryDelivery(o2.id, "ADMIN:prueba", { manual: true });
    expect(now.ok).toBe(true);
    expect(fakes.topup.createTopUp).toHaveBeenCalledTimes(3);
    expect(fakes.topup.createTopUp.mock.calls[2][0].idempotencyKey).toBe(`topup-${o2.id}-r2`);
    expect(await statusOf(o2.id)).toBe("DELIVERED");
  });

  it("fallo confirmado por el proveedor → clave nueva; reintentos simultáneos → uno solo", async () => {
    fakes.topup.createTopUp.mockResolvedValueOnce({ status: "FAILED", providerRef: `co-${RUN}-2`, simulated: false, message: "[out_of_stock] agotado" });
    const { order } = await makeOrder();
    await applyVerifiedPayment("bold", approved(order.number, `TX-${RUN}-ret2`), "WEBHOOK:bold");
    const d = await db.delivery.findUniqueOrThrow({ where: { orderId: order.id } });
    await db.delivery.update({ where: { id: d.id }, data: { updatedAt: new Date(Date.now() - 16 * 60_000) } });

    const results = await Promise.all([retryDelivery(order.id, "ADMIN:a"), retryDelivery(order.id, "ADMIN:b"), retryDelivery(order.id, "ADMIN:c")]);
    expect(results.filter((r) => r.message === "Ya hay un reintento en curso.").length).toBe(2);
    expect(fakes.topup.createTopUp).toHaveBeenCalledTimes(2);
    expect(fakes.topup.createTopUp.mock.calls[1][0].idempotencyKey).toBe(`topup-${order.id}-r2`);
    expect(await statusOf(order.id)).toBe("DELIVERED");
  });

  it("si no se puede consultar la transacción anterior, no se reintenta", async () => {
    fakes.topup.createTopUp.mockResolvedValueOnce({ status: "FAILED", providerRef: `co-${RUN}-3`, simulated: false });
    const { order } = await makeOrder();
    await applyVerifiedPayment("bold", approved(order.number, `TX-${RUN}-ret3`), "WEBHOOK:bold");
    const d = await db.delivery.findUniqueOrThrow({ where: { orderId: order.id } });
    await db.delivery.update({ where: { id: d.id }, data: { updatedAt: new Date(Date.now() - 16 * 60_000) } });
    fakes.topup.getTransactionStatus.mockRejectedValueOnce(new Error("timeout"));
    const r = await retryDelivery(order.id, "ADMIN:prueba");
    expect(r.ok).toBe(false);
    expect(fakes.topup.createTopUp).toHaveBeenCalledTimes(1);
    expect(await statusOf(order.id)).toBe("DELIVERY_FAILED");
  });

  it("pago anulado antes de entregar → pedido cancelado; un «aprobado» viejo no lo reactiva", async () => {
    fakes.topup.createTopUp.mockResolvedValueOnce({ status: "FAILED", providerRef: null, simulated: false, message: "[insufficient_balance] sin saldo" });
    const { order, linkId } = await makeOrder();
    payLink(linkId, `TX-${RUN}-void`);
    await postWebhook(boldEvent("SALE_APPROVED", order.number, `TX-${RUN}-void`, 4900));
    expect(await statusOf(order.id)).toBe("DELIVERY_FAILED");

    expect((await postWebhook(boldEvent("VOID_APPROVED", order.number, `TX-${RUN}-void`, 4900))).status).toBe(200);
    expect(await statusOf(order.id)).toBe("CANCELLED");
    expect(fakes.notify.notifyStaffPaymentIssue).toHaveBeenCalledWith(order.id, "voided", expect.any(String), expect.any(String));
    expect((await retryDelivery(order.id, "ADMIN:prueba")).ok).toBe(false);

    const stale = await applyVerifiedPayment("bold", approved(order.number, `TX-${RUN}-void`), "RECONCILE:prueba");
    expect(stale).toMatchObject({ duplicate: true });
    expect(await statusOf(order.id)).toBe("CANCELLED");
    expect(fakes.topup.createTopUp).toHaveBeenCalledTimes(1);
  });

  it("pago anulado después de entregar → no se toca el pedido, se alerta al equipo", async () => {
    const { order, linkId } = await makeOrder();
    payLink(linkId, `TX-${RUN}-cb`);
    await postWebhook(boldEvent("SALE_APPROVED", order.number, `TX-${RUN}-cb`, 4900));
    await postWebhook(boldEvent("VOID_APPROVED", order.number, `TX-${RUN}-cb`, 4900));
    expect(await statusOf(order.id)).toBe("DELIVERED");
    expect(await eventsOf(order.id, "PAYMENT_VOIDED_AFTER_DELIVERY")).toBe(1);
    expect(fakes.notify.notifyStaffPaymentIssue).toHaveBeenCalledWith(order.id, "voided", expect.any(String), expect.any(String));
  });

  it("el cliente paga dos links del mismo pedido → una sola recarga y aviso de devolución", async () => {
    const { order, linkId } = await makeOrder();
    const link2 = await addLink(order.id, order.number, 4900);
    payLink(linkId, `TX-${RUN}-p1`);
    payLink(link2, `TX-${RUN}-p2`);
    await postWebhook(boldEvent("SALE_APPROVED", order.number, `TX-${RUN}-p1`, 4900));
    await postWebhook(boldEvent("SALE_APPROVED", order.number, `TX-${RUN}-p2`, 4900));
    await applyVerifiedPayment("bold", approved(order.number, `TX-${RUN}-p2`), "POLL:bold"); // repetido: no vuelve a avisar
    expect(fakes.topup.createTopUp).toHaveBeenCalledTimes(1);
    expect(await eventsOf(order.id, "PAYMENT_DUPLICATE")).toBe(1);
    expect(await eventsOf(order.id, "PAYMENT_DUPLICATE_PUBLIC")).toBe(1);
    expect(fakes.notify.notifyStaffPaymentIssue).toHaveBeenCalledTimes(1);
    expect(fakes.notify.notifyStaffPaymentIssue).toHaveBeenCalledWith(order.id, "duplicate", expect.any(String), expect.any(String));
  });

  it("un cobro de otro pedido no paga este", async () => {
    const a = await makeOrder();
    const b = await makeOrder();
    await applyVerifiedPayment("bold", approved(a.order.number, `TX-${RUN}-cruz`), "WEBHOOK:bold");
    const r = await applyVerifiedPayment("bold", approved(b.order.number, `TX-${RUN}-cruz`), "WEBHOOK:bold");
    expect(r).toMatchObject({ handled: false });
    expect(await statusOf(b.order.id)).toBe("PENDING_PAYMENT");
    expect(fakes.topup.createTopUp).toHaveBeenCalledTimes(1);
  });

  it("el seguimiento del pedido exige el token o ser el dueño (IDOR)", async () => {
    const { order } = await makeOrder();
    const other = { id: "otro-usuario", role: "CUSTOMER" } as never;
    expect(await getOrderForCustomer(order.number, undefined, null)).toBeNull();
    expect(await getOrderForCustomer(order.number, "token-equivocado", null)).toBeNull();
    expect(await getOrderForCustomer(order.number, order.trackingToken.slice(0, -1), null)).toBeNull();
    expect(await getOrderForCustomer(order.number, undefined, other)).toBeNull();
    expect(await getOrderForCustomer(order.number, order.trackingToken, null)).not.toBeNull();
  });

  it("recordatorio de pago: a los 20 min, solo si aún hay tiempo para pagar, y una sola vez", async () => {
    const now = new Date();
    const at = async (minAgo: number, expiresInMin: number) => {
      const { order } = await makeOrder();
      await db.order.update({ where: { id: order.id }, data: { createdAt: new Date(now.getTime() - minAgo * 60_000), expiresAt: new Date(now.getTime() + expiresInMin * 60_000) } });
      return order;
    };
    const due = await at(25, 35);
    const early = await at(5, 55);
    const almostExpired = await at(55, 5);
    const paid = await at(25, 35);
    await db.order.update({ where: { id: paid.id }, data: { status: "PAID" } });

    await sendPaymentReminders(now);
    const sent = () => fakes.notify.notifyOrder.mock.calls.filter((c) => (c as unknown[])[1] === "payment_reminder").map((c) => (c as unknown[])[0]);
    expect(sent()).toContain(due.id);
    expect(sent()).not.toContain(early.id);
    expect(sent()).not.toContain(almostExpired.id);
    expect(sent()).not.toContain(paid.id);

    // Ya enviado (queda registrado en Notification): no se repite.
    await db.notification.create({ data: { orderId: due.id, channel: "email", recipient: "cliente@example.com", template: "payment_reminder" } });
    vi.clearAllMocks();
    await sendPaymentReminders(now);
    expect(sent()).not.toContain(due.id);
  });

  it("modo mantenimiento: no crea pedidos, no reabre pagos ni pide pagar; lo ya pagado se entrega igual", async () => {
    const { order, linkId } = await makeOrder();
    await db.order.update({ where: { id: order.id }, data: { createdAt: new Date(Date.now() - 25 * 60_000), expiresAt: new Date(Date.now() + 35 * 60_000) } });
    const settings = vi.mocked(getSettings);
    const normal = await settings();
    settings.mockResolvedValue({ ...normal, maintenanceMode: "true", maintenanceMessage: "Volvemos en un rato." } as Awaited<ReturnType<typeof getSettings>>);
    try {
      const before = await db.order.count();
      const topup = await createTopUpOrder({ packageId: "cualquiera", playerId: "123456789", email: "cliente@example.com", paymentProvider: "bold", idempotencyKey: crypto.randomUUID(), acceptTerms: true }, null);
      const account = await createAccountOrder({ accountId: "cualquiera", email: "cliente@example.com", name: "Cliente", phone: "3001234567", paymentProvider: "bold", idempotencyKey: crypto.randomUUID(), acceptTerms: true }, null);
      expect(topup).toEqual({ ok: false, error: "Volvemos en un rato." });
      expect(account).toEqual({ ok: false, error: "Volvemos en un rato." });
      expect(await db.order.count()).toBe(before);

      expect(await resumeCheckout(order.id)).toEqual({ ok: false, error: "Volvemos en un rato." });
      expect(await sendPaymentReminders()).toBe(0);
      expect(fakes.notify.notifyOrder).not.toHaveBeenCalledWith(order.id, "payment_reminder");

      // Un pago que ya se hizo antes de pausar se confirma y se entrega como siempre.
      payLink(linkId, `TX-${RUN}-mant`);
      const r = await postWebhook(boldEvent("SALE_APPROVED", order.number, `TX-${RUN}-mant`, 4900));
      expect(r.status).toBe(200);
      expect(await statusOf(order.id)).toBe("DELIVERED");
      expect(fakes.topup.createTopUp).toHaveBeenCalledTimes(1);
    } finally {
      settings.mockResolvedValue(normal);
    }
  });

  it("recordatorios «comprar de nuevo»: solo a pedidos vencidos sin pagar, uno por persona y nunca a quien ya compró", async () => {
    const now = new Date();
    const mail = (k: string) => `rec-${RUN}-${k}@example.com`;
    const expired = async (k: string, minutesAgo: number, opts: { expiredEvent?: boolean; isTest?: boolean } = {}) => {
      const { order } = await makeOrder();
      const at = new Date(now.getTime() - minutesAgo * 60_000);
      await db.order.update({ where: { id: order.id }, data: { customerEmail: mail(k), status: "CANCELLED", cancelledAt: at, createdAt: at, expiresAt: at, isTest: opts.isTest ?? false } });
      if (opts.expiredEvent ?? true) await db.orderEvent.create({ data: { orderId: order.id, type: "EXPIRED", message: "Venció.", actor: "SYSTEM" } });
      return order;
    };
    const ok = await expired("ok", 120);
    const staff = await expired("staff", 120, { expiredEvent: false }); // lo canceló el equipo
    const test = await expired("test", 120, { isTest: true });
    const old = await expired("dos", 300);
    const recent = await expired("dos", 60); // misma persona: solo el más reciente
    const boughtLater = await expired("compro", 300);
    const later = await makeOrder();
    await db.order.update({ where: { id: later.order.id }, data: { customerEmail: mail("compro"), status: "DELIVERED" } });

    expect(await reminderState(staff.id)).toMatchObject({ kind: "recovery", canSend: false });
    expect(await reminderState(boughtLater.id)).toMatchObject({ kind: "recovery", canSend: false, reason: "El cliente ya compró después de este pedido." });

    // Solo contar: no envía nada.
    vi.clearAllMocks();
    await sendReminders({ kinds: ["recovery"], days: 7, dryRun: true, now });
    expect(fakes.notify.notifyOrder).not.toHaveBeenCalled();

    await sendReminders({ kinds: ["recovery"], days: 7, now });
    const calls = fakes.notify.notifyOrder.mock.calls as unknown as Array<[string, string, { buyAgainUrl?: string }]>;
    const sentTo = calls.filter((c) => c[1] === "order_recovery").map((c) => c[0]);
    expect(sentTo).toContain(ok.id);
    expect(sentTo).toContain(recent.id);
    expect(sentTo).not.toContain(old.id);
    expect(sentTo).not.toContain(staff.id);
    expect(sentTo).not.toContain(test.id);
    expect(sentTo).not.toContain(boughtLater.id);
    // El enlace trae el ID del jugador para comprar en un minuto.
    expect(calls.find((c) => c[0] === ok.id)![2].buyAgainUrl).toMatch(/\/recargas\?.*id=123456789/);

    // En modo mantenimiento no se envía nada.
    vi.clearAllMocks();
    const settings = vi.mocked(getSettings);
    const normal = await settings();
    settings.mockResolvedValue({ ...normal, maintenanceMode: "true" } as Awaited<ReturnType<typeof getSettings>>);
    try {
      await sendReminders({ kinds: ["recovery", "payment"], days: 7, now });
      expect(fakes.notify.notifyOrder).not.toHaveBeenCalled();
    } finally {
      settings.mockResolvedValue(normal);
    }
  });

  it("un pago aprobado de un pedido que ya no existe (p. ej. borrado por cancelado) avisa al equipo una sola vez", async () => {
    const ref = `VT-NO-EXISTE-${RUN}`.toUpperCase();
    expect(await confirmApprovedWebhook("bold", approved(ref, `TX-${RUN}-perdido`))).toBe(false);
    expect(await confirmApprovedWebhook("bold", approved(ref, `TX-${RUN}-perdido`))).toBe(false);
    expect(fakes.notify.notifyStaffUnknownPayment).toHaveBeenCalledTimes(1);
    await db.auditLog.deleteMany({ where: { action: "payment.unknown_order", entityId: `bold:${ref}` } });
  });

  it("límite contra pedidos falsos: por correo (con alias) y por ID; quien paga no se ve afectado", async () => {
    expect(canonicalEmail(" A.Na+promo@GoogleMail.com ")).toBe("ana@gmail.com");
    expect(canonicalEmail("ana+1@hotmail.com")).toBe("ana@hotmail.com");
    expect(canonicalEmail("a.na@hotmail.com")).toBe("a.na@hotmail.com"); // los puntos solo se ignoran en Gmail

    const base = `spam${RUN}`;
    const id = `7${String(Date.now()).slice(-8)}`;
    const input = (email: string, playerId = id) => ({ packageId: "no-existe", playerId, email, paymentProvider: "bold", idempotencyKey: crypto.randomUUID(), acceptTerms: true });
    const mk = async (email: string, status: string, playerId = id) => {
      const { order } = await makeOrder();
      await db.order.update({ where: { id: order.id }, data: { customerEmail: email, playerId, status: status as never } });
      return order;
    };

    // 2 esperando pago (con alias del mismo Gmail) → el tercero se frena.
    const a = await mk(`${base}@gmail.com`, "PENDING_PAYMENT");
    const b = await mk(`${base.slice(0, 3)}.${base.slice(3)}+x@gmail.com`, "PENDING_PAYMENT");
    const r1 = await createTopUpOrder(input(`${base}+otro@gmail.com`, "111222333"), null);
    expect(r1.ok).toBe(false);
    expect(!r1.ok && r1.error).toMatch(/Ya tienes 2 pedidos esperando pago/);

    // Vencen y se suman 3 más sin pagar: 5 en 24 h → se frena por un buen rato, aunque use otro correo con el mismo ID.
    await db.order.updateMany({ where: { id: { in: [a.id, b.id] } }, data: { status: "CANCELLED" } });
    for (let i = 0; i < 3; i++) await mk(`${base}@gmail.com`, "CANCELLED");
    const r2 = await createTopUpOrder(input(`${base}@gmail.com`), null);
    expect(!r2.ok && r2.error).toMatch(/muchos pedidos sin pagar/);
    const r3 = await createTopUpOrder(input(`otra-${base}@example.com`), null);
    expect(!r3.ok && r3.error).toMatch(/muchos pedidos sin pagar/);

    // Quien compra mucho y paga no se frena (aquí falla después, por el paquete inexistente).
    for (let i = 0; i < 6; i++) await mk(`buen-${base}@example.com`, "DELIVERED", "222333444");
    const r4 = await createTopUpOrder(input(`buen-${base}@example.com`, "222333444"), null);
    expect(!r4.ok && r4.error).toBe("Este paquete ya no está disponible.");

    // Los intentos frenados quedan en la auditoría.
    expect(await db.auditLog.count({ where: { action: "order.limit_blocked", createdAt: { gte: new Date(Date.now() - 60_000) } } })).toBeGreaterThanOrEqual(3);
  });

  it("recarga con error: se marca entregada a mano con la referencia del proveedor (solo si está pagada)", async () => {
    const { order } = await makeOrder();
    expect(await markTopupDeliveredManually(order.id, "ADMIN:equipo", "CO-123")).toMatchObject({ ok: false }); // sin pagar: no
    expect(await statusOf(order.id)).toBe("PENDING_PAYMENT");
    await db.order.update({ where: { id: order.id }, data: { status: "DELIVERY_FAILED" } });
    expect(await markTopupDeliveredManually(order.id, "ADMIN:equipo", "x")).toMatchObject({ ok: false }); // referencia muy corta
    const r = await markTopupDeliveredManually(order.id, "ADMIN:equipo", " CO-8F2K91 ");
    expect(r.ok).toBe(true);
    expect(await statusOf(order.id)).toBe("DELIVERED");
    const d = await db.delivery.findUniqueOrThrow({ where: { orderId: order.id } });
    expect([d.status, d.providerRef]).toEqual(["SUCCESS", "CO-8F2K91"]);
    expect(fakes.notify.notifyOrder).toHaveBeenCalledWith(order.id, "delivered");
    expect(await eventsOf(order.id, "STATUS_CHANGED")).toBe(1);
  });

  it("verificar en el proveedor: por su referencia o buscando la nota «Pedido VX-…»; si está completada, queda Entregado", async () => {
    // 1) Con referencia guardada.
    const a = (await makeOrder()).order;
    await db.order.update({ where: { id: a.id }, data: { status: "DELIVERY_FAILED" } });
    await db.delivery.create({ data: { orderId: a.id, provider: "fake", idempotencyKey: `topup-${a.id}`, status: "FAILED", providerRef: `co-${RUN}-a`, attempts: 1 } });
    fakes.topup.getTransactionStatus.mockResolvedValueOnce({ status: "SUCCESS", providerRef: `co-${RUN}-a`, simulated: false });
    expect((await verifyDeliveryWithProvider(a.id, "ADMIN:equipo")).ok).toBe(true);
    expect(await statusOf(a.id)).toBe("DELIVERED");

    // 2) Sin referencia: se encuentra por la nota del pedido entre las últimas órdenes del proveedor.
    const b = (await makeOrder()).order;
    await db.order.update({ where: { id: b.id }, data: { status: "PROCESSING" } });
    const t = fakes.topup as unknown as { wholesale?: unknown };
    t.wholesale = { name: "Central One", orders: vi.fn(async () => [{ ref: "otra", note: "Pedido VX-OTRO" }, { ref: `co-${RUN}-b`, note: `Pedido ${b.number} · topup-${b.id}` }]) };
    try {
      fakes.topup.getTransactionStatus.mockResolvedValueOnce({ status: "SUCCESS", providerRef: `co-${RUN}-b`, simulated: false });
      expect((await verifyDeliveryWithProvider(b.id, "ADMIN:equipo")).ok).toBe(true);
      expect(fakes.topup.getTransactionStatus).toHaveBeenLastCalledWith(`co-${RUN}-b`);
      expect(await statusOf(b.id)).toBe("DELIVERED");

      // 3) No está en el proveedor: no se toca y se explica qué hacer.
      const c = (await makeOrder()).order;
      await db.order.update({ where: { id: c.id }, data: { status: "DELIVERY_FAILED" } });
      const r = await verifyDeliveryWithProvider(c.id, "ADMIN:equipo");
      expect(r.ok).toBe(false);
      expect(r.message).toMatch(/No encontramos/);
      expect(await statusOf(c.id)).toBe("DELIVERY_FAILED");
    } finally {
      delete t.wholesale;
    }
  });

  it("ningún cambio manual de estado puede marcar un pedido como pagado", () => {
    for (const from of ORDER_STATUSES) expect(canTransitionManually(from, "PAID")).toBe(false);
  });

  it("vigilante: recarga pagada sin entregar hace 10 min → aviso al equipo; tarea programada detenida → la tienda hace el mantenimiento y avisa", async () => {
    const { watchdogTick } = await import("@/server/watchdog");
    const { order } = await makeOrder();
    const tenMinAgo = new Date(Date.now() - 10 * 60_000);
    await db.order.update({ where: { id: order.id }, data: { status: "PAID", paidAt: tenMinAgo } });
    await db.orderEvent.create({ data: { orderId: order.id, type: "PAYMENT_CONFIRMED", message: "La pasarela confirmó el pago.", actor: "POLL:bold", createdAt: tenMinAgo } });
    const fresh = await makeOrder();
    await db.order.update({ where: { id: fresh.order.id }, data: { status: "PAID", paidAt: new Date() } });
    await db.orderEvent.create({ data: { orderId: fresh.order.id, type: "PAYMENT_CONFIRMED", message: "La pasarela confirmó el pago.", actor: "POLL:bold" } });
    // La revisión de entregas trabadas corre una vez por minuto: se simula que pasó el minuto desde la anterior.
    await watchdogTick(Date.now() + 61_000);
    expect(fakes.notify.notifyStaffOrderAlert).toHaveBeenCalledWith(order.id, "stuck", "Pago sin entregar", expect.stringMatching(/lleva 1[01] min sin entregarse/), expect.any(String));
    expect(fakes.notify.notifyStaffOrderAlert).not.toHaveBeenCalledWith(fresh.order.id, "stuck", expect.anything(), expect.anything(), expect.anything());
    // El cliente también se entera (una vez): «tu recarga se está demorando, tu pago está seguro».
    expect(fakes.notify.notifyOrder).toHaveBeenCalledWith(order.id, "delivery_failed");
    expect(fakes.notify.notifyOrder).not.toHaveBeenCalledWith(fresh.order.id, "delivery_failed");
    expect(await db.orderEvent.count({ where: { orderId: order.id, type: "DELIVERY_ISSUE", public: true } })).toBe(1);
    await watchdogTick(Date.now() + 2 * 61_000);
    expect(await db.orderEvent.count({ where: { orderId: order.id, type: "DELIVERY_ISSUE", public: true } })).toBe(1);
    expect(fakes.notify.notifyStaffSystemAlert).not.toHaveBeenCalled();
    // 7 min sin que la tarea programada llame: la tienda corre el mantenimiento por su cuenta y avisa.
    const maintenance = await import("@/server/maintenance");
    const before = outbound.length;
    await watchdogTick(Date.now() + 7 * 60_000);
    // El mantenimiento completo intenta actualizar las tasas de cambio: la simulación lo bloquea (no sale nada).
    const extra = outbound.splice(before).filter((u) => !u.startsWith("https://integrations.api.bold.co/"));
    expect(extra.every((u) => u.startsWith("https://open.er-api.com/"))).toBe(true);
    expect(maintenance.maintenanceStatus().lastRunAt).toBeGreaterThan(0);
    expect(fakes.notify.notifyStaffSystemAlert).toHaveBeenCalledWith("cron", expect.stringContaining("mantenimiento"), expect.any(String), expect.any(String));
  });

  it("nada salió a internet salvo la API de Bold simulada", () => {
    expect(outbound.every((u) => u.startsWith("https://integrations.api.bold.co/"))).toBe(true);
  });
});
