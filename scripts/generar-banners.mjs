// Genera los banners de public/promo con la identidad de VANTAGG (fondo negro verdoso, V verde lima,
// diamantes azules y objetos negros con bordes lima). Uso: node scripts/generar-banners.mjs
// Los archivos conservan su nombre, así que los banners guardados en la base no cambian.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "promo");
const LIME = "#b9f43c";
const LIME2 = "#dcff7a";
const INK = "#030504";
const HEAD = "Arial Black, Arial, Helvetica, sans-serif";
const BODY = "Arial, Helvetica, sans-serif";
const NEQUI = "#ff2d9b";

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// ---------------------------------------------------------------- piezas de dibujo (coordenadas locales)

const ICE = ["#e3f9ff", "#98e1ff", "#52bbff", "#2d84f0", "#1a52c4", "#06183f"];
const GOLD = ["#fff7d1", "#ffe37d", "#ffc63a", "#ee9c18", "#bd6b0b", "#3b2203"];

function gem(cx, y0, w, tilt = 0, gold = false) {
  const c = gold ? GOLD : ICE;
  const h = w * 0.86;
  const y1 = y0 + h * 0.3;
  const tip = y0 + h;
  const [t1, t2] = [cx - w * 0.27, cx + w * 0.27];
  const [gl, g1, g2, gr] = [cx - w / 2, cx - w / 6, cx + w / 6, cx + w / 2];
  const sw = Math.max(1.6, Math.min(3, w * 0.05));
  return `<g transform="rotate(${tilt} ${cx} ${y0 + h / 2})" stroke-linejoin="round">
<path d="M${t1} ${y0}L${gl} ${y1}L${g1} ${y1}Z" fill="${c[2]}"/><path d="M${t1} ${y0}L${cx} ${y0}L${g1} ${y1}Z" fill="${c[0]}"/>
<path d="M${cx} ${y0}L${g1} ${y1}L${g2} ${y1}Z" fill="${c[1]}"/><path d="M${cx} ${y0}L${t2} ${y0}L${g2} ${y1}Z" fill="${c[2]}"/>
<path d="M${t2} ${y0}L${gr} ${y1}L${g2} ${y1}Z" fill="${c[3]}"/><path d="M${gl} ${y1}L${g1} ${y1}L${cx} ${tip}Z" fill="${c[2]}"/>
<path d="M${g1} ${y1}L${g2} ${y1}L${cx} ${tip}Z" fill="${c[3]}"/><path d="M${g2} ${y1}L${gr} ${y1}L${cx} ${tip}Z" fill="${c[4]}"/>
<path d="M${t1 + w * 0.06} ${y0 + h * 0.05}L${cx - w * 0.06} ${y0 + h * 0.05}L${g1 - w * 0.03} ${y1 - h * 0.05}Z" fill="#fff" opacity=".7"/>
<path d="M${gl + w * 0.12} ${y1 + h * 0.05}L${g1 - w * 0.02} ${y1 + h * 0.05}L${cx - w * 0.05} ${tip - h * 0.22}Z" fill="#fff" opacity=".25"/>
<path d="M${t1} ${y0}H${t2}L${gr} ${y1}L${cx} ${tip}L${gl} ${y1}Z" fill="none" stroke="${c[5]}" stroke-width="${sw}"/></g>`;
}
const gems = (list) => list.map((g) => gem(...g)).join("");

function vmark(x, y, s = 1) {
  const d = "M-10 -8H-4.2L0 1.6L4.2 -8H10L1.8 8.6H-1.8Z";
  return `<g transform="translate(${x} ${y}) scale(${s})"><path d="${d}" fill="${LIME}" filter="url(#soft)" opacity=".8"/><path d="${d}" fill="${LIME}" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/></g>`;
}

const ringBack = (cx, cy, rx, ry) => `<path d="M${cx - rx} ${cy}A${rx} ${ry} 0 0 1 ${cx + rx} ${cy}" fill="none" stroke="${LIME}" stroke-opacity=".45" stroke-width="2"/>`;
function ringFront(cx, cy, rx, ry) {
  const arc = `M${cx - rx} ${cy}A${rx} ${ry} 0 0 0 ${cx + rx} ${cy}`;
  return `<path d="${arc}" fill="none" stroke="${LIME}" stroke-width="7" filter="url(#soft)" opacity=".75"/>
<path d="${arc}" fill="none" stroke="${LIME2}" stroke-width="2.6" stroke-linecap="round"/>
<path d="M${cx - rx - 16} ${cy - 12}Q${cx - rx - 4} ${cy + ry + 4} ${cx - rx * 0.2} ${cy + ry + 3}Q${cx - rx + 2} ${cy + ry - 2} ${cx - rx - 16} ${cy - 12}Z" fill="${LIME}" opacity=".9"/>
<path d="M${cx + rx + 14} ${cy - 16}Q${cx + rx + 6} ${cy + ry - 2} ${cx + rx * 0.35} ${cy + ry + 1}Q${cx + rx - 2} ${cy + ry - 5} ${cx + rx + 14} ${cy - 16}Z" fill="${LIME}" opacity=".75"/>`;
}

