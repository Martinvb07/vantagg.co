/**
 * ePayco junto a Bold, contra la base MySQL de PRUEBAS (nunca la real):
 *   TEST_DATABASE_URL=mysql://usuario:clave@localhost:3306/vanta_test npx vitest run tests/epayco-flow.test.ts
 * Sin TEST_DATABASE_URL estas pruebas se omiten.
 *
 * Nada sale a internet ni se mueve dinero: la API de ePayco se simula (fetch interceptado), las llaves son inventadas
 * y el proveedor de recargas es un doble de prueba. La confirmación pasa por la ruta real /api/webhooks/epayco con la
 * verificación de firma real, y el regreso del cliente por la ruta real /pagar/epayco/retorno/….
 */
import type { Prisma } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const cfg = vi.hoisted(() => {
  const url = process.env.TEST_DATABASE_URL ?? "";
  const safe = /\/[^/?]*test[^/?]*(\?|$)/i.test(url);
  if (safe) process.env.DATABASE_URL = url;
  Object.assign(process.env, {
    PAYMENT_PROVIDER: "bold,epayco",
    BOLD_API_KEY: "llave_identidad_de_prueba",
    BOLD_SECRET_KEY: "llave_secreta_de_prueba",
    BOLD_TEST_MODE: "",
    EPAYCO_PUBLIC_KEY: "publica_de_prueba",
    EPAYCO_PRIVATE_KEY: "privada_de_prueba",
    EPAYCO_P_CUST_ID_CLIENTE: "900001",
    EPAYCO_P_KEY: "p_key_de_prueba",
    EPAYCO_TEST_MODE: "",
    TOPUP_TEST_MODE: "",
    APP_URL: "https://tienda.test",
  });
  return { enabled: safe, customerId: "900001", pKey: "p_key_de_prueba" };
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
  // Visitante: por defecto en México (cobro en dólares). 1 USD = 4.000 COP, recargo 5 %.
  market: { country: "MX", countryName: "México", chosen: false, home: false, currency: "MXN", surchargePct: 5, copPerUsd: 4000, localPerUsd: 18, usdCharge: true },
  settings: { orderPrefix: "VE", topupRegions: "latam", foreignPricing: "usd", foreignSurchargePct: "5" } as Record<string, string>,
}));

vi.mock("@/server/notifications", () => fakes.notify);
vi.mock("@/server/integrations/topup", () => ({ activeTopUpProvider: () => fakes.topup, getTopUpProvider: () => fakes.topup, activeWholesale: () => null }));
vi.mock("@/server/chat", () => ({ postSystemMessage: vi.fn(async () => {}) }));
vi.mock("@/server/settings", () => ({ getSettings: vi.fn(async () => fakes.settings) }));
vi.mock("@/server/market", () => ({ getMarket: vi.fn(async () => fakes.market) }));
vi.mock("@/server/supplier", () => ({ checkPlayerRegion: vi.fn(), supplierRate: vi.fn(async () => ({ usdtCop: 4000 })), supplierRegionName: vi.fn(async () => "LATAM") }));
vi.mock("@/lib/auth", () => ({ isStaff: (r: string) => r === "ADMIN" || r === "SUPPORT" }));

import { db } from "@/lib/db";
import { usdPriceCents } from "@/domain/market";
import { epaycoSignature } from "@/server/integrations/payments/epayco-protocol";
import { checkPendingPayment, createTopUpOrder } from "@/server/orders";
import { POST as webhook } from "@/app/api/webhooks/[provider]/route";
import { GET as paymentReturn } from "@/app/(store)/pagar/epayco/retorno/[number]/[token]/route";

const RUN = Date.now().toString(36);
let seq = 0;

// --- API de ePayco simulada ---------------------------------------------------
const sessions: Array<Record<string, unknown>> = [];
/** Transacciones que ePayco informará al consultarlas por ref_payco. */
const txs = new Map<string, Record<string, unknown>>();
const outbound: string[] = [];

