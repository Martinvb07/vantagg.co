import { describe, expect, it } from "vitest";
import { deliverable, describeDevice } from "@/lib/email-utils";

describe("correos", () => {
  it("no envía a direcciones internas o de prueba", () => {
    expect(deliverable("admin@vanta.local")).toBe(false);
    expect(deliverable("qa@example.com")).toBe(false);
    expect(deliverable("x@foo.test")).toBe(false);
    expect(deliverable("cliente@gmail.com")).toBe(true);
    expect(deliverable("ventas@tienda.com.co")).toBe(true);
    expect(deliverable("ana@localhost.co")).toBe(true);
  });

  it("describe el dispositivo de los avisos de seguridad", () => {
    expect(describeDevice("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36")).toBe("Chrome en Windows");
    expect(describeDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1")).toBe("Safari en iPhone/iPad");
    expect(describeDevice("Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/130.0 Safari/537.36 Edg/130.0")).toBe("Edge en Windows");
    expect(describeDevice(null)).toBe("Desconocido");
  });
});

import { sniffImage } from "@/lib/image-sniff";

describe("imágenes del chat", () => {
  const bytes = (...n: number[]) => new Uint8Array([...n, ...new Array(16).fill(0)]);
  it("reconoce JPEG, PNG y WebP por sus bytes", () => {
    expect(sniffImage(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(sniffImage(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("image/png");
    expect(sniffImage(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 xxxxxxxx"))).toBe("image/webp");
  });
  it("rechaza SVG, HTML y archivos disfrazados", () => {
    expect(sniffImage(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'))).toBeNull();
    expect(sniffImage(new TextEncoder().encode("<!doctype html><html>hola</html>"))).toBeNull();
    expect(sniffImage(new Uint8Array([0xff, 0xd8]))).toBeNull();
  });
});