const spark = (x, y, s = 1) => `<use href="#spark" transform="translate(${x} ${y}) scale(${s})" opacity=".9"/>`;

// Ilustraciones: centradas en (0,0), ~200 unidades de alto.

const chest = () => `${ringBack(0, 48, 68, 13)}
<path d="M-48 -10L48 -10L56 -48Q4 -60 -40 -48Z" fill="url(#lid)" stroke="${INK}" stroke-width="2.8" stroke-linejoin="round"/>
<path d="M-42 -14L42 -14L49 -44Q4 -54 -35 -44Z" fill="none" stroke="${LIME}" stroke-width="2.2" stroke-linejoin="round"/>
${vmark(4, -30, 1)}
<path d="M-56 -2L-46 -10H48L56 -2Z" fill="#050706" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>
<circle cx="0" cy="-14" r="46" fill="url(#gemglow)"/>
${gems([[-36, -18, 26, -24], [38, -20, 28, 22], [-16, -26, 32, -10], [18, -28, 34, 12], [1, -34, 40], [56, -10, 18, 30], [-54, -8, 16, -30]])}
<rect x="-56" y="-2" width="112" height="50" rx="6" fill="url(#dark)" stroke="${INK}" stroke-width="3"/>
<path d="M-56 3H56" stroke="${LIME}" stroke-width="2.6"/><path d="M-38 4V46M38 4V46" stroke="${LIME}" stroke-opacity=".85" stroke-width="2.2"/>
<path d="M-54 42H54" stroke="${LIME}" stroke-opacity=".4" stroke-width="1.6"/>
${vmark(0, 24, 1.6)}
${gems([[-72, -40, 15, -18], [72, -34, 13, 16]])}
${ringFront(0, 48, 68, 13)}`;

const ticket = () => `<g transform="rotate(-9)">
<path d="M-110 -52H110V-16A16 16 0 0 0 110 16V52H-110V16A16 16 0 0 0 -110 -16Z" fill="url(#dark)" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
<path d="M-101 -43H101V-22A24 24 0 0 0 101 22V43H-101V22A24 24 0 0 0 -101 -22Z" fill="none" stroke="${LIME}" stroke-width="2.6"/>
<path d="M-48 -40V40" stroke="${LIME}" stroke-width="2.4" stroke-dasharray="6 6"/>
<text x="-79" y="16" font-family="${HEAD}" font-weight="900" font-size="46" fill="${LIME}" text-anchor="middle">%</text>
<text x="30" y="6" font-family="${HEAD}" font-weight="900" font-size="25" fill="#fff" text-anchor="middle">CÓDIGO</text>
<text x="30" y="27" font-family="${BODY}" font-weight="700" font-size="10.5" fill="${LIME}" text-anchor="middle" letter-spacing="1">APLÍCALO AL PAGAR</text>
</g>${gems([[-120, -86, 22, -18], [116, 54, 20, 16]])}${spark(100, -74, 1.4)}${spark(-112, 70, 1)}`;

const phone = () => `${ringBack(0, 92, 74, 14)}
<g transform="rotate(8)">
<rect x="-56" y="-100" width="112" height="196" rx="20" fill="url(#dark)" stroke="${INK}" stroke-width="4"/>
<rect x="-48" y="-88" width="96" height="172" rx="12" fill="#070a08" stroke="${LIME}" stroke-width="2"/>
<rect x="-14" y="-96" width="28" height="5" rx="2.5" fill="#000"/>
<text x="-34" y="-58" font-family="${BODY}" font-weight="900" font-size="20" fill="${NEQUI}">nequi</text>
<circle cx="0" cy="-2" r="30" fill="${LIME}" filter="url(#soft)" opacity=".7"/>
<circle cx="0" cy="-2" r="28" fill="${LIME}" stroke="${INK}" stroke-width="2"/>
<path d="M-13 -2L-3 9L15 -12" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
<text x="0" y="52" font-family="${HEAD}" font-weight="900" font-size="15" fill="#fff" text-anchor="middle" letter-spacing="1">PAGO LISTO</text>
</g>${gems([[-86, -70, 24, -18], [88, 18, 20, 16], [-80, 40, 14, -10]])}
${ringFront(0, 92, 74, 14)}`;

const shield = () => `${ringBack(0, 86, 70, 13)}
<path d="M0 -96L72 -70V-6C72 44 38 76 0 92C-38 76 -72 44 -72 -6V-70Z" fill="url(#dark)" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
<path d="M0 -82L60 -61V-6C60 36 32 64 0 78C-32 64 -60 36 -60 -6V-61Z" fill="none" stroke="${LIME}" stroke-width="3" stroke-linejoin="round"/>
<path d="M-28 -2L-8 18L30 -24" fill="none" stroke="${LIME}" stroke-width="16" stroke-linecap="round" stroke-linejoin="round" filter="url(#soft)" opacity=".6"/>
<path d="M-28 -2L-8 18L30 -24" fill="none" stroke="${LIME}" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>
${gems([[-92, -60, 24, -18], [90, -30, 22, 16], [78, 40, 14, 10]])}
${ringFront(0, 86, 70, 13)}`;

