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
import { applyVerifiedPayment, checkPendingPayment, fulfillOrder, retryDelivery, sendPaymentReminders } from "@/server/orders";
import { getOrderForCustomer } from "@/server/order-view";
import { POST as webhook } from "@/app/api/webhooks/[provider]/route";

const RUN = Date.now().toString(36);
let seq = 0;

// --- API de Bold simulada -------------------------------------------------
type Link = { id: string; total: number; status: string; reference: string | null; payment_method: string | null; transaction_id: string | null };
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
  links.set(linkId, { id: linkId, total, status: "ACTIVE", reference: boldReference(order.number), payment_method: null, transaction_id: null });
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

  it("ningún cambio manual de estado puede marcar un pedido como pagado", () => {
    for (const from of ORDER_STATUSES) expect(canTransitionManually(from, "PAID")).toBe(false);
  });

  it("nada salió a internet salvo la API de Bold simulada", () => {
    expect(outbound.every((u) => u.startsWith("https://integrations.api.bold.co/"))).toBe(true);
  });
});
