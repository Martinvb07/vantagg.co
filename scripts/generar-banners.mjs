// Genera los banners de public/promo con la identidad de VANTAGG (fondo negro verdoso, V verde lima,
// diamantes azules y objetos negros con bordes lima). Uso: node scripts/generar-banners.mjs
// Los archivos conservan su nombre, así que los banners guardados en la base no cambian.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "promo");
const LIME = "#b9f43c";
const LIME2 = "#dcff7a";
const INK = "#030504";
const ORANGE = "#ff8a1f";
const XRED = "#ff4d5e";
const XGOLD = "#ffc63a";
const HEAD = "Arial Black, Arial, Helvetica, sans-serif";
const BODY = "Arial, Helvetica, sans-serif";

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Logo de Nequi (public/pagos/nequi.svg, ver CREDITOS.txt): cuadro magenta y letras blancas para fondo oscuro.
const NEQUI_PATHS = [
  "M31.99 0.28H28.22C27.7 0.28 27.3 0.7 27.3 1.2V16.28C27.3 16.58 26.9 16.7 26.75 16.42L17.99 0.69C17.85 0.43 17.59 0.28 17.28 0.28H11.02C10.5 0.28 10.1 0.7 10.1 1.2V25.29C10.1 25.81 10.52 26.21 11.02 26.21H14.79C15.3 26.21 15.7 25.79 15.7 25.29V9.76C15.7 9.46 16.11 9.34 16.25 9.62L25.26 25.82C25.4 26.08 25.66 26.22 25.96 26.22H31.96C32.47 26.22 32.87 25.81 32.87 25.31V1.2C32.87 0.69 32.46 0.28 31.96 0.28Z",
  "M54.65 16.81C54.65 10.02 50.24 6.65 45.39 6.65C39.09 6.65 35.5 11.02 35.5 16.92C35.5 23.63 40.01 26.82 45.24 26.82C50.48 26.82 53.54 24.11 54.36 20.6C54.47 20.15 54.21 19.74 53.54 19.74H50.57C50.24 19.74 49.95 19.92 49.8 20.26C49.06 21.89 47.87 22.74 45.58 22.74C42.99 22.74 41.25 21.11 40.99 17.81H53.73C54.28 17.81 54.65 17.41 54.65 16.81ZM41.2 14.25C41.75 11.81 43.16 10.73 45.31 10.73C47.22 10.73 48.87 11.84 49.09 14.25H41.2Z",
  "M103.08 7.14H99.3C98.79 7.14 98.38 7.55 98.38 8.05V25.31C98.38 25.81 98.79 26.22 99.3 26.22H103.08C103.59 26.22 104 25.81 104 25.31V8.05C104 7.55 103.59 7.14 103.08 7.14Z",
  "M74.98 7.14H71.21C70.69 7.14 70.29 7.55 70.29 8.05V8.99C69.16 7.67 67.31 6.75 64.88 6.75C59.43 6.75 56.55 11.68 56.55 16.91C56.55 21.47 58.92 26.58 64.77 26.58C66.86 26.58 69.08 25.58 70.29 24.16V31.58C70.29 32.09 70.71 32.5 71.21 32.5H74.98C75.49 32.5 75.89 32.08 75.89 31.58V8.07C75.89 7.55 75.48 7.15 74.98 7.15ZM66.39 22.52C63.91 22.52 62.17 20.69 62.17 16.78C62.17 12.86 63.91 10.81 66.39 10.81C68.87 10.81 70.61 12.7 70.61 16.78C70.61 20.86 68.87 22.52 66.39 22.52Z",
  "M95.05 7.14H91.28C90.76 7.14 90.36 7.55 90.36 8.05V17.81C90.36 20.95 88.96 21.87 87.17 21.87C85.38 21.87 83.98 20.95 83.98 17.81V8.05C83.98 7.54 83.56 7.14 83.06 7.14H79.29C78.78 7.14 78.38 7.55 78.38 8.05V18.21C78.38 24.26 81.71 26.69 87.19 26.69C92.66 26.69 96 24.24 96 18.21V8.05C96 7.54 95.58 7.14 95.08 7.14Z",
];
/** Logo de Nequi con su esquina superior izquierda en (x, y) y alto h (ancho ≈ 3,2 × h). */
function nequiLogo(x, y, h, letters = "#fff") {
  const k = h / 32.5;
  return `<g transform="translate(${x} ${y}) scale(${k})"><rect x="0" y="0.28" width="6.22" height="5.56" rx="0.92" fill="#DA0081"/>${NEQUI_PATHS.map((d) => `<path d="${d}" fill="${letters}"/>`).join("")}</g>`;
}

// Logos de PSE, Visa y Mastercard (public/pagos, ver CREDITOS.txt).
const PAGOS = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "pagos");
const PSE_DATA = `data:image/jpeg;base64,${readFileSync(join(PAGOS, "pse.jpg")).toString("base64")}`;
const VISA_PATH = "m651.19.5c-70.93,0-134.32,36.77-134.32,104.69,0,77.9,112.42,83.28,112.42,122.42,0,16.48-18.88,31.23-51.14,31.23-45.77,0-79.98-20.61-79.98-20.61l-14.64,68.55s39.41,17.41,91.73,17.41c77.55,0,138.58-38.57,138.58-107.66,0-82.32-112.89-87.54-112.89-123.86,0-12.91,15.5-27.05,47.66-27.05,36.29,0,65.89,14.99,65.89,14.99l14.33-66.2S696.61.5,651.18.5h0ZM2.22,5.5L.5,15.49s29.84,5.46,56.72,16.36c34.61,12.49,37.07,19.77,42.9,42.35l63.51,244.83h85.14L379.93,5.5h-84.94l-84.28,213.17-34.39-180.7c-3.15-20.68-19.13-32.48-38.68-32.48,0,0-135.41,0-135.41,0Zm411.87,0l-66.63,313.53h81L494.85,5.5h-80.76Zm451.76,0c-19.53,0-29.88,10.46-37.47,28.73l-118.67,284.8h84.94l16.43-47.47h103.48l9.99,47.47h74.95L934.12,5.5h-68.27Zm11.05,84.71l25.18,117.65h-67.45l42.28-117.65h0Z";

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
<g fill="none" stroke="${LIME}" stroke-linecap="round"><circle cx="-75" cy="-9" r="5" stroke-width="4"/><circle cx="-61" cy="11" r="5" stroke-width="4"/><path d="M-59 -15L-77 17" stroke-width="4.6"/></g>
<text x="22" y="6" font-family="${HEAD}" font-weight="900" font-size="21" fill="#fff" text-anchor="middle">CÓDIGO</text>
<text x="22" y="27" font-family="${BODY}" font-weight="700" font-size="10" fill="${LIME}" text-anchor="middle" letter-spacing="1">APLÍCALO AL PAGAR</text>
</g>${gems([[-120, -86, 22, -18], [116, 54, 20, 16]])}${spark(100, -74, 1.4)}${spark(-112, 70, 1)}`;

const phone = () => `${ringBack(0, 92, 74, 14)}
<g transform="rotate(8)">
<rect x="-56" y="-100" width="112" height="196" rx="20" fill="url(#dark)" stroke="${INK}" stroke-width="4"/>
<rect x="-48" y="-88" width="96" height="172" rx="12" fill="#070a08" stroke="${LIME}" stroke-width="2"/>
<rect x="-14" y="-96" width="28" height="5" rx="2.5" fill="#000"/>
${nequiLogo(-36, -78, 22)}
<circle cx="0" cy="-2" r="30" fill="${LIME}" filter="url(#soft)" opacity=".7"/>
<circle cx="0" cy="-2" r="28" fill="${LIME}" stroke="${INK}" stroke-width="2"/>
<path d="M-13 -2L-3 9L15 -12" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
<text x="0" y="50" font-family="${HEAD}" font-weight="900" font-size="15" fill="#fff" text-anchor="middle">PAGO</text><text x="0" y="68" font-family="${HEAD}" font-weight="900" font-size="15" fill="${LIME}" text-anchor="middle">LISTO</text>
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
  // Fichas blancas iguales con el logo centrado (los logos se ven con sus colores reales).
  const chip = (cx, logo) => `<g transform="translate(${cx} 0)"><rect x="-62" y="-50" width="124" height="100" rx="18" fill="${LIME}" opacity=".35" filter="url(#soft)"/>
<rect x="-58" y="-46" width="116" height="92" rx="14" fill="#f5f8f1" stroke="${LIME}" stroke-width="3"/>${logo}</g>`;
  const nequi = nequiLogo(-46, -14.5, 29, "#200020");
  const pse = `<image href="${PSE_DATA}" x="-31" y="-31" width="62" height="62"/>`;
  const visa = `<g transform="translate(-42 -13.6) scale(0.084)"><path fill="#1434cb" d="${VISA_PATH}"/></g>`;
  const mastercard = `<g transform="translate(-37 -22.9) scale(0.074)"><path fill="#EB001B" d="m308,0a309,309 0 1,0 2,0z"/><path fill="#F79E1B" d="m690,0a309,309 0 1,0 2,0z"/><path fill="#FF5F00" d="m500,66a309,309 0 0,0 0,486 309,309 0 0,0 0-486"/></g>`;
  return `<g transform="translate(${x} ${y}) scale(${s})">${chip(-189, nequi)}${chip(-63, pse)}${chip(63, visa)}${chip(189, mastercard)}</g>`;
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