const refund = () => `<circle cx="0" cy="0" r="88" fill="${LIME}" opacity=".12" filter="url(#soft)"/>
<path d="M-62 -40A74 74 0 1 1 -70 24" fill="none" stroke="${LIME}" stroke-width="14" stroke-linecap="round" filter="url(#soft)" opacity=".6"/>
<path d="M-62 -40A74 74 0 1 1 -70 24" fill="none" stroke="${LIME}" stroke-width="12" stroke-linecap="round"/>
<path d="M-88 -62L-58 -38L-90 -20Z" fill="${LIME}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
<circle cx="0" cy="0" r="52" fill="url(#dark)" stroke="${INK}" stroke-width="4"/>
<circle cx="0" cy="0" r="44" fill="none" stroke="${LIME}" stroke-width="2.4"/>
<text x="0" y="24" font-family="${HEAD}" font-weight="900" font-size="66" fill="#fff" text-anchor="middle">$</text>
${gems([[86, -84, 22, 16], [-96, 52, 18, -14]])}${spark(84, 70, 1.3)}`;

const lock = () => `${ringBack(0, 92, 74, 14)}
<path d="M-38 -24V-52A38 38 0 0 1 38 -52V-24" fill="none" stroke="${INK}" stroke-width="22"/>
<path d="M-38 -24V-52A38 38 0 0 1 38 -52V-24" fill="none" stroke="#3a443e" stroke-width="16"/>
<path d="M-38 -24V-52A38 38 0 0 1 38 -52V-24" fill="none" stroke="${LIME}" stroke-width="3" stroke-opacity=".7"/>
<rect x="-66" y="-28" width="132" height="112" rx="16" fill="url(#dark)" stroke="${INK}" stroke-width="4"/>
<rect x="-56" y="-18" width="112" height="92" rx="10" fill="none" stroke="${LIME}" stroke-width="2.6"/>
<text x="0" y="44" font-family="${HEAD}" font-weight="900" font-size="46" fill="${LIME}" text-anchor="middle">ID</text>
<g transform="translate(-112 -78) rotate(-8)"><rect x="0" y="0" width="96" height="30" rx="8" fill="#0b0f0c" stroke="#3a443e" stroke-width="2"/>
<text x="48" y="21" font-family="${BODY}" font-weight="900" font-size="16" fill="#8a948e" text-anchor="middle" letter-spacing="2">••••••</text>
<path d="M4 26L92 4" stroke="#ff4d6d" stroke-width="4" stroke-linecap="round"/></g>
${gems([[96, -40, 22, 16], [-96, 36, 16, -14]])}
${ringFront(0, 92, 74, 14)}`;

const cardsAccounts = () => {
  const card = (x, y, r, rank, lvl, color) => `<g transform="translate(${x} ${y}) rotate(${r})">
<rect x="-52" y="-66" width="104" height="132" rx="12" fill="url(#dark)" stroke="${INK}" stroke-width="3"/>
<rect x="-46" y="-60" width="92" height="120" rx="8" fill="none" stroke="${LIME}" stroke-opacity=".55" stroke-width="1.6"/>
<path d="M0 -50L16 -40V-22C16 -12 8 -6 0 -2C-8 -6 -16 -12 -16 -22V-40Z" fill="${color}" stroke="${INK}" stroke-width="2"/>
<text x="0" y="16" font-family="${HEAD}" font-weight="900" font-size="13" fill="#fff" text-anchor="middle">${rank}</text>
<text x="0" y="33" font-family="${BODY}" font-weight="700" font-size="11" fill="#9aa59e" text-anchor="middle">${lvl}</text>
<rect x="-36" y="40" width="72" height="18" rx="9" fill="${LIME}"/><text x="0" y="53" font-family="${HEAD}" font-weight="900" font-size="9.5" fill="${INK}" text-anchor="middle" letter-spacing="1">COMPRAR</text></g>`;
  return `${card(-92, 14, -10, "Diamante", "Nivel 42", "#7b8cff")}${card(92, 10, 10, "Heroico", "Nivel 68", "#ff5f6d")}${card(0, -6, 0, "Gran Maestro", "Nivel 74", "#ffb547")}${gems([[-140, -70, 18, -16], [138, -66, 16, 14]])}`;
};

