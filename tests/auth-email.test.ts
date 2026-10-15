import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
process.env.GOOGLE_CLIENT_ID = "cliente-prueba.apps.googleusercontent.com";
process.env.GOOGLE_CLIENT_SECRET = "secreto-prueba";

const { checkIdClaims, openFlow, sealFlow } = await import("@/server/google-oauth");
const T = await import("@/server/email-templates");
const { safeNext } = await import("@/lib/safe-next");

const now = Date.now();
const good = { iss: "https://accounts.google.com", aud: "cliente-prueba.apps.googleusercontent.com", exp: Math.floor(now / 1000) + 600, nonce: "n-123", email: "Ana@Gmail.com", email_verified: true, sub: "1029384756", name: "Ana" };

describe("Google: validación del token de identidad", () => {
  it("acepta un token válido y normaliza el correo", () => {
    expect(checkIdClaims(good, "n-123", now)).toEqual({ sub: "1029384756", email: "ana@gmail.com", name: "Ana" });
  });
  it("rechaza emisor, audiencia, vencimiento, nonce o correo sin verificar", () => {
    expect(() => checkIdClaims({ ...good, iss: "https://evil.example" }, "n-123", now)).toThrow();
    expect(() => checkIdClaims({ ...good, aud: "otra-app" }, "n-123", now)).toThrow();
    expect(() => checkIdClaims({ ...good, exp: Math.floor(now / 1000) - 3600 }, "n-123", now)).toThrow();
    expect(() => checkIdClaims(good, "otro-nonce", now)).toThrow();
    expect(() => checkIdClaims({ ...good, email_verified: false }, "n-123", now)).toThrow();
  });
  it("la cookie del intento no se puede alterar ni reutilizar vencida", () => {
    const sealed = sealFlow({ state: "s", verifier: "v", nonce: "n", next: "/cuenta", exp: now + 60_000 });
    expect(openFlow(sealed)?.state).toBe("s");
    const [payload] = sealed.split(".");
    const forged = Buffer.from(JSON.stringify({ state: "s", verifier: "v", nonce: "n", next: "//evil.example", exp: now + 60_000 })).toString("base64url");
    expect(openFlow(`${forged}.${sealed.split(".")[1]}`)).toBeNull();
    expect(openFlow(`${payload}.firma-falsa`)).toBeNull();
    expect(openFlow(sealFlow({ state: "s", verifier: "v", nonce: "n", next: "/", exp: now - 1 }))).toBeNull();
  });
});

describe("Redirecciones seguras", () => {
  it("solo permite rutas internas", () => {
    expect(safeNext("/cuenta", "/")).toBe("/cuenta");
    expect(safeNext("//evil.example", "/")).toBe("/");
    expect(safeNext("/\\evil.example", "/")).toBe("/");
    expect(safeNext("https://evil.example", "/")).toBe("/");
  });
});

describe("Plantillas de correo", () => {
  const brand = { storeName: "VANTA", appUrl: "https://tienda.example", supportEmail: "soporte@tienda.example" };
  it("escapan el contenido variable (sin HTML inyectado)", () => {
    const e = T.orderEmail(brand, "payment_confirmed", { number: "VX-1", type: "TOPUP", item: '<img src=x onerror="alert(1)">', total: "$ 1", link: "https://tienda.example/pedido/VX-1?t=a&b=c", isTest: false });
    expect(e.html).not.toContain("<img src=x");
    expect(e.html).toContain("&lt;img src=x");
    expect(e.html).toContain("t=a&amp;b=c");
  });
  it("incluyen versión de texto y el código visible", () => {
    const e = T.codeEmail(brand, { code: "123456", purpose: "LOGIN", minutes: 10 });
    expect(e.subject).toContain("123456");
    expect(e.text).toContain("123456");
    expect(e.html).toContain("123456");
  });
  it("el aviso de chat nunca incluye el contenido del mensaje", () => {
    const e = T.chatMessageEmail(brand, { number: "VX-1", link: "https://tienda.example/pedido/VX-1?t=x" });
    expect(e.html).toContain("#chat");
    expect(e.text).not.toMatch(/contraseña:/i);
  });
});
