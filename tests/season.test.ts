import { afterEach, describe, expect, it, vi } from "vitest";
import { isHalloween } from "@/domain/season";

// Fechas en hora de Colombia (UTC−5).
const co = (iso: string) => new Date(`${iso}-05:00`);

describe("Temporada de Halloween", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("va del 20 de octubre al 2 de noviembre, hora de Colombia", () => {
    vi.stubEnv("SEASON", "");
    expect(isHalloween(co("2026-10-19T23:59:00"))).toBe(false);
    expect(isHalloween(co("2026-10-20T00:00:00"))).toBe(true);
    expect(isHalloween(co("2026-10-31T22:00:00"))).toBe(true);
    expect(isHalloween(co("2026-11-02T23:59:00"))).toBe(true);
    expect(isHalloween(co("2026-11-03T00:00:00"))).toBe(false);
    expect(isHalloween(co("2026-06-15T12:00:00"))).toBe(false);
  });

  it("SEASON en el .env la fuerza a mano", () => {
    vi.stubEnv("SEASON", "off");
    expect(isHalloween(co("2026-10-31T12:00:00"))).toBe(false);
    vi.stubEnv("SEASON", "halloween");
    expect(isHalloween(co("2026-06-15T12:00:00"))).toBe(true);
  });
});