const filterPanel = () => {
  const rows = [["Gran Maestro", "#ffb547", true], ["Heroico", "#ff5f6d", true], ["Diamante", "#7b8cff", false], ["Platino", "#9fd8ff", false]];
  return `<rect x="-100" y="-96" width="200" height="192" rx="16" fill="url(#dark)" stroke="${INK}" stroke-width="4"/>
<rect x="-92" y="-88" width="184" height="176" rx="10" fill="none" stroke="${LIME}" stroke-width="2" stroke-opacity=".7"/>
<text x="-74" y="-60" font-family="${HEAD}" font-weight="900" font-size="15" fill="${LIME}" letter-spacing="2">RANGO</text>
${rows
  .map(([n, c, on], i) => {
    const y = -34 + i * 36;
    return `<path d="M-74 ${y - 9}L-64 ${y - 4}V${y + 4}C-64 ${y + 9} -69 ${y + 12} -74 ${y + 14}C-79 ${y + 12} -84 ${y + 9} -84 ${y + 4}V${y - 4}Z" fill="${c}" stroke="${INK}" stroke-width="1.6"/>
<text x="-54" y="${y + 6}" font-family="${BODY}" font-weight="700" font-size="15" fill="#fff">${n}</text>
<rect x="56" y="${y - 9}" width="20" height="20" rx="5" fill="${on ? LIME : "none"}" stroke="${on ? INK : "#4a5550"}" stroke-width="2"/>${on ? `<path d="M60 ${y + 1}L65 ${y + 6}L72 ${y - 3}" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>` : ""}`;
  })
  .join("")}${gems([[118, -100, 20, 14], [-122, 66, 16, -12]])}`;
};

const orderCard = () => `<rect x="-150" y="-70" width="300" height="140" rx="16" fill="url(#dark)" stroke="${INK}" stroke-width="4"/>
<rect x="-142" y="-62" width="284" height="124" rx="10" fill="none" stroke="${LIME}" stroke-opacity=".6" stroke-width="2"/>
<text x="-124" y="-34" font-family="${BODY}" font-weight="700" font-size="12" fill="#9aa59e" letter-spacing="2">PEDIDO</text>
<text x="-124" y="-8" font-family="Courier New, monospace" font-weight="700" font-size="22" fill="#fff">VX-7K2M-9QHT</text>
<rect x="44" y="-44" width="86" height="22" rx="11" fill="${LIME}"/><text x="87" y="-29" font-family="${HEAD}" font-weight="900" font-size="10" fill="${INK}" text-anchor="middle" letter-spacing="1">ENTREGADO</text>
${[0, 1, 2, 3].map((i) => `<rect x="${-124 + i * 64}" y="16" width="56" height="7" rx="3.5" fill="${LIME}"/>`).join("")}
${["Creado", "Pagado", "Entregando", "Entregado"].map((t, i) => `<text x="${-124 + i * 64}" y="44" font-family="${BODY}" font-weight="700" font-size="11" fill="#9aa59e">${t}</text>`).join("")}
${gems([[150, -96, 22, 16], [-160, 62, 16, -12]])}`;

const chat = () => `<g transform="translate(-30 -40)"><rect x="-110" y="-30" width="210" height="60" rx="16" fill="url(#dark)" stroke="${INK}" stroke-width="3"/>
<rect x="-104" y="-24" width="198" height="48" rx="12" fill="none" stroke="#3a443e" stroke-width="1.6"/>
<text x="-90" y="-2" font-family="${BODY}" font-weight="700" font-size="15" fill="#fff">Pagué con PSE, ¿ya llegó?</text>
<text x="-90" y="16" font-family="Courier New, monospace" font-weight="700" font-size="12" fill="#9aa59e">VX-7K2M-9QHT</text></g>
<g transform="translate(40 44)"><rect x="-110" y="-30" width="210" height="60" rx="16" fill="${LIME}" stroke="${INK}" stroke-width="3"/>
<text x="-94" y="-2" font-family="${BODY}" font-weight="900" font-size="15" fill="${INK}">¡Sí! Ya está entregado ✓✓</text>
<text x="-94" y="16" font-family="${BODY}" font-weight="700" font-size="12" fill="#2b3a14">Soporte · ahora</text></g>
${gems([[126, -92, 20, 16], [-150, 60, 16, -12]])}`;

function payChips(x, y, s = 1) {
  const chip = (cx, label, icon) => `<g transform="translate(${cx} 0)"><rect x="-58" y="-46" width="116" height="92" rx="14" fill="url(#dark)" stroke="${INK}" stroke-width="3"/>
<rect x="-52" y="-40" width="104" height="80" rx="10" fill="none" stroke="${LIME}" stroke-opacity=".7" stroke-width="2"/>${icon}
<text x="0" y="34" font-family="${HEAD}" font-weight="900" font-size="13" fill="#fff" text-anchor="middle" letter-spacing="1">${label}</text></g>`;
  const nequi = `<text x="0" y="6" font-family="${BODY}" font-weight="900" font-size="26" fill="${NEQUI}" text-anchor="middle">nequi</text>`;
  const pse = `<path d="M-18 -4H18M-14 -4V14M-5 -4V14M5 -4V14M14 -4V14M-20 16H20M0 -22L-20 -8H20Z" stroke="${LIME}" stroke-width="3" fill="none" stroke-linejoin="round"/>`;
  const card = `<rect x="-22" y="-22" width="44" height="30" rx="5" fill="none" stroke="${LIME}" stroke-width="3"/><path d="M-22 -12H22" stroke="${LIME}" stroke-width="5"/>`;
  return `<g transform="translate(${x} ${y}) scale(${s})">${chip(-189, "", nequi.replace('y="6"', 'y="9"').replace('font-size="26"', 'font-size="30"'))}${chip(-63, "PSE", pse)}${chip(63, "DÉBITO", card)}${chip(189, "CRÉDITO", card)}</g>`;
}

function steps(x, y, s = 1, labels = ["Verificamos tu cuenta", "Nequi, PSE o tarjeta", "Directo a tu cuenta"]) {
  const icons = [
    `<path d="M-12 8C-12 -8 12 -8 12 8M-6 12C-6 -2 6 -2 6 12M-18 2C-16 -18 16 -18 18 2M0 4V14" fill="none" stroke="${LIME}" stroke-width="3.4" stroke-linecap="round"/>`,
    `<rect x="-18" y="-12" width="36" height="24" rx="4" fill="none" stroke="${LIME}" stroke-width="3.4"/><path d="M-18 -4H18" stroke="${LIME}" stroke-width="4"/>`,
    gem(0, -14, 34),
  ];
  const titles = ["PON TU ID", "PAGA", "RECIBE"];
  return `<g transform="translate(${x} ${y}) scale(${s})">
