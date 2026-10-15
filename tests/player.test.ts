import { describe, expect, it } from "vitest";
import { ACHIEVEMENTS, customerRank, isProfileTheme, profileTheme } from "@/domain/player";

describe("rango de cliente", () => {
  it("empieza en Bronce sin compras", () => {
    const r = customerRank(0);
    expect(r.current.id).toBe("BRONCE");
    expect(r.next?.id).toBe("PLATA");
    expect(r.missing).toBe(30_000);
    expect(r.progress).toBe(0);
  });

  it("sube justo en el mínimo y calcula lo que falta", () => {
    expect(customerRank(29_999).current.id).toBe("BRONCE");
    const r = customerRank(59_220);
    expect(r.current.id).toBe("PLATA");
    expect(r.next?.id).toBe("ORO");
    expect(r.missing).toBe(40_780);
    expect(r.progress).toBeCloseTo(29_220 / 70_000);
  });

  it("Gran Maestro es el tope", () => {
    const r = customerRank(9_000_000);
    expect(r.current.id).toBe("GRAN_MAESTRO");
    expect(r.next).toBeNull();
    expect(r.progress).toBe(1);
    expect(r.missing).toBe(0);
  });
});

describe("portadas y logros", () => {
  it("valida la portada y cae en la primera si no existe", () => {
    expect(isProfileTheme("fuego")).toBe(true);
    expect(isProfileTheme("<script>")).toBe(false);
    expect(profileTheme("nada").key).toBe("neon");
  });

  it("los logros dependen solo de datos reales", () => {
    const base = { verified: false, deliveredTopups: 0, diamonds: 0, accountsBought: 0, purchases: 0, biggestOrder: 0, profileComplete: false };
    expect(ACHIEVEMENTS.filter((a) => a.test(base)).map((a) => a.key)).toEqual(["bienvenida"]);
    const full = { verified: true, deliveredTopups: 3, diamonds: 6000, accountsBought: 1, purchases: 5, biggestOrder: 150_000, profileComplete: true };
    expect(ACHIEVEMENTS.every((a) => a.test(full))).toBe(true);
  });
});
