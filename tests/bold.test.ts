import { createHmac } from "node:crypto";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { boldOrderNumber, boldReference, boldWebhookSignature, verifyBoldSignature } from "@/server/integrations/payments/signatures";

const sign = (body: string, key: string) => createHmac("sha256", key).update(Buffer.from(body).toString("base64")).digest("hex");

describe("Bold: firmas y referencias", () => {
  const body = JSON.stringify({ id: "n1", type: "SALE_APPROVED", data: { payment_id: "TX1" } });

  it("firma = HMAC-SHA256(llave, cuerpo en Base64) en hex", () => {
    expect(boldWebhookSignature(body, "llave")).toBe(sign(body, "llave"));
  });

  it("acepta la firma correcta y rechaza la alterada o ausente", () => {
    expect(verifyBoldSignature(body, sign(body, "llave"), "llave")).toBe(true);
    expect(verifyBoldSignature(body, sign(body, "llave").toUpperCase(), "llave")).toBe(true);
    expect(verifyBoldSignature(body + " ", sign(body, "llave"), "llave")).toBe(false);
    expect(verifyBoldSignature(body, sign(body, "otra"), "llave")).toBe(false);
    expect(verifyBoldSignature(body, null, "llave")).toBe(false);
  });

  it("en modo pruebas Bold firma con llave vacía", () => {
    expect(verifyBoldSignature(body, sign(body, ""), "")).toBe(true);
  });

  it("la referencia es única por intento y devuelve el número de orden", () => {
    const a = boldReference("VX-7K2M-9QHT", 1_700_000_000_000);
    const b = boldReference("VX-7K2M-9QHT", 1_700_000_000_001);
    expect(a).not.toBe(b);
    expect(a.length).toBeLessThanOrEqual(60);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(boldOrderNumber(a)).toBe("VX-7K2M-9QHT");
    expect(boldOrderNumber(null)).toBeNull();
  });
});