<path d="M-110 0H-60M60 0H110" stroke="${LIME}" stroke-width="3" stroke-dasharray="4 7"/>
${[-170, 0, 170]
  .map(
    (cx, i) => `<g transform="translate(${cx} 0)"><circle r="44" fill="${LIME}" opacity=".18" filter="url(#soft)"/><circle r="40" fill="url(#dark)" stroke="${INK}" stroke-width="3"/>
<circle r="34" fill="none" stroke="${LIME}" stroke-width="3"/>${icons[i]}
<circle cx="28" cy="-30" r="13" fill="${LIME}" stroke="${INK}" stroke-width="2"/><text x="28" y="-25" font-family="${HEAD}" font-weight="900" font-size="14" fill="${INK}" text-anchor="middle">${i + 1}</text>
<text y="70" font-family="${HEAD}" font-weight="900" font-size="17" fill="#fff" text-anchor="middle">${titles[i]}</text>
<text y="92" font-family="${BODY}" font-weight="700" font-size="13" fill="#9aa59e" text-anchor="middle">${labels[i]}</text></g>`,
  )
  .join("")}</g>`;
}

// ---------------------------------------------------------------- texto

function tag(x, y, text, size = 22) {
  const w = text.length * size * 0.78 + size * 1.2;
  const h = size * 1.6;
  return `<g transform="translate(${x} ${y})"><path d="M0 0H${w}L${w - size * 0.5} ${h}H0Z" fill="${LIME}"/>
<text x="${size * 0.5}" y="${h * 0.72}" font-family="${HEAD}" font-weight="900" font-style="italic" font-size="${size}" fill="${INK}" letter-spacing="1">${esc(text)}</text></g>`;
}

/** lines: [texto, color ("w" | "l"), tamaño] */
function heading(x, y, lines, gap = 1.02) {
  let yy = y;
  return lines
    .map(([t, c, s], i) => {
      if (i > 0) yy += s * gap;
      const fill = c === "l" ? LIME : "#fff";
      return `<text x="${x}" y="${yy}" font-family="${HEAD}" font-weight="900" font-style="italic" font-size="${s}" fill="${fill}">${esc(t)}</text>`;
    })
    .join("");
}

const sub = (x, y, text, size, anchor = "start") => `<text x="${x}" y="${y}" font-family="${BODY}" font-weight="700" font-size="${size}" fill="#c9d3cc" text-anchor="${anchor}">${esc(text)}</text>`;

function cta(x, y, text, size = 22) {
  const w = text.length * size * 0.74 + size * 2.4;
  const h = size * 2.3;
  return `<g transform="translate(${x} ${y})"><rect width="${w}" height="${h}" rx="${h / 2}" fill="${LIME}" filter="url(#soft)" opacity=".55"/>
<rect width="${w}" height="${h}" rx="${h / 2}" fill="${LIME}" stroke="${INK}" stroke-width="2"/>
<text x="${w / 2}" y="${h * 0.66}" font-family="${HEAD}" font-weight="900" font-size="${size}" fill="${INK}" text-anchor="middle" letter-spacing="1">${esc(text)}</text></g>`;
}

// ---------------------------------------------------------------- lienzo

function svg(w, h, { vx, vy = 0, vs = 1, glowX = 0.75, glowY = 0.5 }, body) {
  const vw = 400 * vs;
  const vh = 330 * vs;
  const v = `M${vx - vw / 2} ${vy - 10}H${vx - vw / 2 + 92 * vs}L${vx} ${vy + vh * 0.62}L${vx + vw / 2 - 92 * vs} ${vy - 10}H${vx + vw / 2}L${vx + 16 * vs} ${vy + vh}H${vx - 16 * vs}Z`;
  const slashes = [
    [w * 0.93, h * 0.12, 1],
    [w * 0.965, h * 0.2, 0.6],
    [w * 0.02, h * 0.82, 0.8],
  ]
    .map(([x, y, k], i) => `<path d="M${x} ${y}L${x + 70 * k} ${y - 56 * k}L${x + 64 * k} ${y - 40 * k}L${x + 6 * k} ${y + 8 * k}Z" fill="${LIME}" opacity="${[0.55, 0.3, 0.4][i]}"/>`)
    .join("");
  const clouds = [0.04, 0.16, 0.86, 0.98].map((p, i) => `<circle cx="${w * p}" cy="${h + 10}" r="${h * [0.22, 0.18, 0.2, 0.24][i]}" fill="#0d200f" opacity=".9"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="0.6" y2="1"><stop offset="0" stop-color="#0c180c"/><stop offset="1" stop-color="#030604"/></linearGradient>
