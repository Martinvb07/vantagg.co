/**
 * Pasa el SVG de una portada de sección a PNG (960 × 1044) con la letra Sora de la tienda.
 *   python3 scripts/portada-seccion.py diamantes > /tmp/portada.svg
 *   node scripts/portada-seccion.cjs /tmp/portada.svg /tmp/portada.png
 * Luego se pasa a .webp (960, 720 y 256 px de ancho) con Pillow.
 */
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

(async () => {
  const [svgPath, pngPath] = process.argv.slice(2);
  const font = path.resolve(__dirname, "../src/fonts/sora-latin-wght-normal.woff2");
  const html = `<!doctype html><html><head><style>
    @font-face { font-family: "Sora"; src: url("file://${font}") format("woff2"); font-weight: 100 800; }
    html, body { margin: 0; background: #000; }
  </style></head><body>${fs.readFileSync(svgPath, "utf8")}</body></html>`;
  const tmp = path.join(path.dirname(pngPath), "portada-seccion.html");
  fs.writeFileSync(tmp, html);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 960, height: 1044 }, deviceScaleFactor: 1 });
  await p.goto(`file://${tmp}`);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(200);
  await p.locator("svg").screenshot({ path: pngPath });
  await b.close();
})();