describe("Bold: conector (API simulada)", () => {
  type Provider = (typeof import("@/server/integrations/payments/bold"))["boldProvider"];
  let bold: Provider;
  const calls: Array<{ url: string; init?: RequestInit }> = [];

  beforeAll(async () => {
    vi.stubEnv("PAYMENT_PROVIDER", "bold");
    vi.stubEnv("BOLD_API_KEY", "llave_identidad");
    vi.stubEnv("BOLD_SECRET_KEY", "llave_secreta");
    vi.stubEnv("BOLD_TEST_MODE", "");
    vi.stubEnv("APP_URL", "https://tienda.example");
    bold = (await import("@/server/integrations/payments/bold")).boldProvider;
  });

  afterEach(() => {
    calls.length = 0;
    vi.unstubAllGlobals();
  });

  const mockFetch = (responder: (url: string) => unknown) =>
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify(responder(url)), { status: 200, headers: { "Content-Type": "application/json" } });
    });

  const order = {
    number: "VX-7K2M-9QHT",
    total: 15999,
    currency: "COP",
    description: "Free Fire — 520 + 52 Bonus",
    customerEmail: "cliente@gmail.com",
    trackingToken: "tok123",
    expiresAt: new Date(1_790_000_000_000),
  };

  it("se habilita con PAYMENT_PROVIDER=bold y sus dos llaves", () => {
    expect(bold.missingConfig()).toEqual([]);
    expect(bold.isEnabled()).toBe(true);
    expect(bold.mode()).toBe("production");
  });

  it("crea un link de pago cerrado con monto, referencia, regreso y expiración en nanosegundos", async () => {
    mockFetch(() => ({ payload: { payment_link: "LNK_ABC", url: "https://checkout.bold.co/LNK_ABC" }, errors: [] }));
    const r = await bold.createCheckout(order);
    expect(r).toEqual({ redirectUrl: "https://checkout.bold.co/LNK_ABC", checkoutRef: "LNK_ABC" });
    const { url, init } = calls[0];
    expect(url).toBe("https://integrations.api.bold.co/online/link/v1");
    expect(init?.method).toBe("POST");
    expect((init?.headers as Record<string, string>).Authorization).toBe("x-api-key llave_identidad");
    const raw = String(init?.body);
    expect(raw).toContain(`"expiration_date":1790000000000000000`);
    const sent = JSON.parse(raw.replace(/"expiration_date":\d+/, '"expiration_date":0'));
    expect(sent.amount_type).toBe("CLOSE");
    expect(sent.amount).toEqual({ currency: "COP", total_amount: 15999, tip_amount: 0 });
    expect(boldOrderNumber(sent.reference)).toBe(order.number);
    expect(sent.callback_url).toBe("https://tienda.example/pedido/VX-7K2M-9QHT?t=tok123&from=pago");
    expect(sent.payer_email).toBe("cliente@gmail.com");
  });

  it("no redirige a otro sitio que no sea el checkout de Bold", async () => {
    mockFetch(() => ({ payload: { payment_link: "LNK_X", url: "https://evil.example/pagar" }, errors: [] }));
    await expect(bold.createCheckout(order)).rejects.toThrow();
  });

  it("webhook firmado: pago aprobado con el número de orden", async () => {
    const body = JSON.stringify({
      id: "notif-1",
      type: "SALE_APPROVED",
      subject: "TX9",
      data: { payment_id: "TX9", amount: { currency: "COP", total: 15999 }, metadata: { reference: boldReference(order.number) }, payment_method: "PSE" },
    });
    const r = await bold.handleWebhook({ rawBody: body, headers: new Headers({ "x-bold-signature": sign(body, "llave_secreta") }), url: new URL("https://tienda.example/api/webhooks/bold") });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.eventId).toBe("TX9:SALE_APPROVED");
    expect(r.payment).toEqual({ providerRef: "TX9", reference: order.number, status: "APPROVED", amount: 15999, currency: "COP", method: "PSE" });
  });

  it("webhook sin firma válida se rechaza", async () => {
    const body = JSON.stringify({ id: "n", type: "SALE_APPROVED", data: { payment_id: "TX9" } });
    const r = await bold.handleWebhook({ rawBody: body, headers: new Headers({ "x-bold-signature": sign(body, "otra") }), url: new URL("https://tienda.example") });
    expect(r).toMatchObject({ ok: false, status: 401 });
  });

  it("anulación rechazada no cambia el pago", async () => {
    const body = JSON.stringify({ id: "n2", type: "VOID_REJECTED", data: { payment_id: "TX9", metadata: { reference: "VX-1_a" } } });
    const r = await bold.handleWebhook({ rawBody: body, headers: new Headers({ "x-bold-signature": sign(body, "llave_secreta") }), url: new URL("https://tienda.example") });
    expect(r.ok && r.payment).toBeNull();
  });

  it("si el webhook se demora, el link pagado se confirma con la transacción", async () => {
    mockFetch((url) =>
      url.includes("/online/link/v1/")
        ? { id: "LNK_ABC", total: 15999, status: "PAID", reference: "VX-7K2M-9QHT_lq3x", payment_method: "NEQUI", transaction_id: "TX5" }
        : { notifications: [{ id: "n", type: "SALE_APPROVED", time: 2, data: { payment_id: "TX5", amount: { currency: "COP", total: 15999 }, metadata: { reference: "VX-7K2M-9QHT_lq3x" }, payment_method: "NEQUI" } }] },
    );
    const v = await bold.getCheckout!("LNK_ABC");
    expect(v).toEqual({ providerRef: "TX5", reference: "VX-7K2M-9QHT", status: "APPROVED", amount: 15999, currency: "COP", method: "NEQUI" });
    expect(calls[1].url).toBe("https://integrations.api.bold.co/payments/webhook/notifications/TX5");
  });

  it("sin acceso a las notificaciones (403), el link pagado se confirma con sus propios datos", async () => {
    vi.stubGlobal("fetch", async (url: string) => {
      calls.push({ url });
      return url.includes("/online/link/v1/")
        ? new Response(JSON.stringify({ id: "LNK_ABC", total: 15999, status: "PAID", reference: "VX-7K2M-9QHT_lq3x", payment_method: "PSE", transaction_id: "TX7" }), { status: 200 })
        : new Response(JSON.stringify({ Message: "User is not authorized" }), { status: 403 });
    });
    expect(await bold.getCheckout!("LNK_ABC")).toEqual({ providerRef: "TX7", reference: "VX-7K2M-9QHT", status: "APPROVED", amount: 15999, currency: "COP", method: "PSE" });
    expect(await bold.getPayment("TX7")).toBeNull();
  });

  it("un link en proceso todavía no confirma nada", async () => {
    mockFetch(() => ({ id: "LNK_ABC", total: 15999, status: "PROCESSING", reference: "VX-7K2M-9QHT_lq3x", payment_method: "CREDIT_CARD", transaction_id: null }));
    expect(await bold.getCheckout!("LNK_ABC")).toBeNull();
  });

  it("un link sin pagar no confirma nada", async () => {
    mockFetch(() => ({ id: "LNK_ABC", total: 15999, status: "ACTIVE", reference: "VX-7K2M-9QHT_lq3x", payment_method: null, transaction_id: null }));
    expect(await bold.getCheckout!("LNK_ABC")).toBeNull();
  });
});

describe("Confirmación con la pasarela (firma sola no basta)", () => {
  const claim = { providerRef: "TX1", reference: "VX-AAAA-BBBB", status: "APPROVED" as const, amount: 3499, currency: "COP", method: "PSE" };
  const gw = (over: Partial<typeof claim> = {}) => ({ ...claim, ...over });

  it("acepta si Bold reporta un cobro aprobado por el mismo monto y orden", async () => {
    const { gatewayConfirms } = await import("@/server/integrations/payments/confirm");
    expect(gatewayConfirms(claim, [gw()])).toBe(true);
    expect(gatewayConfirms(claim, [gw({ status: "PENDING" as never }), gw()])).toBe(true);
  });

  it("rechaza un «aprobado» falso: sin cobro pagado, con otro monto, otra moneda u otra orden", async () => {
    const { gatewayConfirms } = await import("@/server/integrations/payments/confirm");
    expect(gatewayConfirms(claim, [])).toBe(false);
    expect(gatewayConfirms(claim, [gw({ status: "PENDING" as never })])).toBe(false);
    expect(gatewayConfirms(claim, [gw({ amount: 1000 })])).toBe(false);
    expect(gatewayConfirms(claim, [gw({ currency: "USD" })])).toBe(false);
    expect(gatewayConfirms(claim, [gw({ reference: "VX-OTRA-ORDN" })])).toBe(false);
  });
});