<linearGradient id="v" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${LIME}" stop-opacity=".4"/><stop offset="1" stop-color="${LIME}" stop-opacity=".03"/></linearGradient>
<radialGradient id="glow" cx="${glowX}" cy="${glowY}" r="0.55"><stop offset="0" stop-color="${LIME}" stop-opacity=".24"/><stop offset=".55" stop-color="${LIME}" stop-opacity=".05"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
<radialGradient id="gemglow"><stop offset="0" stop-color="#4fc3ff" stop-opacity=".5"/><stop offset="1" stop-color="#4fc3ff" stop-opacity="0"/></radialGradient>
<linearGradient id="dark" x1="0" y1="0" x2="0.3" y2="1"><stop offset="0" stop-color="#323a36"/><stop offset="1" stop-color="#0c100e"/></linearGradient>
<linearGradient id="lid" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#47524c"/><stop offset="1" stop-color="#1b221e"/></linearGradient>
<filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>
<path id="spark" d="M0 -10L2.2 -2.2L10 0L2.2 2.2L0 10L-2.2 2.2L-10 0L-2.2 -2.2Z" fill="#fff"/>
</defs>
<rect width="${w}" height="${h}" fill="url(#bg)"/>
<path d="${v}" fill="url(#v)"/>
<rect width="${w}" height="${h}" fill="url(#glow)"/>
${slashes}${clouds}
${body}
</svg>
`;
}

const place = (art, x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})">${art}</g>`;

// ---------------------------------------------------------------- banners

const files = {};
const add = (name, content) => (files[name] = content);

// Carrusel principal 1600×480 y su versión de celular 800×600
const HERO = { w: 1600, h: 480 };
const MOB = { w: 800, h: 600 };

add("hero-bonus.svg", svg(HERO.w, HERO.h, { vx: 1250, vs: 1.25, glowX: 0.78 }, `${place(chest(), 1250, 240, 2.9)}${spark(1490, 120, 1.6)}${spark(1020, 110, 1.2)}
${tag(96, 70, "FREE FIRE")}
<text x="90" y="250" font-family="${HEAD}" font-weight="900" font-style="italic" font-size="150" fill="${LIME}">+10%</text>
<text x="96" y="340" font-family="${HEAD}" font-weight="900" font-style="italic" font-size="78" fill="#fff">DE BONUS</text>
${sub(98, 384, "EN TODOS LOS PAQUETES DE DIAMANTES", 24)}
${cta(96, 404, "RECARGA POR ID  →", 20)}`));

add("m/hero-bonus.svg", svg(MOB.w, MOB.h, { vx: 560, vs: 0.9, glowX: 0.7, glowY: 0.32 }, `${place(chest(), 560, 170, 1.75)}${spark(740, 70, 1.2)}
${tag(46, 40, "FREE FIRE", 20)}
<text x="40" y="410" font-family="${HEAD}" font-weight="900" font-style="italic" font-size="124" fill="${LIME}">+10%</text>
<text x="44" y="480" font-family="${HEAD}" font-weight="900" font-style="italic" font-size="62" fill="#fff">DE BONUS</text>
${sub(46, 516, "EN TODOS LOS PAQUETES DE DIAMANTES", 21)}
${cta(44, 532, "RECARGA POR ID  →", 18)}`));

add("hero-codigos.svg", svg(HERO.w, HERO.h, { vx: 1240, vs: 1.25 }, `${place(ticket(), 1240, 240, 2.1)}
${heading(90, 170, [["¿TIENES UN", "w", 66], ["CÓDIGO?", "l", 118]])}
${sub(96, 340, "Escríbelo en el último paso y ve tu descuento antes de pagar", 26)}
${cta(94, 372, "USAR CÓDIGO  →", 20)}`));

add("m/hero-codigos.svg", svg(MOB.w, MOB.h, { vx: 520, vs: 0.85, glowX: 0.65, glowY: 0.3 }, `${place(ticket(), 470, 160, 1.45)}
${heading(40, 360, [["¿TIENES UN", "w", 56], ["CÓDIGO?", "l", 96]])}
${sub(46, 492, "Escríbelo en el último paso y", 22)}${sub(46, 520, "ve tu descuento antes de pagar", 22)}
${cta(44, 536, "USAR CÓDIGO  →", 17)}`));

const nequiWord = (x, y, s) => `<text x="${x}" y="${y}" font-family="${BODY}" font-weight="900" font-size="${s}" fill="${NEQUI}" letter-spacing="-2">nequi</text>`;

add("hero-nequi.svg", svg(HERO.w, HERO.h, { vx: 1270, vs: 1.25 }, `${place(phone(), 1270, 230, 1.85)}
${tag(96, 70, "DIAMANTES FF")}
<text x="90" y="216" font-family="${HEAD}" font-weight="900" font-style="italic" font-size="96" fill="#fff">PAGA CON</text>${nequiWord(92, 326, 116)}
${sub(98, 368, "Apruebas el pago en tu app de Nequi", 24)}
${cta(96, 390, "RECARGAR  →", 20)}`));

