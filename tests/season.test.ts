/**
 * Temporadas (Halloween sola por fecha, Navidad a mano en Ajustes) y banners de eventos con fecha de inicio y fin.
 *   npx vitest run tests/season.test.ts
 */
import { afterEach, describe, expect, it } from "vitest";
import { christmasMessage, christmasOver, currentSeason, isHalloween, seasonBanner } from "@/domain/season";
import { activeEventBanners, type EventBanner } from "@/content/event-banners";

// Mediodía en Colombia (UTC−5) del día indicado.
const co = (ymd: string) => new Date(`${ymd}T17:00:00Z`);

describe("temporada", () => {
  const env = process.env.SEASON;
  afterEach(() => {
    if (env === undefined) delete process.env.SEASON;
    else process.env.SEASON = env;
  });

  it("Navidad solo si se elige en Ajustes; «Normal» vuelve al diseño de siempre", () => {
    delete process.env.SEASON;
    expect(currentSeason("navidad", co("2026-12-10"))).toBe("navidad");
    expect(currentSeason("", co("2026-12-10"))).toBeNull();
    expect(currentSeason(undefined, co("2027-01-20"))).toBeNull();
    expect(currentSeason("navidad", co("2026-11-17"))).toBe("navidad"); // se puede encender antes de diciembre
  });

  it("el 1 de enero vuelve sola al diseño normal (hora de Colombia)", () => {
    delete process.env.SEASON;
    expect(currentSeason("navidad", new Date("2027-01-01T04:59:00Z"))).toBe("navidad"); // 31 de dic., 11:59 p. m.
    expect(currentSeason("navidad", new Date("2027-01-01T05:00:00Z"))).toBeNull(); // 1 de enero, medianoche
    expect(currentSeason("navidad", co("2027-02-14"))).toBeNull();
    expect(currentSeason("navidad", co("2027-09-20"))).toBe("navidad"); // se puede encender desde septiembre
    expect(christmasOver(co("2026-12-31"))).toBe(false);
    expect(christmasOver(co("2027-01-01"))).toBe(true);
    expect(christmasOver(co("2027-08-31"))).toBe(true);
  });

  it("Halloween sigue sola por fecha (si Navidad no está encendida)", () => {
    delete process.env.SEASON;
    expect(currentSeason("", co("2026-10-31"))).toBe("halloween");
    expect(currentSeason("navidad", co("2026-10-31"))).toBe("navidad");
    expect(isHalloween(co("2026-11-05"))).toBe(false);
  });

  it("SEASON en el .env manda sobre todo", () => {
    process.env.SEASON = "off";
    expect(currentSeason("navidad", co("2026-12-10"))).toBeNull();
    process.env.SEASON = "navidad";
    expect(currentSeason("", co("2026-07-01"))).toBe("navidad");
    expect(isHalloween(co("2026-10-31"))).toBe(false);
  });

  it("banner de temporada de primero con su imagen de computador y de celular", () => {
    expect(seasonBanner("navidad")).toMatchObject({ id: "temporada-navidad", imageUrl: "/promo/hero-navidad.svg", imageMobileUrl: "/promo/m/hero-navidad.svg", href: "/recargas" });
    expect(seasonBanner("halloween")?.id).toBe("temporada-halloween");
    expect(seasonBanner(null)).toBeNull();
  });
});

describe("barra navideña", () => {
  it("cuenta los días a Navidad y saluda en las fechas colombianas", () => {
    expect(christmasMessage(co("2026-11-17"))).toBe("Faltan 38 días para Navidad");
    expect(christmasMessage(co("2026-12-07"))).toBe("¡Feliz Noche de Velitas!");
    expect(christmasMessage(co("2026-12-16"))).toBe("Novena de Aguinaldos · faltan 9 días para Navidad");
    expect(christmasMessage(co("2026-12-23"))).toBe("Novena de Aguinaldos · faltan 2 días para Navidad");
    expect(christmasMessage(co("2026-12-24"))).toBe("¡Hoy es Nochebuena!");
    expect(christmasMessage(co("2026-12-25"))).toBe("¡Feliz Navidad!");
    expect(christmasMessage(co("2026-12-28"))).toBe("¡Feliz fin de año!");
    expect(christmasMessage(co("2027-01-03"))).toBe("¡Feliz Año Nuevo!");
    expect(christmasMessage(co("2027-01-20"))).toBe("Faltan 339 días para Navidad");
    // 24 de diciembre a las 10 p. m. en Colombia (ya 25 en UTC): todavía es Nochebuena.
    expect(christmasMessage(new Date("2026-12-25T03:00:00Z"))).toBe("¡Hoy es Nochebuena!");
  });
});

describe("banners de eventos de Free Fire", () => {
  const list: EventBanner[] = [
    { id: "recarga-acumulada", title: "Recarga acumulada", imageUrl: "/promo/eventos/a.svg", imageMobileUrl: "/promo/eventos/m/a.svg", href: "/recargas", from: "2026-11-20", to: "2026-11-26" },
    { id: "otro", title: "Otro", imageUrl: "/promo/eventos/b.svg", imageMobileUrl: "/promo/eventos/m/b.svg", href: "/recargas", from: "2026-12-01", to: "2026-12-07" },
  ];

  it("sale solo entre su inicio y su fin (hora de Colombia, ambos incluidos) y se apaga solo", () => {
    expect(activeEventBanners(co("2026-11-19"), list)).toEqual([]);
    expect(activeEventBanners(co("2026-11-20"), list).map((b) => b.id)).toEqual(["recarga-acumulada"]);
    expect(activeEventBanners(co("2026-11-26"), list).map((b) => b.id)).toEqual(["recarga-acumulada"]);
    // 26 de noviembre a las 11 p. m. en Colombia (ya 27 en UTC): sigue.
    expect(activeEventBanners(new Date("2026-11-27T04:00:00Z"), list).map((b) => b.id)).toEqual(["recarga-acumulada"]);
    expect(activeEventBanners(co("2026-11-27"), list)).toEqual([]);
    expect(activeEventBanners(co("2026-12-03"), list)[0]).toEqual({ id: "otro", title: "Otro", imageUrl: "/promo/eventos/b.svg", imageMobileUrl: "/promo/eventos/m/b.svg", href: "/recargas" });
  });
});