async function fakeFetch(input: string | URL | Request, init?: RequestInit) {
  const url = String(input instanceof Request ? input.url : input);
  outbound.push(url);
  if (url === "https://apify.epayco.co/login") {
    const auth = new Headers(init?.headers).get("authorization") ?? "";
    const ok = auth === `Basic ${Buffer.from("publica_de_prueba:privada_de_prueba").toString("base64")}`;
    return ok ? Response.json({ token: "token-de-prueba" }) : Response.json({ error: "credenciales" }, { status: 401 });
  }
  if (url === "https://apify.epayco.co/payment/session/create") {
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer token-de-prueba");
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    sessions.push(body);
    return Response.json({ success: true, data: { sessionId: `sess_${RUN}_${sessions.length}` } });
  }
  const m = /^https:\/\/secure\.epayco\.co\/validation\/v1\/reference\/([^/?]+)$/.exec(url);
  if (m) {
    const tx = txs.get(decodeURIComponent(m[1]));
    return Response.json(tx ? { success: true, data: tx } : { success: false, text_response: "No encontrada" });
  }
  throw new Error(`Red bloqueada en pruebas: ${url}`);
}

// --- Utilidades -----------------------------------------------------------
async function makeOrder(opts: { total?: number; charge?: { amount: number; currency: string } } = {}) {
  seq++;
  const total = opts.total ?? 20000;
  return db.order.create({
    data: {
      id: `ordep_${RUN}_${seq}`,
      number: `VE-${RUN}-${seq}`.toUpperCase(),
      type: "TOPUP",
      idempotencyKey: `idem-ep-${RUN}-${seq}`,
      trackingToken: `token-ep-${RUN}-${seq}`,
      customerEmail: `cliente${seq}@example.com`,
      playerId: "123456789",
      itemSnapshot: { kind: "TOPUP", name: "520 diamantes Free Fire", diamonds: 500, bonusDiamonds: 20, sku: "sku-520", region: "latam", regionName: "LATAM", costCents: null, isDemo: false } as Prisma.InputJsonObject,
      subtotal: total,
      total,
      currency: "COP",
      chargeCurrency: opts.charge?.currency ?? null,
      chargeAmount: opts.charge?.amount ?? null,
      paymentProvider: "epayco",
      expiresAt: new Date(Date.now() + 3600_000),
      events: { create: { type: "CHECKOUT_STARTED", message: "Cobro iniciado en ePayco.", actor: "SYSTEM", data: { provider: "epayco", checkoutRef: `session:sess_${RUN}_${seq}` } } },
    },
  });
}

/** Transacción como la informa ePayco (consulta y confirmación usan los mismos campos). */
function tx(number: string, ref: string, o: { amount?: string; currency?: string; code?: string; merchant?: string; test?: string } = {}) {
  const d: Record<string, string> = {
    x_cust_id_cliente: o.merchant ?? cfg.customerId,
    x_ref_payco: ref,
    x_transaction_id: `T${ref}`,
    x_id_invoice: `${number}-abc`,
    x_extra1: number,
    x_amount: o.amount ?? "5.29",
    x_currency_code: o.currency ?? "USD",
    x_cod_response: o.code ?? "1",
    x_franchise: "VS",
    x_test_request: o.test ?? "FALSE",
    x_customer_email: "cliente@example.com",
    x_customer_ip: "203.0.113.9",
  };
  d.x_signature = epaycoSignature({ customerId: cfg.customerId, pKey: cfg.pKey, refPayco: d.x_ref_payco, transactionId: d.x_transaction_id, amount: d.x_amount, currency: d.x_currency_code });
  return d;
}

let ip = 0;
async function confirm(fields: Record<string, string>) {
  const body = new URLSearchParams(fields).toString();
  const headers = new Headers({ "content-type": "application/x-www-form-urlencoded", "x-forwarded-for": `198.51.100.${++ip % 250}` });
  const res = await webhook(new Request("https://tienda.test/api/webhooks/epayco", { method: "POST", body, headers }), { params: Promise.resolve({ provider: "epayco" }) });
  return res.status;
}

async function comeBack(number: string, token: string, ref: string) {
  const req = new Request(`https://tienda.test/pagar/epayco/retorno/${number}/${token}?ref_payco=${ref}`, { headers: { "x-forwarded-for": `198.51.100.${++ip % 250}` } });
  return paymentReturn(req, { params: Promise.resolve({ number, token }) });
}