add("m/hero-nequi.svg", svg(MOB.w, MOB.h, { vx: 600, vs: 0.85, glowX: 0.75, glowY: 0.32 }, `${place(phone(), 610, 200, 1.3)}
${tag(46, 40, "DIAMANTES FF", 20)}
<text x="40" y="380" font-family="${HEAD}" font-weight="900" font-style="italic" font-size="76" fill="#fff">PAGA CON</text>${nequiWord(42, 470, 104)}
${sub(46, 510, "Apruebas el pago en tu app de Nequi", 22)}
${cta(44, 530, "RECARGAR  →", 17)}`));

add("hero-pagos.svg", svg(HERO.w, HERO.h, { vx: 1330, vs: 1.2, glowX: 0.83 }, `${place(shield(), 1340, 230, 1.75)}
${heading(90, 140, [["PAGA COMO", "w", 82], ["QUIERAS", "l", 82]], 1.0)}
${sub(96, 268, "En pesos colombianos · pago seguro en la pasarela", 24)}
${payChips(400, 360, 1.22)}
${sub(96, 452, "Nunca guardamos los datos de tu tarjeta", 18)}`));

add("m/hero-pagos.svg", svg(MOB.w, MOB.h, { vx: 640, vs: 0.75, glowX: 0.8, glowY: 0.26 }, `${place(shield(), 650, 130, 1.0)}
${heading(40, 120, [["PAGA COMO", "w", 66], ["QUIERAS", "l", 66]])}
${sub(46, 232, "En pesos colombianos · pago seguro", 22)}
${payChips(400, 380, 1.18)}
${sub(46, 540, "Y Botón Bancolombia · no guardamos tu tarjeta", 20)}`));

// Franjas anchas 1600×400 y celular 800×520
const WIDE = { w: 1600, h: 400 };
const MW = { w: 800, h: 520 };

add("garantia-wide.svg", svg(WIDE.w, WIDE.h, { vx: 1340, vs: 1.05, glowX: 0.84 }, `${place(refund(), 1340, 200, 1.6)}
${heading(90, 150, [["SI LA ENTREGA FALLA,", "w", 52], ["TE DEVOLVEMOS TU DINERO", "l", 56]], 1.25)}
${sub(96, 300, "✔ Pago verificado     ✔ Sin contraseñas     ✔ Soporte real", 26)}`));

add("m/garantia.svg", svg(MW.w, MW.h, { vx: 610, vs: 0.75, glowX: 0.76, glowY: 0.3 }, `${place(refund(), 620, 140, 1.05)}
${heading(40, 320, [["SI LA ENTREGA FALLA,", "w", 42], ["TE DEVOLVEMOS", "l", 56], ["TU DINERO", "l", 56]], 1.06)}
${sub(44, 486, "✔ Pago verificado  ✔ Sin contraseñas  ✔ Soporte real", 20)}`));

add("pasos-wide.svg", svg(WIDE.w, WIDE.h, { vx: 1120, vs: 1.0, glowX: 0.7 }, `${heading(90, 160, [["RECARGA", "w", 72], ["EN 3 PASOS", "l", 72]])}
${sub(96, 290, "Sin contraseñas · directo a tu ID", 26)}
${steps(1110, 170, 1.45)}`));

add("m/pasos.svg", svg(MW.w, MW.h, { vx: 400, vs: 0.7, glowX: 0.5, glowY: 0.7 }, `${heading(40, 100, [["RECARGA", "w", 58], ["EN 3 PASOS", "l", 58]])}
${sub(44, 200, "Sin contraseñas · directo a tu ID", 22)}
${steps(400, 330, 1.12, ["Verificamos tu cuenta", "Nequi, PSE, tarjeta", "Directo a tu cuenta"])}`));

add("sinclaves-wide.svg", svg(WIDE.w, WIDE.h, { vx: 1320, vs: 1.05, glowX: 0.83 }, `${place(lock(), 1330, 190, 1.45)}
${heading(90, 160, [["SOLO TU ID", "w", 80], ["CERO CLAVES", "l", 80]])}
${sub(96, 300, "Nunca te pedimos contraseñas de Facebook, Google ni del juego", 26)}`));

add("m/sinclaves.svg", svg(MW.w, MW.h, { vx: 600, vs: 0.75, glowX: 0.75, glowY: 0.28 }, `${place(lock(), 610, 140, 1.0)}
${heading(40, 340, [["SOLO TU ID", "w", 64], ["CERO CLAVES", "l", 64]])}
${sub(44, 456, "Nunca te pedimos contraseñas de", 22)}${sub(44, 486, "Facebook, Google ni del juego", 22)}`));

add("wide-cuentas.svg", svg(WIDE.w, WIDE.h, { vx: 1260, vs: 1.05, glowX: 0.8 }, `${place(cardsAccounts(), 1260, 205, 1.55)}
${heading(90, 150, [["CUENTAS FREE FIRE", "w", 66]])}
${heading(94, 210, [["RANGO · NIVEL · SKINS A LA VISTA", "l", 32]])}
${cta(94, 250, "VER CATÁLOGO  →", 20)}`));

