import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { toCsv } = await import("@/lib/csv");
const { openText, sealText } = await import("@/lib/secure-box");
const { chatState, cleanBody, CHAT_MAX_LEN } = await import("@/server/chat");

describe("exportación CSV", () => {
  it("usa BOM, punto y coma y comillas cuando hace falta", () => {
    const csv = toCsv(["A", "B"], [["hola; mundo", 'dice "sí"']]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain('"hola; mundo";"dice ""sí"""');
  });
  it("neutraliza fórmulas (inyección CSV) pero no números negativos", () => {
    const csv = toCsv(["x"], [["=HYPERLINK(\"http://x\")"], ["+57 300"], ["@SUM(A1)"], [-1500]]);
    const lines = csv.slice(1).split("\r\n");
    expect(lines[1].startsWith("\"'=HYPERLINK")).toBe(true);
    expect(lines[2]).toBe("'+57 300");
    expect(lines[3]).toBe("'@SUM(A1)");
    expect(lines[4]).toBe("-1500");
  });
});

describe("cifrado del chat", () => {
  it("cifra y descifra; cada cifrado es distinto", () => {
    const a = sealText("Contraseña: Demo-1234");
    const b = sealText("Contraseña: Demo-1234");
    expect(a).not.toBe(b);
    expect(a).not.toContain("Demo-1234");
    expect(openText(a)).toBe("Contraseña: Demo-1234");
  });
  it("rechaza texto alterado", () => {
    const sealed = sealText("secreto");
    const parts = sealed.split(".");
    // Se cambia un carácter del medio: el último del base64 puede llevar solo bits de relleno.
    const i = Math.floor(parts[3].length / 2);
    parts[3] = parts[3].slice(0, i) + (parts[3][i] === "A" ? "B" : "A") + parts[3].slice(i + 1);
    expect(openText(parts.join("."))).toBeNull();
    expect(openText("basura")).toBeNull();
  });
});

describe("reglas del chat", () => {
  it("limpia caracteres de control y respeta el límite", () => {
    expect(cleanBody("  hola\u0000\u0007 mundo \r\n ")).toBe("hola mundo");
    expect(cleanBody("")).toBeNull();
    expect(cleanBody(42)).toBeNull();
    expect(cleanBody("x".repeat(CHAT_MAX_LEN + 1))).toBeNull();
  });
  it("solo existe en cuentas pagadas y se cierra al cancelar o 7 días después de entregar", () => {
    const now = new Date("2026-10-10T12:00:00Z");
    expect(chatState({ type: "TOPUP", status: "PROCESSING", deliveredAt: null }, now)).toBe("hidden");
    expect(chatState({ type: "ACCOUNT", status: "PENDING_PAYMENT", deliveredAt: null }, now)).toBe("hidden");
    expect(chatState({ type: "ACCOUNT", status: "PROCESSING", deliveredAt: null }, now)).toBe("open");
    expect(chatState({ type: "ACCOUNT", status: "DELIVERED", deliveredAt: new Date("2026-10-05T12:00:00Z") }, now)).toBe("open");
    expect(chatState({ type: "ACCOUNT", status: "DELIVERED", deliveredAt: new Date("2026-10-01T12:00:00Z") }, now)).toBe("closed");
    expect(chatState({ type: "ACCOUNT", status: "REFUNDED", deliveredAt: null }, now)).toBe("closed");
  });
});

describe("IP del cliente para límites anti-abuso", () => {
  it("usa el último valor de X-Forwarded-For (el que agrega el proxy)", async () => {
    const { ipFromHeaders } = await import("@/lib/request");
    expect(ipFromHeaders(new Headers({ "x-forwarded-for": "1.2.3.4, 203.0.113.9" }))).toBe("203.0.113.9");
    expect(ipFromHeaders(new Headers({ "x-forwarded-for": "198.51.100.7" }))).toBe("198.51.100.7");
    expect(ipFromHeaders(new Headers({ "x-real-ip": "192.0.2.1" }))).toBe("192.0.2.1");
    expect(ipFromHeaders(new Headers())).toBe("unknown");
  });
});