function tag(x, y, text, size = 22, fill = LIME) {
  const w = text.length * size * 0.78 + size * 1.2;
  const h = size * 1.6;
  return `<g transform="translate(${x} ${y})"><path d="M0 0H${w}L${w - size * 0.5} ${h}H0Z" fill="${fill}"/>
<text x="${size * 0.5}" y="${h * 0.72}" font-family="${HEAD}" font-weight="900" font-style="italic" font-size="${size}" fill="${INK}" letter-spacing="1">${esc(text)}</text></g>`;
}

/** lines: [texto, color ("w" | "l"), tamaño] */
function heading(x, y, lines, gap = 1.02) {
  let yy = y;
  return lines
    .map(([t, c, s], i) => {
      if (i > 0) yy += s * gap;
      const fill = c === "l" ? LIME : c === "o" ? ORANGE : c === "r" ? XRED : c === "p" ? "#d9bcff" : "#fff";
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

/**
 * Versión navideña de los banners de la marca (public/promo/navidad): mismo texto y dibujo, sobre noche de pino, con
 * nieve, luces arriba, nieve en el suelo y regalos. Solo degradados (sin desenfoques) para que pesen poco.
 */
let XMAS = false;
const XCOLORS = [XRED, XGOLD, LIME, "#62dcea", "#ff8fd0"];
const xmasDefs = () =>
  `${XCOLORS.map((c, i) => `<g id="xb${i}"><circle cx="0" cy="12" r="12" fill="${c}" opacity=".22"/><rect x="-3.5" y="-1.5" width="7" height="7" rx="1.6" fill="#26302b" stroke="${INK}" stroke-width="1.2"/><ellipse cx="0" cy="12" rx="6" ry="8.5" fill="${c}" stroke="${INK}" stroke-width="1.2"/><ellipse cx="-2" cy="9" rx="1.6" ry="3" fill="#fff" opacity=".55"/></g>`).join("")}
<linearGradient id="xsnow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4fbff"/><stop offset="1" stop-color="#b9d6e6"/></linearGradient>`;
function xmasBack(w, h) {
  return `<g fill="#fff">${Array.from({ length: Math.round(w / 40) }, (_, i) => `<circle cx="${(i * 397 + 53) % w}" cy="${(i * 173 + 29) % h}" r="${[1.4, 2.2, 3, 1.8][i % 4]}" opacity="${(0.25 + (i % 5) * 0.12).toFixed(2)}"/>`).join("")}</g>`;
}
function xmasFront(w, h) {
  // Luces de lado a lado (cable que cuelga entre ganchos y bombillos con su brillo).
  const step = 160;
  const y = 4;
  const sag = 14;
  let wire = `M-20 ${y}`;
  let bulbs = "";
  let k = 0;
  for (let x = -20; x < w + 20; x += step) {
    wire += `Q${x + step / 2} ${y + sag * 2} ${x + step} ${y}`;
    for (const t of [0.22, 0.5, 0.78]) {
      const bx = x + step * t;
      const by = y + 2 * (1 - t) * t * sag * 2;
      const c = k++ % XCOLORS.length;
      bulbs += `<use href="#xb${c}" transform="translate(${bx.toFixed(0)} ${by.toFixed(0)}) rotate(${((t - 0.5) * 36).toFixed(0)})"/>`;
    }
  }
  // Nieve en el suelo: suave a la izquierda (debajo del texto) y blanca a la derecha (debajo del dibujo); regalos.
  const ground = `<path d="M${w * 0.55} ${h}C${w * 0.64} ${h * 0.93} ${w * 0.74} ${h * 0.9} ${w * 0.82} ${h * 0.92}S${w * 0.94} ${h * 0.88} ${w} ${h * 0.9}V${h}Z" fill="url(#xsnow)"/>
<path d="M${w * 0.62} ${h}C${w * 0.72} ${h * 0.95} ${w * 0.84} ${h * 0.95} ${w} ${h * 0.96}V${h}Z" fill="#fff" opacity=".9"/>`;
  const gifts = `${gift(w - 64, h - 6, 50, 40, XRED, XGOLD)}${gift(w - 118, h - 4, 38, 30, "url(#dark)", LIME)}`;
  return `${ground}${gifts}<path d="${wire}" fill="none" stroke="#1d2622" stroke-width="2.4"/>${bulbs}`;
}

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
  const clouds = [0.04, 0.16, 0.86, 0.98].map((p, i) => `<circle cx="${w * p}" cy="${h + 10}" r="${h * [0.22, 0.18, 0.2, 0.24][i]}" fill="${XMAS ? "#e9f6f3" : "#0d200f"}" opacity="${XMAS ? (i < 2 ? ".12" : ".2") : ".9"}"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="0.6" y2="1"><stop offset="0" stop-color="${XMAS ? "#0c1d17" : "#0c180c"}"/><stop offset="1" stop-color="${XMAS ? "#020604" : "#030604"}"/></linearGradient>${XMAS ? xmasDefs() : ""}
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
${XMAS ? xmasBack(w, h) : ""}${slashes}${clouds}
${body}${XMAS ? `\n${xmasFront(w, h)}` : ""}
</svg>
`;
}

const place = (art, x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})">${art}</g>`;

// ---------------------------------------------------------------- banners

const files = {};
let PREFIX = "";
const add = (name, content) => (files[PREFIX + name] = content);

// Carrusel principal 1600×480 y su versión de celular 800×600
const HERO = { w: 1600, h: 480 };
const MOB = { w: 800, h: 600 };
const WIDE = { w: 1600, h: 400 };
const MW = { w: 800, h: 520 };
const SIDE = { w: 1200, h: 630 };

/** Banners de la marca (los del panel). Se generan dos veces: normales y en versión navideña (public/promo/navidad). */
function brandBanners() {

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


add("hero-nequi.svg", svg(HERO.w, HERO.h, { vx: 1270, vs: 1.25 }, `${place(phone(), 1270, 230, 1.85)}
${tag(96, 70, "DIAMANTES FF")}
<text x="90" y="216" font-family="${HEAD}" font-weight="900" font-style="italic" font-size="96" fill="#fff">PAGA CON</text>${nequiLogo(96, 238, 96)}
${sub(98, 368, "Apruebas el pago en tu app de Nequi", 24)}
${cta(96, 390, "RECARGAR  →", 20)}`));

add("m/hero-nequi.svg", svg(MOB.w, MOB.h, { vx: 600, vs: 0.85, glowX: 0.75, glowY: 0.32 }, `${place(phone(), 610, 200, 1.3)}
${tag(46, 40, "DIAMANTES FF", 20)}
<text x="40" y="380" font-family="${HEAD}" font-weight="900" font-style="italic" font-size="76" fill="#fff">PAGA CON</text>${nequiLogo(46, 398, 80)}
${sub(46, 510, "Apruebas el pago en tu app de Nequi", 22)}
${cta(44, 530, "RECARGAR  →", 17)}`));

add("hero-pagos.svg", svg(HERO.w, HERO.h, { vx: 1330, vs: 1.2, glowX: 0.83 }, `${place(shield(), 1340, 230, 1.75)}
${heading(90, 140, [["PAGA COMO", "w", 82], ["QUIERAS", "l", 82]], 1.0)}
${sub(96, 268, "En pesos colombianos · pago seguro en la pasarela", 24)}
${payChips(400, 360, 1.22)}
${sub(96, 452, "Tarjetas débito y crédito · nunca guardamos sus datos", 18)}`));

add("m/hero-pagos.svg", svg(MOB.w, MOB.h, { vx: 640, vs: 0.75, glowX: 0.8, glowY: 0.26 }, `${place(shield(), 650, 130, 1.0)}
${heading(40, 120, [["PAGA COMO", "w", 66], ["QUIERAS", "l", 66]])}
${sub(46, 232, "En pesos colombianos · pago seguro", 22)}
${payChips(400, 380, 1.18)}
${sub(46, 540, "Débito, crédito y Botón Bancolombia", 20)}`));

// Franjas anchas 1600×400 y celular 800×520

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
<text x="60" y="250" font-family="${HEAD}" font-weight="900" font-style="italic" font-size="84" fill="#fff">PAGA CON</text>${nequiLogo(66, 276, 96)}
${sub(66, 420, "Apruebas el pago en tu app de Nequi", 24)}
${cta(64, 456, "RECARGAR  →", 22)}`);

side("pagos.svg", shield(), 1010, 150, 1.05, `${heading(60, 130, [["PAGA COMO", "w", 72], ["QUIERAS", "l", 72]])}
${sub(66, 240, "En pesos colombianos · pago seguro en la pasarela", 24)}
${payChips(600, 380, 1.3)}
${sub(600, 570, "Tarjetas débito y crédito · nunca guardamos sus datos", 22, "middle")}`, { vs: 0.7 });

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

}
brandBanners();

// ---------------------------------------------------------------- Halloween (temporada)

/** Calabaza con la V de la marca tallada (centrada en 0,0; ~230 de ancho). */
function pumpkin() {
  const lobe = (cx, rx, ry) => `<ellipse cx="${cx}" cy="0" rx="${rx}" ry="${ry}" fill="url(#pump)" stroke="#2a1203" stroke-width="4"/>`;
  return `<ellipse cx="0" cy="92" rx="118" ry="16" fill="#000" opacity=".45"/>
<path d="M-6 -76C-9 -98 -1 -112 14 -120L22 -110C10 -103 7 -92 9 -76Z" fill="#5d7a1e" stroke="#1d2a08" stroke-width="3.5" stroke-linejoin="round"/>
${lobe(-66, 52, 76)}${lobe(66, 52, 76)}${lobe(-32, 54, 84)}${lobe(32, 54, 84)}${lobe(0, 52, 88)}
<path d="M-96 -30C-104 0 -100 34 -84 54" fill="none" stroke="#fff" stroke-opacity=".22" stroke-width="7" stroke-linecap="round"/>
<g filter="url(#soft)" opacity=".9"><path d="M-52 -30H-16L-34 -2Z M16 -30H52L34 -2Z" fill="#ffd34d"/><path d="M-50 14H-28L0 54L28 14H50L9 72H-9Z" fill="${LIME}"/></g>
<path d="M-52 -30H-16L-34 -2Z M16 -30H52L34 -2Z" fill="#ffd34d" stroke="#2a1203" stroke-width="3" stroke-linejoin="round"/>
<path d="M-50 14H-28L0 54L28 14H50L9 72H-9Z" fill="${LIME2}" stroke="#2a1203" stroke-width="3" stroke-linejoin="round"/>`;
}

/** Murciélago (silueta) en (x, y), escala s, giro r. */
const bat = (x, y, s = 1, r = 0, o = 1) =>
  `<g transform="translate(${x} ${y}) rotate(${r}) scale(${s})" opacity="${o}"><path d="M0 -6C3 -12 7 -12 9 -8C15 -16 27 -16 34 -6C28 -6 24 -2 22 3C18 -1 13 0 11 4C8 1 4 2 0 7C-4 2 -8 1 -11 4C-13 0 -18 -1 -22 3C-24 -2 -28 -6 -34 -6C-27 -16 -15 -16 -9 -8C-7 -12 -3 -12 0 -6ZM-4 -8L-3 -14L-1 -9ZM4 -8L3 -14L1 -9Z" fill="#0b0613"/></g>`;

/**
 * Telaraña en una esquina: (x, y) es la esquina, r el largo y `dir` hacia dónde se abre
 * (1,1 = abajo-derecha desde la esquina superior izquierda; -1,1 = abajo-izquierda…).
 */
function web(x, y, r, dx = 1, dy = 1, color = "#fff", o = 0.35) {
  const spokes = 6;
  const angle = (i) => (Math.PI / 2) * (i / (spokes - 1));
  const pt = (i, k) => [x + dx * Math.cos(angle(i)) * r * k, y + dy * Math.sin(angle(i)) * r * k];
  const lines = Array.from({ length: spokes }, (_, i) => { const [a, b] = pt(i, 1); return `M${x} ${y}L${a.toFixed(1)} ${b.toFixed(1)}`; }).join("");
  const rings = [0.28, 0.5, 0.72, 0.94]
    .map((k) => {
      let d = "";
      for (let i = 0; i < spokes; i++) {
        const [a, b] = pt(i, k);
        if (i === 0) d += `M${a.toFixed(1)} ${b.toFixed(1)}`;
        else {
          // Hilo curvado hacia la esquina, como una telaraña real.
          const [pa, pb] = pt(i - 1, k);
          const [ma, mb] = pt(i - 0.5, k * 0.86);
          d += `Q${ma.toFixed(1)} ${mb.toFixed(1)} ${a.toFixed(1)} ${b.toFixed(1)}`;
          void pa; void pb;
        }
      }
      return d;
    })
    .join("");
  return `<path d="${lines}${rings}" fill="none" stroke="${color}" stroke-opacity="${o}" stroke-width="${Math.max(1, r / 90)}" stroke-linecap="round"/>`;
}

/** Araña colgando de su hilo desde arriba (x, hasta y). */
function spider(x, y, s = 1, color = "#3b2b55") {
  const legs = [-1, 1]
    .map((side) => [-6, -2, 2, 6].map((k, i) => `M${side * 5} ${k}Q${side * (14 + i * 2)} ${k - 8} ${side * (20 + i * 2)} ${k + 4}`).join(""))
    .join("");
  return `<path d="M${x} 0V${y - 10 * s}" stroke="#ffffff" stroke-opacity=".35" stroke-width="1.4"/>
<g transform="translate(${x} ${y}) scale(${s})"><path d="${legs}" fill="none" stroke="${color}" stroke-width="2.4" stroke-linecap="round"/>
<ellipse cx="0" cy="0" rx="8" ry="10" fill="${color}"/><circle cx="0" cy="-11" r="5.5" fill="${color}"/><circle cx="-2" cy="-12" r="1.2" fill="#ff8a1f"/><circle cx="2" cy="-12" r="1.2" fill="#ff8a1f"/></g>`;
}

/** Noche de Halloween: cielo morado, luna naranja, la V de la marca y nubes. */
function svgNight(w, h, { mx, my, mr, vx, vs = 1 }, body) {
  const vw = 400 * vs;
  const vh = 330 * vs;
  const v = `M${vx - vw / 2} -10H${vx - vw / 2 + 92 * vs}L${vx} ${vh * 0.62}L${vx + vw / 2 - 92 * vs} -10H${vx + vw / 2}L${vx + 16 * vs} ${vh}H${vx - 16 * vs}Z`;
  const stars = Array.from({ length: 26 }, (_, i) => `<circle cx="${(i * 397) % w}" cy="${(i * 131) % (h * 0.55)}" r="${i % 3 ? 1.4 : 2.2}" fill="#fff" opacity="${0.25 + (i % 4) * 0.15}"/>`).join("");
  const clouds = [0.03, 0.15, 0.84, 0.97].map((p, i) => `<circle cx="${w * p}" cy="${h + 10}" r="${h * [0.22, 0.18, 0.2, 0.24][i]}" fill="#1a0b26" opacity=".95"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="0.5" y2="1"><stop offset="0" stop-color="#1d0d2e"/><stop offset="1" stop-color="#06030b"/></linearGradient>
<linearGradient id="v" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${LIME}" stop-opacity=".22"/><stop offset="1" stop-color="${LIME}" stop-opacity=".02"/></linearGradient>
<radialGradient id="moon" cx="0.4" cy="0.35"><stop offset="0" stop-color="#fff1c4"/><stop offset=".6" stop-color="#ffc061"/><stop offset="1" stop-color="#f08a1c"/></radialGradient>
<radialGradient id="moonglow"><stop offset="0" stop-color="#ff9a2e" stop-opacity=".45"/><stop offset="1" stop-color="#ff9a2e" stop-opacity="0"/></radialGradient>
<linearGradient id="pump" x1="0" y1="0" x2="0.3" y2="1"><stop offset="0" stop-color="#ffb24a"/><stop offset=".55" stop-color="#ef6b0c"/><stop offset="1" stop-color="#a53d06"/></linearGradient>
<radialGradient id="gemglow"><stop offset="0" stop-color="#4fc3ff" stop-opacity=".5"/><stop offset="1" stop-color="#4fc3ff" stop-opacity="0"/></radialGradient>
<filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>
<path id="spark" d="M0 -10L2.2 -2.2L10 0L2.2 2.2L0 10L-2.2 2.2L-10 0L-2.2 -2.2Z" fill="#fff"/>
</defs>
<rect width="${w}" height="${h}" fill="url(#bg)"/>
${stars}
<circle cx="${mx}" cy="${my}" r="${mr * 2.4}" fill="url(#moonglow)"/>
<circle cx="${mx}" cy="${my}" r="${mr}" fill="url(#moon)"/>
<circle cx="${mx - mr * 0.3}" cy="${my + mr * 0.15}" r="${mr * 0.16}" fill="#e7962f" opacity=".45"/><circle cx="${mx + mr * 0.25}" cy="${my - mr * 0.3}" r="${mr * 0.1}" fill="#e7962f" opacity=".4"/>
<path d="${v}" fill="url(#v)"/>
${clouds}
${body}
</svg>
`;
}

const halloweenArt = (x, y, s) => `${place(`<circle cx="0" cy="10" r="120" fill="url(#gemglow)"/>${ringBack(0, 92, 110, 18)}${pumpkin()}${gems([[-128, 36, 30, -20], [124, 30, 32, 18], [-150, -40, 18, -14], [150, -54, 16, 16], [96, 74, 18, 12, true], [-100, 78, 16, -12, true]])}${ringFront(0, 92, 110, 18)}`, x, y, s)}`;

add("hero-halloween.svg", svgNight(HERO.w, HERO.h, { mx: 1420, my: 104, mr: 70, vx: 1250, vs: 1.2 }, `${web(1600, 0, 190, -1, 1)}${web(0, 0, 130, 1, 1, "#fff", 0.22)}${spider(930, 170, 1.4)}${halloweenArt(1240, 262, 1.4)}
${bat(1030, 92, 1.3, -12)}${bat(1100, 52, 0.8, 8, 0.85)}${bat(1500, 210, 1, -6, 0.9)}${bat(1330, 40, 0.7, 14, 0.8)}${spark(1560, 330, 1.2)}
${tag(96, 70, "HALLOWEEN", 22, ORANGE)}
${heading(90, 190, [["NOCHE DE", "w", 70], ["HALLOWEEN", "o", 104]])}
${sub(96, 336, "Recarga tus diamantes · directo a tu ID", 26)}
${cta(94, 368, "RECARGAR  →", 20)}`));

add("m/hero-halloween.svg", svgNight(MOB.w, MOB.h, { mx: 690, my: 80, mr: 52, vx: 560, vs: 0.85 }, `${web(800, 0, 150, -1, 1)}${spider(300, 150, 1.1)}${halloweenArt(540, 190, 0.98)}
${bat(380, 70, 1, -10)}${bat(430, 34, 0.65, 10, 0.85)}${bat(740, 200, 0.8, -6, 0.9)}
${tag(46, 40, "HALLOWEEN", 20, ORANGE)}
${heading(40, 404, [["NOCHE DE", "w", 56], ["HALLOWEEN", "o", 82]])}
${sub(46, 520, "Recarga tus diamantes · directo a tu ID", 22)}
${cta(44, 534, "RECARGAR  →", 17)}`));

// Piezas sueltas para decorar la tienda (fondo transparente).
add("../temporada/telarana.svg", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">${web(0, 0, 196, 1, 1, "#ffffff", 0.55)}</svg>\n`);
add("../temporada/arana.svg", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-30 0 60 120" width="60" height="120">${spider(0, 100, 1.3)}</svg>\n`);
add("../temporada/murcielago.svg", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-36 -18 72 30" width="72" height="30">${bat(0, 0, 1).replace('fill="#0b0613"', 'fill="#120a1c"')}</svg>\n`);

// Calabaza suelta para las portadas de los paquetes (fondo transparente).
add("../temporada/calabaza.svg", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-130 -130 260 240" width="260" height="240">
<defs><linearGradient id="pump" x1="0" y1="0" x2="0.3" y2="1"><stop offset="0" stop-color="#ffb24a"/><stop offset=".55" stop-color="#ef6b0c"/><stop offset="1" stop-color="#a53d06"/></linearGradient>
<filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter></defs>
${pumpkin()}
</svg>
`);

// ---------------------------------------------------------------- Navidad (temporada)

const BULBS = [XRED, XGOLD, LIME, "#62dcea", "#ff8fd0"];

/** Bola de árbol (adorno) roja, dorada o lima con brillo. */
const ball = (x, y, r, c) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" stroke="${INK}" stroke-width="2.5"/><circle cx="${x - r * 0.35}" cy="${y - r * 0.35}" r="${r * 0.3}" fill="#fff" opacity=".6"/>`;

/** Estrella dorada de cinco puntas (centro x, y; radio r). */
function star5(x, y, r) {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    return `${(x + Math.cos(a) * rr).toFixed(1)} ${(y + Math.sin(a) * rr).toFixed(1)}`;
  });
  return `<circle cx="${x}" cy="${y}" r="${r * 2}" fill="url(#starglow)"/><path d="M${pts.join("L")}Z" fill="url(#goldstar)" stroke="#5a3a05" stroke-width="3" stroke-linejoin="round"/>`;
}

/** Regalo: caja (color c) con cinta (color r) y moño. Centro abajo en (x, y). */
function gift(x, y, w, h, c, r) {
  return `<g transform="translate(${x} ${y})"><rect x="${-w / 2}" y="${-h}" width="${w}" height="${h}" rx="4" fill="${c}" stroke="${INK}" stroke-width="4"/>
<rect x="${-w / 2 - 5}" y="${-h - 4}" width="${w + 10}" height="${h * 0.24}" rx="4" fill="${c}" stroke="${INK}" stroke-width="4"/>
<rect x="${-w * 0.09}" y="${-h - 4}" width="${w * 0.18}" height="${h + 4}" fill="${r}" stroke="${INK}" stroke-width="3"/>
<path d="M0 ${-h - 4}C${-w * 0.42} ${-h - h * 0.5} ${-w * 0.48} ${-h + 6} 0 ${-h - 4}ZM0 ${-h - 4}C${w * 0.42} ${-h - h * 0.5} ${w * 0.48} ${-h + 6} 0 ${-h - 4}Z" fill="${r}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/></g>`;
}

/**
 * Árbol de Navidad de VANTAGG (centrado en 0,0; ~300 de alto): capas negras con borde lima, guirnalda de luces,
 * diamantes y bolas de adorno, estrella dorada y regalos al pie.
 */
function xmasTree() {
  const layer = (y, w, h) =>
    `<path d="M0 ${y}L${w / 2} ${y + h}Q0 ${y + h + 16} ${-w / 2} ${y + h}Z" fill="url(#dark)" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
<path d="M0 ${y + 16}L${w / 2 - 18} ${y + h - 6}" fill="none" stroke="${LIME}" stroke-width="4" stroke-linecap="round"/><path d="M0 ${y + 16}L${-w / 2 + 18} ${y + h - 6}" fill="none" stroke="${LIME}" stroke-width="4" stroke-linecap="round" opacity=".55"/>`;
  const garland = (y, w, c) => `<path d="M${-w / 2} ${y}Q0 ${y + 26} ${w / 2} ${y - 6}" fill="none" stroke="${c}" stroke-width="3.5" stroke-linecap="round" opacity=".9"/>`;
  return `<circle cx="0" cy="-10" r="170" fill="url(#gemglow)"/>${ringBack(0, 112, 160, 22)}
<rect x="-16" y="86" width="32" height="30" rx="3" fill="#3a2a1a" stroke="${INK}" stroke-width="4"/>
${layer(-40, 290, 130)}${layer(-100, 220, 110)}${layer(-152, 150, 90)}
${garland(-92, 120, XGOLD)}${garland(-30, 190, XGOLD)}${garland(40, 260, XGOLD)}
${ball(-40, -78, 9, XRED)}${ball(46, -60, 8, XGOLD)}${ball(-74, -6, 10, XGOLD)}${ball(70, 6, 10, XRED)}${ball(-104, 66, 11, XRED)}${ball(24, 58, 10, LIME)}${ball(112, 70, 9, XGOLD)}
${gems([[6, -126, 22, 8], [-6, -16, 26, -10], [-40, 28, 22, 12], [64, 30, 20, -14]])}
${star5(0, -160, 26)}
${gift(-130, 120, 70, 54, XRED, XGOLD)}${gift(130, 120, 62, 48, "url(#dark)", LIME)}${gift(-72, 122, 40, 32, XGOLD, XRED)}
${ringFront(0, 112, 160, 22)}`;
}

/** Noche de Navidad: verde pino muy oscuro, nieve cayendo, la V de la marca, luces arriba y montículos de nieve. */
function svgXmas(w, h, { vx, vs = 1, glowX = 0.75, glowY = 0.5 }, body) {
  const vw = 400 * vs;
  const vh = 330 * vs;
  const v = `M${vx - vw / 2} -10H${vx - vw / 2 + 92 * vs}L${vx} ${vh * 0.62}L${vx + vw / 2 - 92 * vs} -10H${vx + vw / 2}L${vx + 16 * vs} ${vh}H${vx - 16 * vs}Z`;
  const snow = Array.from({ length: 40 }, (_, i) => `<circle cx="${(i * 397 + 53) % w}" cy="${(i * 173 + 29) % h}" r="${[1.4, 2.2, 3, 1.8][i % 4]}" fill="#fff" opacity="${(0.25 + (i % 5) * 0.12).toFixed(2)}"/>`).join("");
  // Nieve en el suelo: suave a la izquierda (debajo del texto) y blanca y brillante a la derecha (debajo del árbol).
  const mounds = [0.06, 0.2].map((p, i) => `<ellipse cx="${w * p}" cy="${h + 6}" rx="${h * [0.34, 0.26][i]}" ry="${h * [0.12, 0.09][i]}" fill="#e9f6f3" opacity=".14"/>`).join("") +
    `<path d="M${w * 0.52} ${h}C${w * 0.6} ${h * 0.9} ${w * 0.7} ${h * 0.86} ${w * 0.78} ${h * 0.89}S${w * 0.92} ${h * 0.84} ${w} ${h * 0.87}V${h}Z" fill="url(#snowground)"/>
<path d="M${w * 0.6} ${h}C${w * 0.68} ${h * 0.93} ${w * 0.8} ${h * 0.92} ${w * 0.88} ${h * 0.95}S${w * 0.97} ${h * 0.93} ${w} ${h * 0.94}V${h}Z" fill="#ffffff" opacity=".9"/>
${[0.64, 0.71, 0.86, 0.93].map((p, i) => `<use href="#spark" transform="translate(${w * p} ${h * [0.93, 0.9, 0.9, 0.95][i]}) scale(.6)"/>`).join("")}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="0.5" y2="1"><stop offset="0" stop-color="#0c1d17"/><stop offset="1" stop-color="#020604"/></linearGradient>
<linearGradient id="v" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${LIME}" stop-opacity=".3"/><stop offset="1" stop-color="${LIME}" stop-opacity=".03"/></linearGradient>
<radialGradient id="glow" cx="${glowX}" cy="${glowY}" r="0.55"><stop offset="0" stop-color="${LIME}" stop-opacity=".22"/><stop offset=".55" stop-color="${LIME}" stop-opacity=".05"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
<radialGradient id="gemglow"><stop offset="0" stop-color="#4fc3ff" stop-opacity=".35"/><stop offset="1" stop-color="#4fc3ff" stop-opacity="0"/></radialGradient>
<linearGradient id="dark" x1="0" y1="0" x2="0.3" y2="1"><stop offset="0" stop-color="#2c3a31"/><stop offset="1" stop-color="#0a110d"/></linearGradient>
<linearGradient id="goldstar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff2b0"/><stop offset=".6" stop-color="${XGOLD}"/><stop offset="1" stop-color="#d48a12"/></linearGradient>
<linearGradient id="snowground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4fbff"/><stop offset="1" stop-color="#b9d6e6"/></linearGradient>
${BULBS.map((c, i) => `<radialGradient id="bulbglow${i}"><stop offset="0" stop-color="${c}" stop-opacity=".45"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`).join("")}
<radialGradient id="starglow"><stop offset="0" stop-color="${XGOLD}" stop-opacity=".55"/><stop offset="1" stop-color="${XGOLD}" stop-opacity="0"/></radialGradient>
<filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>
<path id="spark" d="M0 -10L2.2 -2.2L10 0L2.2 2.2L0 10L-2.2 2.2L-10 0L-2.2 -2.2Z" fill="#fff"/>
</defs>
<rect width="${w}" height="${h}" fill="url(#bg)"/>
<path d="${v}" fill="url(#v)"/>
<rect width="${w}" height="${h}" fill="url(#glow)"/>
${snow}${mounds}
${body}
</svg>
`;
}

add("hero-navidad.svg", svgXmas(HERO.w, HERO.h, { vx: 1250, vs: 1.2, glowX: 0.78, glowY: 0.55 }, `${place(xmasTree(), 1240, 270, 1.15)}
${spark(1490, 150, 1.4)}${spark(1010, 120, 1.1)}${spark(1530, 380, 1)}
${tag(96, 74, "NAVIDAD VANTAGG", 22, XGOLD)}
${heading(90, 194, [["FELIZ", "w", 70], ["NAVIDAD", "r", 104]])}
${sub(96, 338, "Regala diamantes · directo a su ID", 26)}
${cta(94, 370, "RECARGAR  →", 20)}`));

add("m/hero-navidad.svg", svgXmas(MOB.w, MOB.h, { vx: 560, vs: 0.85, glowX: 0.7, glowY: 0.34 }, `${place(xmasTree(), 560, 214, 0.8)}
${spark(740, 110, 1.1)}${spark(380, 120, 0.9)}
${tag(46, 92, "NAVIDAD VANTAGG", 18, XGOLD)}
${heading(40, 404, [["FELIZ", "w", 56], ["NAVIDAD", "r", 82]])}
${sub(46, 520, "Regala diamantes · directo a su ID", 22)}
${cta(44, 534, "RECARGAR  →", 17)}`));

// Piezas sueltas de Navidad (fondo transparente): gorro para el logo y regalo para las portadas de los paquetes.
add("../temporada/gorro.svg", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 100" width="120" height="100">
<defs><linearGradient id="hat" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="#ff6b78"/><stop offset="1" stop-color="#c81d33"/></linearGradient></defs>
<path d="M16 74C20 40 46 14 78 10C96 8 108 18 110 34C104 28 96 26 90 30C84 44 86 60 92 74Z" fill="url(#hat)" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
<path d="M34 50C44 34 60 24 76 20" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="4" stroke-linecap="round"/>
<rect x="8" y="68" width="92" height="22" rx="11" fill="#f4f7f6" stroke="${INK}" stroke-width="4"/>
<path d="M18 76H90" stroke="#cfd8d6" stroke-width="3" stroke-linecap="round" stroke-dasharray="2 7"/>
<circle cx="108" cy="38" r="11" fill="#f4f7f6" stroke="${INK}" stroke-width="4"/>
</svg>
`);
add("../temporada/regalo.svg", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-60 -80 120 130" width="120" height="130">
<defs><linearGradient id="dark" x1="0" y1="0" x2="0.3" y2="1"><stop offset="0" stop-color="#2c3a31"/><stop offset="1" stop-color="#0a110d"/></linearGradient></defs>
${gift(0, 46, 84, 70, XRED, XGOLD)}
</svg>
`);

// Guirnalda de pino con nieve (mosaico de 480 × 54 que se repite a lo ancho) y sus luces en 3 capas que titilan por
// turnos: cada capa es una imagen aparte que la tienda prende y apaga con opacidad (la mueve la tarjeta gráfica, sin
// trabajo para el procesador).
{
  const TW = 480;
  const BAND = 20;
  const wave = (x) => BAND + 2.5 * Math.sin((2 * Math.PI * x) / TW);
  const greens = ["#0e3b22", "#17572f", "#1f7040"];
  const needles = [-160, -140, -118, -96, -74, -52, -30, 20, 42, 64, 86, 108, 130, 152, 172, 0]
    .map((a, i) => {
      const len = 11 + ((i * 7) % 7);
      const r = (a * Math.PI) / 180;
      return `<path d="M0 0L${(Math.cos(r) * len).toFixed(1)} ${(Math.sin(r) * len * 0.62).toFixed(1)}" stroke="${greens[i % 3]}" stroke-width="2.6" stroke-linecap="round"/>`;
    })
    .join("");
  const clusters = Array.from({ length: TW / 32 + 1 }, (_, i) => ({ x: i * 32, y: wave(i * 32), r: (((i % (TW / 32)) * 47) % 50) - 25, k: i % (TW / 32) }));
  const bulbsAt = Array.from({ length: 8 }, (_, k) => ({ x: 30 + k * 60, y: wave(30 + k * 60) + 9, c: BULBS[k % BULBS.length], phase: k % 3 }));
  const head = (extra = "") => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${TW} 54" width="${TW}" height="54">${extra}`;
  const base = `${head(`<defs><g id="p"><ellipse cx="0" cy="0" rx="17" ry="7" fill="#0b2e1a"/>${needles}</g></defs>`)}
${clusters.map((c) => `<use href="#p" transform="translate(${c.x} ${c.y.toFixed(1)}) rotate(${c.r})"/>`).join("")}
${clusters.map((c) => `<ellipse cx="${c.x + ((c.k * 5) % 9) - 2}" cy="${(c.y - 5.5 - ((c.k * 3) % 3) * 0.8).toFixed(1)}" rx="${7 + ((c.k * 7) % 6)}" ry="${(2.6 + ((c.k * 3) % 3) * 0.5).toFixed(1)}" fill="${c.k % 4 ? "#f4fbff" : "#dcebf3"}"/>`).join("")}
${[[120, XGOLD], [360, "#e0293f"]].map(([x, c]) => `<path d="M${x} ${BAND}V${BAND + 10}" stroke="#c8a476" stroke-width="1"/><circle cx="${x}" cy="${BAND + 17}" r="6.5" fill="${c}" stroke="#2a0a10" stroke-width="1.2"/><circle cx="${x - 2.2}" cy="${BAND + 14.8}" r="1.8" fill="#fff" opacity=".65"/>`).join("")}
${bulbsAt.map((b) => `<rect x="${b.x - 2.2}" y="${(b.y - 1).toFixed(1)}" width="4.4" height="4.4" rx="1" fill="#26302b"/><ellipse cx="${b.x}" cy="${(b.y + 9).toFixed(1)}" rx="3.8" ry="5.6" fill="${b.c}" opacity=".42"/>`).join("")}
<g transform="translate(240 ${BAND})" stroke="#5a0a14" stroke-width="1.2" stroke-linejoin="round"><path d="M-2 2L-9 22L-4 19L-1 24Z M2 2L9 22L4 19L1 24Z" fill="#c81d33"/><path d="M0 0C-6 -9 -18 -8 -16 1C-14 8 -5 4 0 0ZM0 0C6 -9 18 -8 16 1C14 8 5 4 0 0Z" fill="#e0293f"/><circle cx="0" cy="0" r="3.4" fill="#b3132b"/></g>
</svg>
`;
  add("../temporada/guirnalda.svg", base);
  for (const phase of [0, 1, 2]) {
    const lit = bulbsAt.filter((b) => b.phase === phase);
    add(`../temporada/luces-${phase + 1}.svg`, `${head(`<defs>${BULBS.map((c, i) => `<radialGradient id="g${i}"><stop offset="0" stop-color="${c}" stop-opacity=".65"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`).join("")}</defs>`)}
${lit.map((b) => `<circle cx="${b.x}" cy="${(b.y + 9).toFixed(1)}" r="12" fill="url(#g${BULBS.indexOf(b.c)})"/><ellipse cx="${b.x}" cy="${(b.y + 9).toFixed(1)}" rx="3.8" ry="5.6" fill="${b.c}"/><ellipse cx="${b.x - 1.2}" cy="${(b.y + 7).toFixed(1)}" rx="1" ry="1.8" fill="#fff" opacity=".6"/>`).join("")}
</svg>
`);
  }
  // Nieve que cae: dos mosaicos que se repiten (la tienda los baja de a un mosaico: el ciclo no se nota).
  const crystal = (x, y, s, o) => `<g transform="translate(${x} ${y}) scale(${s}) rotate(${(x * 7) % 60})" opacity="${o}"><path d="M0 -9V9M-7.8 -4.5L7.8 4.5M-7.8 4.5L7.8 -4.5M0 -6L-2 -8M0 -6L2 -8M0 6L-2 8M0 6L2 8" stroke="#fff" stroke-width="1.5" stroke-linecap="round" fill="none"/></g>`;
  const dot = (x, y, r, o) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity="${o}"/>`;
  add("../temporada/nieve-a.svg", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 560" width="560" height="560">
${[[40, 60, 2.2, 0.7], [300, 130, 1.8, 0.6], [470, 330, 2.4, 0.65], [150, 450, 2, 0.6]].map((d) => dot(...d)).join("")}
${[[200, 250, 0.7, 0.7], [430, 520, 0.6, 0.6]].map((c) => crystal(...c)).join("")}
</svg>
`);
  add("../temporada/nieve-b.svg", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800">
${[[120, 160, 1.1, 0.75], [560, 420, 1.2, 0.7], [300, 690, 1, 0.65]].map((c) => crystal(...c)).join("")}
${[[680, 90, 2.8, 0.65]].map((d) => dot(...d)).join("")}
</svg>
`);
}

// Nieve acumulada en el borde de arriba de las portadas (200 × 26, con gotas que cuelgan).
{
  let d = "M0 0H200V9";
  const drips = [14, 41, 63, 97, 128, 152, 181];
  for (let x = 200; x > 0; x -= 10) {
    const nx = x - 10;
    const drip = drips.find((dx) => dx > nx && dx <= x);
    if (drip) d += `C${x - 2} ${10 + (x % 3)} ${drip + 3} 10 ${drip + 2.5} ${15 + (drip % 9)}A2.5 2.5 0 0 1 ${drip - 2.5} ${15 + (drip % 9)}C${drip - 3} 10 ${nx + 2} ${9 + (nx % 2)} ${nx} ${8 + (nx % 3)}`;
    else d += `Q${x - 5} ${12 + ((x / 10) % 2) * 2} ${nx} ${8 + (nx % 3)}`;
  }
  add("../temporada/nieve-borde.svg", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 26" width="200" height="26" preserveAspectRatio="none">
<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#d4e8f4"/></linearGradient></defs>
<path d="${d}Z" fill="#7fa3b8" opacity=".35" transform="translate(0 1.6)"/><path d="${d}Z" fill="url(#s)"/>
<path d="M6 4H60M84 3H150M166 4H194" stroke="#fff" stroke-width="1.4" stroke-linecap="round" opacity=".9"/></svg>
`);
}

/** Hoja de acebo (de la base 0,0 a la punta L,0) con puntas. */
function hollyLeaf(L, W) {
  const n = 4;
  let d = "M0 0";
  for (let i = 1; i <= n; i++) d += `Q${(L * (i - 0.5)) / n} ${(-W * Math.sin((Math.PI * (i - 0.5)) / n) * 0.55).toFixed(1)} ${(L * i) / n} ${i === n ? 0 : (-W * Math.sin((Math.PI * i) / n)).toFixed(1)}`;
  for (let i = n - 1; i >= 0; i--) d += `Q${(L * (i + 0.5)) / n} ${(W * Math.sin((Math.PI * (i + 0.5)) / n) * 0.55).toFixed(1)} ${(L * i) / n} ${i === 0 ? 0 : (W * Math.sin((Math.PI * i) / n)).toFixed(1)}`;
  return `${d}Z`;
}
add("../temporada/acebo.svg", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 44" width="56" height="44">
<g transform="translate(26 26) rotate(-155)"><path d="${hollyLeaf(26, 9)}" fill="#1f8a45" stroke="#0b2e17" stroke-width="2.2" stroke-linejoin="round"/><path d="M2 0H23" stroke="#7fd99a" stroke-width="1.4" opacity=".7"/></g>
<g transform="translate(30 26) rotate(-25)"><path d="${hollyLeaf(26, 9)}" fill="#26a352" stroke="#0b2e17" stroke-width="2.2" stroke-linejoin="round"/><path d="M2 0H23" stroke="#9be8b2" stroke-width="1.4" opacity=".7"/></g>
${ball(22, 27, 6, XRED)}${ball(33, 28, 6, XRED)}${ball(27, 19, 6, "#e0293f")}
</svg>
`);

/** Pueblito nevado (1600 × 170, cielo transparente): colinas, pinos con nieve, casitas con luz y el árbol de la plaza. */
{
  const W = 1600;
  const pine = (x, y, s, dark = "#0f3a22") =>
    `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-4" y="-6" width="8" height="12" fill="#3b2a1e"/>
<path d="M0 -78L22 -44H12L30 -20H16L36 2H-36L-16 -20H-30L-12 -44H-22Z" fill="${dark}" stroke="#061a0e" stroke-width="2" stroke-linejoin="round"/>
<path d="M0 -78L10 -62Q4 -58 0 -62Q-4 -58 -10 -62ZM-12 -44Q-4 -40 2 -44Q8 -40 12 -44L16 -40Q6 -36 -2 -40Q-10 -36 -16 -40ZM-16 -20Q-6 -16 2 -20Q10 -16 16 -20L22 -15Q8 -11 0 -15Q-10 -11 -22 -15Z" fill="#f2f9fc"/></g>`;
  const house = (x, y, s, wall) =>
    `<g transform="translate(${x} ${y}) scale(${s})"><rect x="18" y="-64" width="10" height="18" fill="#3a2c27" stroke="#140c0a" stroke-width="2"/>
<rect x="-34" y="-36" width="68" height="36" fill="${wall}" stroke="#140c0a" stroke-width="2.5"/>
<path d="M-42 -34L0 -66L42 -34Z" fill="#5a2a28" stroke="#140c0a" stroke-width="2.5" stroke-linejoin="round"/>
<path d="M-44 -33L0 -67L44 -33L36 -30Q22 -40 12 -36Q0 -44 -12 -36Q-24 -40 -36 -30Z" fill="#f4fbff"/>
${[-20, 10].map((wx) => `<rect x="${wx}" y="-28" width="12" height="12" rx="1.5" fill="#ffd56b" stroke="#140c0a" stroke-width="1.6"/><circle cx="${wx + 6}" cy="-22" r="14" fill="url(#win)"/>`).join("")}
<rect x="-6" y="-18" width="10" height="18" fill="#3b2a1e" stroke="#140c0a" stroke-width="1.6"/>
<path d="M-34 -36H34" stroke="${XRED}" stroke-width="2" stroke-dasharray="1 5" stroke-linecap="round"/></g>`;
  const pines = [[60, 150, 0.9], [140, 156, 1.2], [230, 152, 0.8], [520, 154, 1.1], [600, 158, 0.75], [1000, 156, 1.05], [1080, 152, 0.8], [1350, 158, 1.25], [1440, 150, 0.85], [1540, 156, 1.1]];
  const bigTree = `<g transform="translate(800 156)"><path d="M0 -112L34 -64H20L46 -30H26L56 2H-56L-26 -30H-46L-20 -64H-34Z" fill="#14502c" stroke="#061a0e" stroke-width="2.5" stroke-linejoin="round"/>
${[[-14, -76, XRED], [12, -58, XGOLD], [-26, -40, LIME], [20, -30, XRED], [-36, -10, XGOLD], [34, -8, "#62dcea"], [0, -18, "#ff8fd0"]].map(([bx, by, c]) => `<circle cx="${bx}" cy="${by}" r="4.5" fill="${c}" stroke="#061a0e" stroke-width="1.4"/>`).join("")}
${star5(0, -116, 14)}</g>`;
  add("../temporada/pueblo.svg", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} 170" width="${W}" height="170" preserveAspectRatio="xMidYMax slice">
<defs><linearGradient id="h1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfe3ee"/><stop offset="1" stop-color="#8fb3c7"/></linearGradient>
<linearGradient id="h2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#cfe2ec"/></linearGradient>
<linearGradient id="goldstar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff2b0"/><stop offset=".6" stop-color="${XGOLD}"/><stop offset="1" stop-color="#d48a12"/></linearGradient>
<radialGradient id="starglow"><stop offset="0" stop-color="${XGOLD}" stop-opacity=".55"/><stop offset="1" stop-color="${XGOLD}" stop-opacity="0"/></radialGradient>
<radialGradient id="win"><stop offset="0" stop-color="#ffd56b" stop-opacity=".35"/><stop offset="1" stop-color="#ffd56b" stop-opacity="0"/></radialGradient></defs>
<path d="M0 132C180 104 340 120 520 112S880 96 1060 114S1400 104 1600 120V170H0Z" fill="url(#h1)" opacity=".55"/>
${pines.slice(0, 5).map(([x, y, s]) => pine(x, y - 12, s * 0.8, "#123d26")).join("")}
${house(330, 154, 0.95, "#7a2f2b")}${house(690, 158, 0.8, "#2f4a63")}${house(1200, 156, 1, "#6b4a2a")}
${bigTree}
${pines.map(([x, y, s]) => pine(x, y, s)).join("")}
<path d="M0 150C200 138 420 146 640 142S1040 136 1240 146S1480 140 1600 146V170H0Z" fill="url(#h2)"/>
${Array.from({ length: 22 }, (_, i) => `<circle cx="${(i * 79 + 30) % W}" cy="${152 + (i % 4) * 4}" r="1.6" fill="#fff"/>`).join("")}
</svg>
`);
}

// ---------------------------------------------------------------- eventos de Free Fire (src/content/event-banners.ts)

// Arte propio (no se usa arte de Garena): francotirador con agujero negro y puño de energía, en morado y azul cósmico.
const COSMIC = ["#f3e9ff", "#d9bcff", "#a77bff", "#7b46ff", "#4b22c9", "#1a0b4a"];

/** Rayo en zigzag (desde x, y; largo, ángulo en grados). */
function bolt(x, y, len, ang, w = 3) {
  const r = (ang * Math.PI) / 180;
  const pts = [[0, 0], [len * 0.28, -len * 0.08], [len * 0.42, len * 0.07], [len * 0.7, -len * 0.06], [len, len * 0.04]];
  const d = pts.map(([px, py], i) => `${i ? "L" : "M"}${(x + px * Math.cos(r) - py * Math.sin(r)).toFixed(1)} ${(y + px * Math.sin(r) + py * Math.cos(r)).toFixed(1)}`).join("");
  return `<path d="${d}" fill="none" stroke="#7fb8ff" stroke-width="${w * 3}" stroke-linecap="round" stroke-linejoin="round" opacity=".3"/><path d="${d}" fill="none" stroke="#fff" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

/** Agujero negro con su anillo (centro 0,0). */
const blackHole = (r = 34) =>
  `<circle r="${r * 2.4}" fill="url(#vortexglow)"/><ellipse rx="${r * 2.1}" ry="${r * 0.62}" fill="none" stroke="url(#ring)" stroke-width="${r * 0.32}" transform="rotate(-14)"/>
<circle r="${r}" fill="url(#hole)" stroke="${COSMIC[1]}" stroke-width="2.5"/><path d="M${-r * 2.1} 0A${r * 2.1} ${r * 0.62} 0 0 0 ${r * 2.1} 0" fill="none" stroke="url(#ring)" stroke-width="${r * 0.32}" transform="rotate(-14)"/>`;

/** Rifle de francotirador (mira a la derecha, centrado en 0,0; ~660 de largo) con el agujero negro en el cuerpo. */
function sniper() {
  const o = `stroke="${INK}" stroke-width="4" stroke-linejoin="round"`;
  return `<g>
<path d="M66 70L84 20M104 70L88 20" stroke="#120d22" stroke-width="7" stroke-linecap="round"/>
<path d="M-170 -22L-300 -32Q-334 -30 -334 -8V32Q-332 50 -300 48L-232 38L-204 22L-170 24Z" fill="url(#gun)" ${o}/>
<path d="M-292 -10H-238V18H-292Z" fill="#0b0816" opacity=".85"/>
<path d="M-172 -28H-30L-14 -16V20L-40 26H-172Z" fill="url(#gun)" ${o}/>
<path d="M-148 22L-124 22L-112 76Q-118 84 -128 82L-140 80Z" fill="url(#gun)" ${o}/>
<path d="M-100 24H-66V62H-100Z" fill="#1d1533" ${o}/>
<path d="M-118 24Q-118 46 -96 46" fill="none" stroke="${INK}" stroke-width="4"/>
<path d="M-16 -18H96L104 -10V12L96 18H-16Z" fill="url(#gun)" ${o}/>
<rect x="96" y="-8" width="232" height="15" rx="6" fill="url(#gun)" ${o}/>
<rect x="318" y="-14" width="40" height="27" rx="5" fill="#2a1f4a" ${o}/>
<path d="M326 -14V13M340 -14V13" stroke="${INK}" stroke-width="3"/>
<rect x="-140" y="-70" width="160" height="30" rx="14" fill="url(#gun)" ${o}/>
<ellipse cx="22" cy="-55" rx="8" ry="16" fill="${COSMIC[2]}" ${o}/><ellipse cx="-142" cy="-55" rx="6" ry="13" fill="#1d1533" ${o}/>
<path d="M-112 -40V-28M-8 -40V-28" stroke="${INK}" stroke-width="7"/>
<path d="M-166 -24H-34M-12 -14H92M100 -5H322M-134 -64H12" fill="none" stroke="${COSMIC[1]}" stroke-width="3" stroke-linecap="round" opacity=".85"/>
<g transform="translate(-92 -2)">${blackHole(30)}</g>
</g>`;
}

/** Puño de energía cósmica de frente (nudillos), con su estela de cometa (centrado en 0,0; ~200 de ancho). */
function cosmicFist() {
  const o = `stroke="${INK}" stroke-width="4" stroke-linejoin="round"`;
  const finger = (x, h) => `<rect x="${x}" y="${-62 + (40 - h) / 2}" width="42" height="${h + 14}" rx="19" fill="url(#fist)" ${o}/><path d="M${x + 10} ${-54 + (40 - h) / 2}Q${x + 21} ${-62 + (40 - h) / 2} ${x + 32} ${-54 + (40 - h) / 2}" fill="none" stroke="${COSMIC[0]}" stroke-width="3" stroke-linecap="round" opacity=".7"/>`;
  return `<path d="M30 60C120 140 260 200 420 250L380 300C230 230 90 170 10 100Z" fill="url(#trail)"/>
<path d="M50 70C150 150 270 200 400 240" fill="none" stroke="${COSMIC[0]}" stroke-width="3" opacity=".5"/>
<circle r="150" fill="url(#vortexglow)"/>
<rect x="-58" y="60" width="116" height="96" rx="22" fill="url(#fist)" ${o}/>
<rect x="-92" y="-30" width="184" height="118" rx="34" fill="url(#fist)" ${o}/>
${finger(-88, 40)}${finger(-44, 46)}${finger(0, 46)}${finger(44, 40)}
<path d="M-96 6C-96 -6 -76 -10 -60 -4L26 20C42 26 40 50 22 52L-60 50C-86 48 -98 30 -96 6Z" fill="url(#fist)" ${o}/>
<path d="M-70 10L14 30" stroke="${COSMIC[0]}" stroke-width="3" stroke-linecap="round" opacity=".55"/>
${bolt(-60, -10, 120, 64, 2.6)}${bolt(40, -50, 90, 110, 2.2)}`;
}

/** Fondo cósmico (morado y azul, estrellas y rayos) para los banners de estos eventos; en Navidad, con luces y nieve. */
function svgCosmic(w, h, { glowX = 0.74, glowY = 0.5, vx, vs = 1 }, body) {
  const vw = 400 * vs;
  const vh = 330 * vs;
  const v = `M${vx - vw / 2} -10H${vx - vw / 2 + 92 * vs}L${vx} ${vh * 0.62}L${vx + vw / 2 - 92 * vs} -10H${vx + vw / 2}L${vx + 16 * vs} ${vh}H${vx - 16 * vs}Z`;
  const stars = `<g fill="#fff">${Array.from({ length: Math.round(w / 30) }, (_, i) => `<circle cx="${(i * 337 + 41) % w}" cy="${(i * 211 + 17) % h}" r="${[1, 1.6, 2.2][i % 3]}" opacity="${(0.3 + (i % 4) * 0.15).toFixed(2)}"/>`).join("")}</g>`;
  const rays = Array.from({ length: 7 }, (_, i) => `<path d="M${w * glowX} ${h * glowY}L${w * glowX + Math.cos(i * 0.9 - 2.4) * w}  ${h * glowY + Math.sin(i * 0.9 - 2.4) * w}L${w * glowX + Math.cos(i * 0.9 - 2.3) * w} ${h * glowY + Math.sin(i * 0.9 - 2.3) * w}Z" fill="#3f7bff" opacity=".07"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1c0a3e"/><stop offset=".55" stop-color="#21146b"/><stop offset="1" stop-color="#0a1440"/></linearGradient>
<linearGradient id="v" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${LIME}" stop-opacity=".22"/><stop offset="1" stop-color="${LIME}" stop-opacity=".02"/></linearGradient>
<radialGradient id="glow" cx="${glowX}" cy="${glowY}" r="0.5"><stop offset="0" stop-color="#9b6bff" stop-opacity=".45"/><stop offset="1" stop-color="#9b6bff" stop-opacity="0"/></radialGradient>
<radialGradient id="vortexglow"><stop offset="0" stop-color="#b48cff" stop-opacity=".55"/><stop offset="1" stop-color="#b48cff" stop-opacity="0"/></radialGradient>
<radialGradient id="hole"><stop offset=".55" stop-color="#000"/><stop offset="1" stop-color="#4b22c9"/></radialGradient>
<linearGradient id="ring" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7fb8ff"/><stop offset=".5" stop-color="#f3e9ff"/><stop offset="1" stop-color="#a77bff"/></linearGradient>
<linearGradient id="gun" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a2f5c"/><stop offset="1" stop-color="#0f0b1e"/></linearGradient>
<linearGradient id="fist" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="#b892ff"/><stop offset=".55" stop-color="#6d3df2"/><stop offset="1" stop-color="#2d1680"/></linearGradient>
<linearGradient id="trail" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d9bcff" stop-opacity=".75"/><stop offset="1" stop-color="#3f7bff" stop-opacity="0"/></linearGradient>
<linearGradient id="dark" x1="0" y1="0" x2="0.3" y2="1"><stop offset="0" stop-color="#323a36"/><stop offset="1" stop-color="#0c100e"/></linearGradient>
<path id="spark" d="M0 -10L2.2 -2.2L10 0L2.2 2.2L0 10L-2.2 2.2L-10 0L-2.2 -2.2Z" fill="#fff"/>
${XMAS ? xmasDefs() : ""}
</defs>
<rect width="${w}" height="${h}" fill="url(#bg)"/>
${rays}${stars}
<path d="${v}" fill="url(#v)"/>
<rect width="${w}" height="${h}" fill="url(#glow)"/>
${XMAS ? xmasBack(w, h) : ""}
${body}${XMAS ? `\n${xmasFront(w, h)}` : ""}
</svg>
`;
}

/** Banners de eventos de Free Fire (src/content/event-banners.ts): en la pasada navideña salen con luces y nieve. */
function eventBanners() {
  // Evo AWM «Abismo Cósmico» (salió el 17 de noviembre de 2026, Free Fire Latinoamérica).
  add("eventos/awm-abismo-cosmico.svg", svgCosmic(HERO.w, HERO.h, { vx: 1180, vs: 1.15 }, `<g transform="translate(1170 250) rotate(-11) scale(1.08)">${sniper()}</g>
${bolt(860, 120, 150, 20)}${bolt(1420, 370, 140, -30)}${spark(1500, 110, 1.4)}${spark(930, 380, 1.1)}${spark(1270, 90, 0.9)}
${tag(96, 58, "NUEVO EN FREE FIRE", 22, LIME)}
${heading(90, 152, [["EVO AWM", "l", 64], ["ABISMO", "w", 88], ["CÓSMICO", "p", 88]], 0.98)}
${sub(96, 366, "Llegó la nueva Evo AWM · recarga tus diamantes", 24)}
${cta(94, 388, "RECARGAR  →", 20)}`));
  add("eventos/m/awm-abismo-cosmico.svg", svgCosmic(MOB.w, MOB.h, { vx: 560, vs: 0.8, glowX: 0.55, glowY: 0.3 }, `<g transform="translate(420 190) rotate(-11) scale(0.98)">${sniper()}</g>
${bolt(120, 290, 110, -14)}${spark(720, 300, 1.1)}
${tag(46, 46, "NUEVO EN FREE FIRE", 18, LIME)}
${heading(40, 372, [["EVO AWM", "l", 48], ["ABISMO CÓSMICO", "w", 56]])}
${sub(46, 484, "Recarga tus diamantes · directo a tu ID", 22)}
${cta(44, 506, "RECARGAR  →", 17)}`));
  // Puños «Cometa Cósmico» (salieron el 17 de noviembre de 2026, Free Fire Latinoamérica).
  add("eventos/punos-cometa-cosmico.svg", svgCosmic(HERO.w, HERO.h, { vx: 1200, vs: 1.15, glowX: 0.76, glowY: 0.46 }, `<g transform="translate(1230 220) rotate(-14) scale(1.18)">${cosmicFist()}</g>
${bolt(900, 90, 140, 24)}${bolt(1480, 330, 120, -40)}${spark(1510, 100, 1.4)}${spark(960, 380, 1.1)}
${tag(96, 58, "NUEVO EN FREE FIRE", 22, LIME)}
${heading(90, 152, [["PUÑOS", "l", 64], ["COMETA", "w", 88], ["CÓSMICO", "p", 88]], 0.98)}
${sub(96, 366, "Consíguelos con diamantes · directo a tu ID", 24)}
${cta(94, 388, "RECARGAR  →", 20)}`));
  add("eventos/m/punos-cometa-cosmico.svg", svgCosmic(MOB.w, MOB.h, { vx: 560, vs: 0.8, glowX: 0.62, glowY: 0.3 }, `<g transform="translate(470 170) rotate(-14) scale(0.95)">${cosmicFist()}</g>
${bolt(110, 250, 110, -14)}${spark(730, 80, 1.1)}
${tag(46, 46, "NUEVO EN FREE FIRE", 18, LIME)}
${heading(40, 372, [["PUÑOS", "l", 48], ["COMETA CÓSMICO", "w", 56]])}
${sub(46, 484, "Consíguelos con diamantes · directo a tu ID", 22)}
${cta(44, 506, "RECARGAR  →", 17)}`));
}

eventBanners();

// ---------------------------------------------------------------- versiones navideñas de los banners de la marca

XMAS = true;
PREFIX = "navidad/";
brandBanners();
eventBanners();
XMAS = false;
PREFIX = "";
/** Rutas de los banners que tienen versión navideña (la tienda las cambia solas en temporada). */
const NAVIDAD_LIST = Object.keys(files).filter((n) => n.startsWith("navidad/")).map((n) => `/promo/${n.slice("navidad/".length)}`).sort();

// ---------------------------------------------------------------- escribir

for (const [name, content] of Object.entries(files)) {
  const path = join(OUT, name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}
// Lista de banners con versión navideña, para la tienda (src/content/navidad-banners.ts).
writeFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "..", "src", "content", "navidad-banners.ts"),
  `// Generado por scripts/generar-banners.mjs: banners de la marca que tienen versión navideña en public/promo/navidad.\nexport const NAVIDAD_BANNERS: ReadonlySet<string> = new Set([\n${NAVIDAD_LIST.map((u) => `  "${u}",`).join("\n")}\n]);\n`,
);
console.log(`${Object.keys(files).length} archivos generados (public/promo y public/temporada) · ${NAVIDAD_LIST.length} banners con versión navideña`);