// Laterales 1200×630
const SIDE = { w: 1200, h: 630 };
const side = (name, art, ax, ay, as, text, v = {}) => add(name, svg(SIDE.w, SIDE.h, { vx: ax, vs: 1.05, glowX: ax / SIDE.w, glowY: ay / SIDE.h, ...v }, `${place(art, ax, ay, as)}${text}`));

side("bonus.svg", chest(), 900, 300, 3.1, `${tag(66, 70, "FREE FIRE")}
<text x="60" y="270" font-family="${HEAD}" font-weight="900" font-style="italic" font-size="150" fill="${LIME}">+10%</text>
<text x="66" y="360" font-family="${HEAD}" font-weight="900" font-style="italic" font-size="72" fill="#fff">DE BONUS</text>
${sub(68, 412, "EN TODOS LOS PAQUETES", 26)}${sub(68, 446, "DE DIAMANTES", 26)}
${cta(66, 480, "RECARGA POR ID  →", 22)}`);

side("codigos.svg", ticket(), 905, 300, 1.85, `${heading(60, 190, [["¿TIENES UN", "w", 58], ["CÓDIGO?", "l", 96]])}
${sub(66, 360, "Escríbelo en el último paso", 26)}${sub(66, 394, "y ve tu descuento antes de pagar", 26)}
${cta(64, 430, "USAR CÓDIGO  →", 22)}`);

side("cuentas.svg", shield(), 900, 300, 2.0, `${tag(66, 70, "FREE FIRE")}
${heading(60, 250, [["CUENTAS", "w", 88], ["VERIFICADAS", "l", 66]])}
${sub(66, 400, "Nivel · Rango · Skins · Inventario a la vista", 24)}
${cta(64, 436, "VER CUENTAS  →", 22)}`);

side("filtros.svg", filterPanel(), 900, 310, 1.75, `${heading(60, 190, [["ENCUENTRA", "w", 70], ["TU CUENTA", "w", 70], ["IDEAL", "l", 70]])}
${sub(66, 420, "Filtra por rango, nivel, servidor y precio", 24)}
${cta(64, 456, "FILTRAR  →", 22)}`);

side("garantia.svg", refund(), 920, 290, 1.9, `${heading(60, 170, [["SI LA ENTREGA", "w", 56], ["FALLA, TE", "w", 56], ["DEVOLVEMOS", "l", 66], ["TU DINERO", "l", 66]], 1.08)}
${sub(66, 520, "✔ Pago verificado   ✔ Sin contraseñas   ✔ Soporte real", 22)}`);

side("nequi.svg", phone(), 930, 310, 1.75, `${tag(66, 70, "DIAMANTES FF")}
<text x="60" y="250" font-family="${HEAD}" font-weight="900" font-style="italic" font-size="84" fill="#fff">PAGA CON</text>${nequiWord(62, 370, 128)}
${sub(66, 420, "Apruebas el pago en tu app de Nequi", 24)}
${cta(64, 456, "RECARGAR  →", 22)}`);

side("pagos.svg", shield(), 1010, 150, 1.05, `${heading(60, 130, [["PAGA COMO", "w", 72], ["QUIERAS", "l", 72]])}
${sub(66, 240, "En pesos colombianos · pago seguro en la pasarela", 24)}
${payChips(600, 380, 1.3)}
${sub(600, 570, "Nunca guardamos los datos de tu tarjeta", 22, "middle")}`, { vs: 0.7 });

side("pasos.svg", "", 0, 0, 1, `${heading(600, 120, [["RECARGA EN 3 PASOS", "w", 64]]).replace("<text ", '<text text-anchor="middle" ')}
${sub(600, 168, "Sin contraseñas · directo a tu ID", 26, "middle")}
${steps(600, 320, 2.05)}`, { vx: 600, glowX: 0.5, glowY: 0.6, vs: 1.1 });

side("rastreo.svg", orderCard(), 600, 384, 2.15, `${heading(600, 120, [["SIGUE TU PEDIDO", "w", 64]]).replace("<text ", '<text text-anchor="middle" ')}
${heading(600, 186, [["EN VIVO", "l", 52]]).replace("<text ", '<text text-anchor="middle" ')}
${sub(600, 580, "Con tu número de pedido · sin crear cuenta", 24, "middle")}`, { vx: 600, glowX: 0.5, glowY: 0.6, vs: 1.1 });

side("sinclaves.svg", lock(), 925, 300, 1.85, `${heading(60, 200, [["SOLO TU ID", "w", 68], ["CERO CLAVES", "l", 68]])}
${sub(66, 340, "Nunca te pedimos contraseñas", 26)}${sub(66, 374, "de Facebook, Google ni del juego", 26)}
${cta(64, 412, "RECARGA SEGURA  →", 22)}`);

side("soporte.svg", chat(), 885, 300, 1.8, `${heading(60, 200, [["SOPORTE", "w", 72], ["DE VERDAD", "l", 72]])}
${sub(66, 340, "Personas reales que conocen", 26)}${sub(66, 374, "tu pedido por su número", 26)}
${cta(64, 412, "ESCRÍBENOS  →", 22)}`);

// ---------------------------------------------------------------- escribir

for (const [name, content] of Object.entries(files)) {
  const path = join(OUT, name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}
console.log(`${Object.keys(files).length} banners generados en public/promo`);
