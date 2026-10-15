import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, generateRecoveryCodes, generateTotpSecret, normalizeRecovery, otpauthUri, totpAt, verifyTotp } from "@/lib/totp";

// Secreto del RFC 6238 (ASCII "12345678901234567890") en base32.
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890"));

describe("TOTP (RFC 6238)", () => {
  it("coincide con los vectores oficiales (6 dígitos)", () => {
    expect(RFC_SECRET).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    expect(totpAt(RFC_SECRET, Math.floor(59 / 30))).toBe("287082");
    expect(totpAt(RFC_SECRET, Math.floor(1111111109 / 30))).toBe("081804");
    expect(totpAt(RFC_SECRET, Math.floor(1234567890 / 30))).toBe("005924");
    expect(totpAt(RFC_SECRET, Math.floor(2000000000 / 30))).toBe("279037");
  });
  it("base32 ida y vuelta", () => {
    const s = generateTotpSecret();
    expect(s).toMatch(/^[A-Z2-7]{32}$/);
    expect(base32Encode(base32Decode(s))).toBe(s);
  });
  it("acepta el paso actual y ±1, rechaza códigos viejos o reutilizados", () => {
    const now = 1_700_000_000_000;
    const step = Math.floor(now / 30_000);
    const code = totpAt(RFC_SECRET, step);
    expect(verifyTotp(RFC_SECRET, code, null, now)).toEqual({ ok: true, step });
    expect(verifyTotp(RFC_SECRET, totpAt(RFC_SECRET, step - 1), null, now).ok).toBe(true);
    expect(verifyTotp(RFC_SECRET, totpAt(RFC_SECRET, step - 3), null, now).ok).toBe(false);
    expect(verifyTotp(RFC_SECRET, code, step, now).ok).toBe(false); // ya usado
    expect(verifyTotp(RFC_SECRET, "12345", null, now).ok).toBe(false);
  });
  it("URI para la app y códigos de recuperación", () => {
    expect(otpauthUri("VANTA Panel", "admin@x.co", "ABC")).toBe("otpauth://totp/VANTA%20Panel%3Aadmin%40x.co?secret=ABC&issuer=VANTA%20Panel&algorithm=SHA1&digits=6&period=30");
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    codes.forEach((c) => expect(c).toMatch(/^[2-9A-Z]{4}-[2-9A-Z]{4}$/));
    expect(normalizeRecovery("abcd-efgh")).toBe("ABCDEFGH");
  });
});
