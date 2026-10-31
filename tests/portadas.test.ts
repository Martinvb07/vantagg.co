/**
 * Las portadas de los paquetes se sirven como archivos (public/portadas). Esta prueba los compara con el arte
 * de src/components/brand/cover-art.tsx y falla si alguno quedó desactualizado. Para regenerarlos:
 *   PORTADAS_ACTUALIZAR=1 npx vitest run tests/portadas.test.ts
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { COVER_FILES, CoverSvg, coverFile } from "@/components/brand/cover-art";
import { passKindOf } from "@/domain/packs";

const PUBLIC = path.resolve(__dirname, "..", "public");
const update = process.env.PORTADAS_ACTUALIZAR === "1";

describe("Portadas de los paquetes", () => {
  for (const { art, bare } of COVER_FILES) {
    const file = coverFile(art, bare);
    it(`${file} está al día con el arte`, () => {
      const svg = renderToStaticMarkup(createElement(CoverSvg, { art, bare })) + "\n";
      const target = path.join(PUBLIC, file);
      if (update) {
        mkdirSync(path.dirname(target), { recursive: true });
        writeFileSync(target, svg);
      }
      expect(existsSync(target), `falta ${file}: ejecuta con PORTADAS_ACTUALIZAR=1`).toBe(true);
      expect(readFileSync(target, "utf8"), `${file} desactualizado: ejecuta con PORTADAS_ACTUALIZAR=1`).toBe(svg);
    });
  }
});

describe("Tarjetas y pases del proveedor", () => {
  it("reconoce los nombres reales de Central One y descarta los que no se venden", () => {
    expect(passKindOf("Tarjeta Semanal Básica de Free Fire")).toBe("weekly-lite");
    expect(passKindOf("Tarjeta Semanal BÃ¡sica")).toBe("weekly-lite");
    expect(passKindOf("Tarjeta Semanal de Free Fire")).toBe("weekly");
    expect(passKindOf("Tarjeta Mensual de Free Fire")).toBe("monthly");
    expect(passKindOf("Pase Booyah Premium de Free fire")).toBe("booyah");
    expect(passKindOf("Free Fire (BR) · Pase Booyah Premium Plus")).toBeNull();
    expect(passKindOf("Free Fire 110 Diamantes (100 + 10% de bono) · PIN")).toBeNull();
    expect(passKindOf("Free Fire 110 Diamantes")).toBeNull();
    expect(passKindOf("Free Fire (BR) · Acceso Evo 7 días")).toBeNull();
  });
});
