import { describe, expect, it } from "vitest";
import { googleTagConfig, googleTagInitScript, parseConversionLabel, parseGoogleTagIds } from "@/domain/google-tag";

describe("Etiqueta de Google (Google Ads / Analytics)", () => {
  it("acepta solo IDs válidos y los normaliza", () => {
    expect(parseGoogleTagIds("AW-123456789")).toEqual(["AW-123456789"]);
    expect(parseGoogleTagIds(" aw-123456789 , G-ABC123XYZ ")).toEqual(["AW-123456789", "G-ABC123XYZ"]);
    expect(parseGoogleTagIds("AW-123456789, AW-123456789")).toEqual(["AW-123456789"]);
    expect(parseGoogleTagIds("")).toEqual([]);
  });

  it("rechaza código pegado en lugar del ID (no se puede inyectar nada en la página)", () => {
    expect(parseGoogleTagIds('<script src="https://www.googletagmanager.com/gtag/js?id=AW-1"></script>')).toEqual([]);
    expect(parseGoogleTagIds('AW-1");alert(1);//')).toEqual([]);
    expect(parseConversionLabel("AW-123456789/abc');alert(1)//")).toBeNull();
    expect(parseConversionLabel("gtag('event','conversion',{'send_to':'AW-123456789/AbCdEf'})")).toBeNull();
  });

  it("conversión de compra: AW-número/etiqueta; trae su ID de Google Ads", () => {
    expect(parseConversionLabel("AW-123456789/AbC-dEf_123")).toBe("AW-123456789/AbC-dEf_123");
    expect(parseConversionLabel("aw-123456789/AbCdEf")).toBe("AW-123456789/AbCdEf");
    expect(googleTagConfig({ googleTagId: "", googleAdsPurchase: "AW-123456789/AbCdEf" })).toEqual({ ids: ["AW-123456789"], purchase: "AW-123456789/AbCdEf" });
    expect(googleTagConfig({ googleTagId: "G-ABC123XYZ", googleAdsPurchase: "AW-123456789/AbCdEf" })).toEqual({ ids: ["AW-123456789", "G-ABC123XYZ"], purchase: "AW-123456789/AbCdEf" });
    expect(googleTagConfig({ googleTagId: "", googleAdsPurchase: "" })).toBeNull();
  });

  it("el script inicial deniega cookies por defecto (modo de consentimiento) y configura cada ID", () => {
    const js = googleTagInitScript({ ids: ["AW-123456789", "G-ABC123XYZ"], purchase: null });
    expect(js).toContain('gtag("consent","default"');
    expect(js).toMatch(/c==="granted"\?"granted":"denied"/);
    expect(js).toContain('["AW-123456789","G-ABC123XYZ"]');
    expect(() => new Function(js)).not.toThrow(); // JavaScript válido
  });
});
