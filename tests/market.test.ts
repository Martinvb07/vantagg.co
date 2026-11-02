import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }), headers: async () => new Headers() }));

import { currencyForCountry, formatCurrency, localFromUsd, normalizeCountry, regionForCountry, usdPriceCents } from "@/domain/market";
import { countryOfIp } from "@/server/geo";

describe("Precios por país", () => {
  it("precio en dólares: tasa del día + 5 %, hacia arriba y terminado en 9", () => {
    // $3.999 a 3.164 por dólar = US$ 1,264 → +5 % = 1,327 → 1,33 → US$ 1,39
    expect(usdPriceCents(3999, 3164)).toBe(139);
    expect(usdPriceCents(154499, 3164)).toBe(5129); // 48,83 × 1,05 = 51,27 → US$ 51,29
    expect(usdPriceCents(3999, 3164, 0)).toBe(129); // sin recargo
    for (const cop of [999, 3999, 9999, 46999, 154499, 1133999]) {
      const cents = usdPriceCents(cop, 3164);
      expect(cents % 10).toBe(9);
      expect(cents / 100).toBeGreaterThanOrEqual((cop / 3164) * 1.05); // nunca por debajo del precio + recargo
    }
    expect(usdPriceCents(3999, 0)).toBe(0); // sin tasa no se inventa un precio
  });

  it("moneda local de referencia y formato", () => {
    expect(currencyForCountry("mx")).toBe("MXN");
    expect(currencyForCountry("EC")).toBe("USD");
    expect(currencyForCountry("ES")).toBe("EUR");
    expect(currencyForCountry("JP")).toBe("USD"); // otros países: dólares
    expect(formatCurrency(1.39, "USD")).toBe("US$ 1,39");
    expect(formatCurrency(localFromUsd(139, 18.4), "MXN")).toBe("MXN 25,58");
    expect(formatCurrency(5600, "CLP")).toBe("CLP 5.600");
  });

  it("región de Free Fire según el país, solo si la tienda la vende", () => {
    const all = ["latam", "brazil", "eu", "id", "global"];
    expect(regionForCountry("CO", all)).toBe("latam");
    expect(regionForCountry("BR", all)).toBe("brazil");
    expect(regionForCountry("ES", all)).toBe("eu");
    expect(regionForCountry("ID", all)).toBe("id");
    expect(regionForCountry("US", all)).toBe("global");
    expect(regionForCountry("BR", ["latam"])).toBeNull(); // no se vende Brasil: queda la principal
    expect(regionForCountry(null, all)).toBeNull();
  });

  it("país: solo dos letras; IP privada o sin base de países → sin detectar (todo en pesos)", () => {
    expect(normalizeCountry(" mx ")).toBe("MX");
    expect(normalizeCountry("Mexico")).toBeNull();
    expect(countryOfIp("192.168.1.10")).toBeNull();
    expect(countryOfIp("unknown")).toBeNull();
    expect(countryOfIp("8.8.8.8")).toBeNull(); // en pruebas no hay base descargada
  });
});