const statusOf = async (id: string) => (await db.order.findUniqueOrThrow({ where: { id } })).status;
const deliveredOk = { status: "SUCCESS" as const, providerRef: "prov-ok", simulated: false };
// 20.000 COP a 4.000 por dólar + 5 % = US$ 5,25 → redondeado hacia arriba y terminado en 9: US$ 5,29.
const USD_20000 = usdPriceCents(20000, 4000, 5);

// ---------------------------------------------------------------------------

describe.skipIf(!cfg.enabled)("ePayco junto a Bold (base de pruebas)", () => {
  let pkgId = "";

  beforeAll(async () => {
    vi.stubGlobal("fetch", vi.fn(fakeFetch));
    await db.$connect();
    pkgId = (await db.diamondPackage.create({ data: { slug: `pkg-ep-${RUN}`, name: "520 diamantes", diamonds: 500, bonusDiamonds: 20, price: 20000, region: "latam", providerSku: "sku-520" } })).id;
  });

  afterAll(async () => {
    await db.order.deleteMany({ where: { OR: [{ id: { startsWith: `ordep_${RUN}_` } }, { packageId: pkgId }] } });
    await db.webhookEvent.deleteMany({ where: { provider: "epayco", externalId: { contains: RUN } } });
    await db.diamondPackage.deleteMany({ where: { id: pkgId } });
    await db.$disconnect();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    fakes.market = { ...fakes.market, home: false, usdCharge: true, country: "MX" };
    fakes.topup.validatePlayer.mockResolvedValue({ verifiable: true, valid: true, nickname: "Jugador" });
    fakes.topup.createTopUp.mockResolvedValue(deliveredOk);
    fakes.topup.getTransactionStatus.mockResolvedValue({ status: "FAILED", providerRef: "x", simulated: false });
  });

  // Cada compra con su propio ID de jugador: así no la frena el límite de pedidos sin pagar por ID.
  let player = 0;
  const buy = (provider: string, email: string) =>
    createTopUpOrder({ packageId: pkgId, playerId: `5${String(Date.now()).slice(-7)}${++player}`, email, paymentProvider: provider, idempotencyKey: crypto.randomUUID(), acceptTerms: true }, null);

  it("fuera de Colombia con ePayco: cobra el precio en dólares (con el 5 %) y abre el pago en la tienda", async () => {
    expect(USD_20000).toBe(529);
    const r = await buy("epayco", `mx-${RUN}@example.com`);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const order = await db.order.findUniqueOrThrow({ where: { number: r.number } });
    expect(order.total).toBe(20000); // ventas y reportes siguen en pesos
    expect(order.chargeCurrency).toBe("USD");
    expect(order.chargeAmount).toBe(529);
    expect(r.redirectUrl).toBe(`https://tienda.test/pagar/epayco/${order.number}?t=${order.trackingToken}`);
    const s = sessions.at(-1)!;
    expect(s).toMatchObject({ currency: "USD", amount: "5.29", extra1: order.number, country: "CO", test: "false", confirmation: "https://tienda.test/api/webhooks/epayco" });
    expect(String(s.response)).toBe(`https://tienda.test/pagar/epayco/retorno/${order.number}/${order.trackingToken}`);
    expect(String(s.response)).not.toContain("?");
    expect(s.methodsDisable).toEqual(["CASH", "SP"]);
    const started = await db.orderEvent.findFirst({ where: { orderId: order.id, type: "CHECKOUT_STARTED" } });
    expect((started?.data as { checkoutRef?: string }).checkoutRef).toMatch(/^session:sess_/);
  });

  it("en Colombia, o con «cobro en pesos» en Ajustes, ePayco cobra en pesos", async () => {
    fakes.market = { ...fakes.market, home: true, usdCharge: false, country: "CO" };
    const co = await buy("epayco", `co-${RUN}@example.com`);
    expect(co.ok).toBe(true);
    if (co.ok) expect(await db.order.findUniqueOrThrow({ where: { number: co.number } })).toMatchObject({ chargeCurrency: null, chargeAmount: null });
    expect(sessions.at(-1)).toMatchObject({ currency: "COP", amount: "20000" });

    fakes.market = { ...fakes.market, home: false, usdCharge: true, country: "MX" };
    fakes.settings.foreignPricing = "reference";
    try {
      const ref = await buy("epayco", `ref-${RUN}@example.com`);
      expect(ref.ok && (await db.order.findUniqueOrThrow({ where: { number: ref.number } })).chargeCurrency).toBe(null);
    } finally {
      fakes.settings.foreignPricing = "usd";
    }
  });

  it("Bold sigue igual: cobra en pesos aunque el cliente esté fuera de Colombia", async () => {
    const before = outbound.length;
    vi.mocked(fetch).mockImplementationOnce(async () => Response.json({ payload: { payment_link: `LNK_${RUN}`, url: "https://checkout.bold.co/LNK" } }));
    const r = await buy("bold", `bold-${RUN}@example.com`);
    expect(r.ok).toBe(true);
    if (r.ok) expect(await db.order.findUniqueOrThrow({ where: { number: r.number } })).toMatchObject({ paymentProvider: "bold", chargeCurrency: null, total: 20000 });
    expect(outbound.slice(before).some((u) => u.includes("epayco"))).toBe(false);
  });

  it("confirmación con firma inválida o alterada: se rechaza", async () => {
    const o = await makeOrder({ charge: { amount: 529, currency: "USD" } });
    const t = tx(o.number, `${RUN}1`);
    txs.set(t.x_ref_payco, t);
    expect(await confirm({ ...t, x_signature: "0".repeat(64) })).toBe(401);
    expect(await confirm({ ...t, x_amount: "0.29" })).toBe(401);
    const { x_signature: _omit, ...unsigned } = t;
    expect(await confirm(unsigned)).toBe(401);
    expect(await statusOf(o.id)).toBe("PENDING_PAYMENT");
    expect(fakes.topup.createTopUp).not.toHaveBeenCalled();
  });

  it("un «aprobado» bien firmado que ePayco no confirma al consultarlo (llave filtrada) no marca pagado", async () => {
    const o = await makeOrder({ charge: { amount: 529, currency: "USD" } });
    expect(await confirm(tx(o.number, `${RUN}2`))).toBe(503); // la consulta no encuentra la transacción
    expect(await statusOf(o.id)).toBe("PENDING_PAYMENT");
    expect(fakes.topup.createTopUp).not.toHaveBeenCalled();
  });

  it("pago aprobado en dólares y confirmado por ePayco: se paga una vez y se entrega una vez", async () => {
    const o = await makeOrder({ charge: { amount: 529, currency: "USD" } });
    const t = tx(o.number, `${RUN}3`);
    txs.set(t.x_ref_payco, t);
    expect(await confirm(t)).toBe(200);
    expect(await confirm(t)).toBe(200); // reintento de ePayco: no duplica
    expect(await statusOf(o.id)).toBe("DELIVERED");
    expect(fakes.topup.createTopUp).toHaveBeenCalledTimes(1);
    const pay = await db.payment.findFirstOrThrow({ where: { orderId: o.id } });
    expect(pay).toMatchObject({ provider: "epayco", providerRef: t.x_ref_payco, amount: 529, currency: "USD", status: "APPROVED", method: "VISA" });
    // Los datos personales de la confirmación no se guardan en el registro del webhook.
    const ev = await db.webhookEvent.findFirstOrThrow({ where: { provider: "epayco", externalId: { startsWith: `${t.x_ref_payco}:` } } });
    expect(JSON.stringify(ev.payload)).not.toContain("cliente@example.com");
    expect(JSON.stringify(ev.payload)).not.toContain("203.0.113.9");
  });

  it("monto o moneda distintos a lo cobrado: no se paga ni se entrega, y se avisa al equipo", async () => {
    const o = await makeOrder({ charge: { amount: 529, currency: "USD" } });
    const cheap = tx(o.number, `${RUN}4`, { amount: "0.29" });
    txs.set(cheap.x_ref_payco, cheap);
    expect(await confirm(cheap)).toBe(200);
    const pesos = tx(o.number, `${RUN}5`, { amount: "529", currency: "COP" });
    txs.set(pesos.x_ref_payco, pesos);
    expect(await confirm(pesos)).toBe(200);
    expect(await statusOf(o.id)).toBe("PENDING_PAYMENT");
    expect(await db.orderEvent.count({ where: { orderId: o.id, type: "PAYMENT_AMOUNT_MISMATCH" } })).toBe(2);
    expect(fakes.notify.notifyStaffPaymentIssue).toHaveBeenCalledWith(o.id, "amount", expect.any(String), expect.stringContaining("US$ 5,29"));
    expect(fakes.topup.createTopUp).not.toHaveBeenCalled();
  });

  it("al volver de ePayco con ref_payco: se consulta a ePayco y solo cuenta si es nuestro cobro de ESE pedido", async () => {
    const o = await makeOrder({ charge: { amount: 529, currency: "USD" } });
    const other = await makeOrder({ charge: { amount: 529, currency: "USD" } });

    // Token equivocado: no se consulta nada y se manda al inicio.
    const bad = await comeBack(o.number, "token-falso", "999");
    expect(bad.headers.get("location")).toBe("https://tienda.test/");

    // Cobro de OTRO comercio de ePayco con nuestro número de pedido: no vale.
    const foreign = tx(o.number, `${RUN}6`, { merchant: "123456" });
    txs.set(foreign.x_ref_payco, foreign);
    await comeBack(o.number, o.trackingToken, foreign.x_ref_payco);
    // Cobro aprobado, pero de otro pedido: no paga este.
    const otherTx = tx(other.number, `${RUN}7`);
    txs.set(otherTx.x_ref_payco, otherTx);
    await comeBack(o.number, o.trackingToken, otherTx.x_ref_payco);
    // Transacción de pruebas en una tienda que cobra de verdad: no vale.
    const test = tx(o.number, `${RUN}8`, { test: "TRUE" });
    txs.set(test.x_ref_payco, test);
    await comeBack(o.number, o.trackingToken, test.x_ref_payco);
    expect(await statusOf(o.id)).toBe("PENDING_PAYMENT");
    expect(fakes.topup.createTopUp).not.toHaveBeenCalled();

    // Su propio cobro aprobado: pagado y entregado, y el cliente va a su pedido.
    const mine = tx(o.number, `${RUN}9`);
    txs.set(mine.x_ref_payco, mine);
    const res = await comeBack(o.number, o.trackingToken, mine.x_ref_payco);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`https://tienda.test/pedido/${o.number}?t=${o.trackingToken}&from=pago`);
    expect(await statusOf(o.id)).toBe("DELIVERED");
    expect(await statusOf(other.id)).toBe("PENDING_PAYMENT");
  });

  it("pago pendiente (p. ej. PSE) que se aprueba después: lo recoge la consulta aunque no llegue otra confirmación", async () => {
    const o = await makeOrder({ total: 20000 }); // en pesos
    const pending = tx(o.number, `${RUN}10`, { amount: "20000", currency: "COP", code: "3" });
    txs.set(pending.x_ref_payco, pending);
    expect(await confirm(pending)).toBe(200);
    expect(await statusOf(o.id)).toBe("PENDING_PAYMENT");
    expect(await db.payment.count({ where: { orderId: o.id, status: "PENDING" } })).toBe(1);

    txs.set(pending.x_ref_payco, tx(o.number, pending.x_ref_payco, { amount: "20000", currency: "COP", code: "1" }));
    expect(await checkPendingPayment(o.id)).toBe(true);
    expect(await statusOf(o.id)).toBe("DELIVERED");
    expect(fakes.topup.createTopUp).toHaveBeenCalledTimes(1);
  });

  it("pago reversado antes de entregar: el pedido se cancela y el aviso nombra a ePayco", async () => {
    fakes.topup.createTopUp.mockResolvedValue({ status: "FAILED", providerRef: null, simulated: false, message: "sin saldo" });
    const o = await makeOrder({ charge: { amount: 529, currency: "USD" } });
    const t = tx(o.number, `${RUN}11`);
    txs.set(t.x_ref_payco, t);
    expect(await confirm(t)).toBe(200);
    expect(await statusOf(o.id)).toBe("DELIVERY_FAILED");
    const voided = tx(o.number, t.x_ref_payco, { code: "6" });
    txs.set(t.x_ref_payco, voided);
    expect(await confirm(voided)).toBe(200);
    expect(await statusOf(o.id)).toBe("CANCELLED");
    expect(fakes.notify.notifyStaffPaymentIssue).toHaveBeenCalledWith(o.id, "voided", expect.any(String), expect.stringContaining("ePayco anuló"));
  });
});
