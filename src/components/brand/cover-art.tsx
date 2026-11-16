import type { ReactNode } from "react";
import type { PassArt } from "@/domain/packs";

/**
 * Arte de las portadas de los paquetes (identidad de VANTAGG): fondo negro verdoso con la V verde lima,
 * diamantes azules tallados y objetos negros con bordes lima sobre un anillo de energía.
 * Diamantes: diamante → racimo → bolsa → caja → cofre → lanzamiento aéreo. Tarjetas y pase: su propia escena.
 *
 * No se dibuja en cada página: tests/portadas.test.ts lo convierte en archivos de public/portadas
 * (PORTADAS_ACTUALIZAR=1 npx vitest run tests/portadas.test.ts) y falla si un archivo quedó desactualizado.
 */

const LIME = "#b9f43c";
/** Cada escena se agranda para llenar la tarjeta (la cantidad tapa la franja de abajo). */
const SCALE = [1.22, 1.2, 1.2, 1.16, 1.1, 1];
const LIME_SOFT = "#dcff7a";
const INK = "#030504";

/** Diamante tallado: centro x, borde superior y, ancho, inclinación (grados), dorado. */
type GemSpec = [cx: number, top: number, w: number, tilt?: number, gold?: boolean];

const ICE = ["#e3f9ff", "#98e1ff", "#52bbff", "#2d84f0", "#1a52c4", "#06183f"];
const GOLD = ["#fff7d1", "#ffe37d", "#ffc63a", "#ee9c18", "#bd6b0b", "#3b2203"];

function Gem({ g }: { g: GemSpec }) {
  const [cx, y0, w, tilt = 0, gold] = g;
  const c = gold ? GOLD : ICE;
  const h = w * 0.86;
  const y1 = y0 + h * 0.3; // faja
  const tip = y0 + h;
  const [t1, t2] = [cx - w * 0.27, cx + w * 0.27];
  const [gl, g1, g2, gr] = [cx - w / 2, cx - w / 6, cx + w / 6, cx + w / 2];
  return (
    <g transform={`rotate(${tilt} ${cx} ${y0 + h / 2})`} strokeLinejoin="round">
      <path d={`M${t1} ${y0} L${gl} ${y1} L${g1} ${y1}Z`} fill={c[2]} />
      <path d={`M${t1} ${y0} L${cx} ${y0} L${g1} ${y1}Z`} fill={c[0]} />
      <path d={`M${cx} ${y0} L${g1} ${y1} L${g2} ${y1}Z`} fill={c[1]} />
      <path d={`M${cx} ${y0} L${t2} ${y0} L${g2} ${y1}Z`} fill={c[2]} />
      <path d={`M${t2} ${y0} L${gr} ${y1} L${g2} ${y1}Z`} fill={c[3]} />
      <path d={`M${gl} ${y1} L${g1} ${y1} L${cx} ${tip}Z`} fill={c[2]} />
      <path d={`M${g1} ${y1} L${g2} ${y1} L${cx} ${tip}Z`} fill={c[3]} />
      <path d={`M${g2} ${y1} L${gr} ${y1} L${cx} ${tip}Z`} fill={c[4]} />
      <path d={`M${t1 + w * 0.06} ${y0 + h * 0.05} L${cx - w * 0.06} ${y0 + h * 0.05} L${g1 - w * 0.03} ${y1 - h * 0.05}Z`} fill="#fff" opacity="0.7" />
      <path d={`M${gl + w * 0.12} ${y1 + h * 0.05} L${g1 - w * 0.02} ${y1 + h * 0.05} L${cx - w * 0.05} ${tip - h * 0.22}Z`} fill="#fff" opacity="0.25" />
      <path d={`M${gl} ${y1} H${gr}`} stroke={c[5]} strokeOpacity="0.45" strokeWidth="1" />
      <path d={`M${t1} ${y0} H${t2} L${gr} ${y1} L${cx} ${tip} L${gl} ${y1}Z`} fill="none" stroke={c[5]} strokeWidth={Math.max(1.6, Math.min(3, w * 0.05))} />
    </g>
  );
}

const Gems = ({ list }: { list: GemSpec[] }) => (
  <>
    {list.map((g, i) => (
      <Gem key={i} g={g} />
    ))}
  </>
);

/** La V de la marca como emblema: centro x, centro y, escala. */
function VMark({ x, y, s = 1, u }: { x: number; y: number; s?: number; u: (n: string) => string }) {
  const d = "M-10 -8 H-4.2 L0 1.6 L4.2 -8 H10 L1.8 8.6 H-1.8Z";
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d={d} fill={LIME} filter={u("soft")} opacity="0.8" />
      <path d={d} fill={LIME} stroke={INK} strokeWidth="1.2" strokeLinejoin="round" />
    </g>
  );
}

/** Anillo de energía: la mitad de atrás va antes del objeto y la de adelante después. */
function RingBack({ cx, cy, rx, ry }: { cx: number; cy: number; rx: number; ry: number }) {
  return <path d={`M${cx - rx} ${cy} A${rx} ${ry} 0 0 1 ${cx + rx} ${cy}`} fill="none" stroke={LIME} strokeOpacity="0.45" strokeWidth="2" />;
}

function RingFront({ cx, cy, rx, ry, u }: { cx: number; cy: number; rx: number; ry: number; u: (n: string) => string }) {
  const arc = `M${cx - rx} ${cy} A${rx} ${ry} 0 0 0 ${cx + rx} ${cy}`;
  return (
    <>
      <path d={arc} fill="none" stroke={LIME} strokeWidth="7" filter={u("soft")} opacity="0.75" />
      <path d={arc} fill="none" stroke={LIME_SOFT} strokeWidth="2.6" strokeLinecap="round" />
      {/* Colas del remolino */}
      <path d={`M${cx - rx - 16} ${cy - 12} Q${cx - rx - 4} ${cy + ry + 4} ${cx - rx * 0.2} ${cy + ry + 3} Q${cx - rx + 2} ${cy + ry - 2} ${cx - rx - 16} ${cy - 12}Z`} fill={LIME} opacity="0.9" />
      <path d={`M${cx + rx + 14} ${cy - 16} Q${cx + rx + 6} ${cy + ry - 2} ${cx + rx * 0.35} ${cy + ry + 1} Q${cx + rx - 2} ${cy + ry - 5} ${cx + rx + 14} ${cy - 16}Z`} fill={LIME} opacity="0.75" />
    </>
  );
}

/** Pedestal hexagonal negro con borde lima. */
function Pedestal({ cx, y, w, u }: { cx: number; y: number; w: number; u: (n: string) => string }) {
  const [l, r, il, ir] = [cx - w / 2, cx + w / 2, cx - w * 0.3, cx + w * 0.3];
  return (
    <>
      <path d={`M${l} ${y} V${y + 7} L${il} ${y + 15} H${ir} L${r} ${y + 7} V${y}Z`} fill="#0a0d0b" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
      <path d={`M${l} ${y} L${il} ${y - 8} H${ir} L${r} ${y} L${ir} ${y + 8} H${il}Z`} fill={u("ped")} stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
      <path d={`M${l} ${y} L${il} ${y + 8} H${ir} L${r} ${y}`} fill="none" stroke={LIME} strokeWidth="1.8" strokeLinejoin="round" />
    </>
  );
}

/** Escena de cada paquete de diamantes. `u` resuelve los degradados y filtros definidos en <defs>. */
function Scene({ t, u }: { t: number; u: (n: string) => string }): ReactNode {
  switch (t) {
    // 1 · Un diamante flotando sobre el pedestal
    case 1:
      return (
        <>
          <RingBack cx={100} cy={128} rx={50} ry={11} />
          <Pedestal cx={100} y={124} w={68} u={u} />
          <ellipse cx="100" cy="123" rx="16" ry="3" fill="#000" opacity="0.5" />
          <circle cx="100" cy="76" r="40" fill={u("gemglow")} />
          <Gems list={[[100, 44, 64], [60, 66, 18, -16], [142, 54, 14, 14]]} />
          <RingFront cx={100} cy={128} rx={50} ry={11} u={u} />
        </>
      );
    // 2 · Racimo de diamantes sobre el pedestal
    case 2:
      return (
        <>
          <RingBack cx={100} cy={128} rx={56} ry={12} />
          <Pedestal cx={100} y={124} w={84} u={u} />
          <circle cx="100" cy="86" r="44" fill={u("gemglow")} />
          <Gems list={[[74, 82, 40, -18], [128, 80, 42, 16], [100, 72, 56], [152, 44, 13, 18], [52, 50, 12, -12]]} />
          <RingFront cx={100} cy={128} rx={56} ry={12} u={u} />
        </>
      );
    // 3 · Bolsa táctica VANTAGG llena de diamantes
    case 3:
      return (
        <>
          <RingBack cx={100} cy={134} rx={58} ry={12} />
          <circle cx="100" cy="66" r="34" fill={u("gemglow")} />
          <Gems list={[[82, 54, 30, -20], [120, 52, 32, 16], [100, 44, 38]]} />
          <path d="M64 82 C48 102 48 140 100 142 C152 140 152 102 136 82Z" fill={u("dark")} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
          <path d="M60 84 Q100 98 140 84" fill="none" stroke="#2c3330" strokeWidth="8" strokeLinecap="round" />
          <path d="M60 84 Q100 98 140 84" fill="none" stroke={LIME} strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="141" cy="86" r="4.5" fill={LIME} stroke={INK} strokeWidth="1.6" />
          <path d="M142 90 Q150 104 143 116" fill="none" stroke={LIME} strokeWidth="2.6" strokeLinecap="round" />
          <path d="M60 104 C58 124 72 136 92 139" fill="none" stroke="#fff" strokeOpacity="0.1" strokeWidth="6" strokeLinecap="round" />
          <path d="M66 132 Q100 146 134 132" fill="none" stroke={LIME} strokeOpacity="0.55" strokeWidth="1.8" />
          <VMark x={100} y={116} s={1.35} u={u} />
          <RingFront cx={100} cy={134} rx={58} ry={12} u={u} />
        </>
      );
    // 4 · Caja blindada abierta rebosando diamantes
    case 4:
      return (
        <>
          <RingBack cx={100} cy={136} rx={62} ry={12} />
          <path d="M72 80 L150 80 L158 50 L80 50Z" fill={u("lid")} stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />
          <path d="M77 76 L146 76 L152 54 L83 54Z" fill="none" stroke={LIME} strokeWidth="2" strokeLinejoin="round" />
          <VMark x={118} y={65} s={0.75} u={u} />
          <path d="M58 88 L72 80 H150 L140 88Z" fill="#050706" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
          <circle cx="100" cy="76" r="36" fill={u("gemglow")} />
          <Gems list={[[76, 62, 30, -22], [124, 60, 34, 18], [100, 54, 40], [146, 72, 20, 26], [58, 74, 16, -28]]} />
          <path d="M140 88 L152 80 V126 L140 136Z" fill="#070908" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
          <rect x="58" y="88" width="82" height="48" rx="4" fill={u("dark")} stroke={INK} strokeWidth="2.6" />
          <path d="M58 92 H140" stroke={LIME} strokeWidth="2.4" />
          <path d="M60 130 V118 M60 130 H72 M138 130 V118 M138 130 H126" stroke={LIME} strokeWidth="2.4" strokeLinecap="round" />
          <rect x="86" y="102" width="26" height="22" rx="3" fill="#060807" stroke={LIME} strokeWidth="1.6" />
          <VMark x={99} y={113} s={0.85} u={u} />
          <RingFront cx={100} cy={136} rx={62} ry={12} u={u} />
        </>
      );
    // 5 · Cofre VANTAGG abierto con montaña de diamantes
    case 5:
      return (
        <>
          <RingBack cx={100} cy={138} rx={68} ry={13} />
          <path d="M52 80 L148 80 L156 42 Q104 30 60 42Z" fill={u("lid")} stroke={INK} strokeWidth="2.8" strokeLinejoin="round" />
          <path d="M58 76 L142 76 L149 46 Q104 36 65 46Z" fill="none" stroke={LIME} strokeWidth="2.2" strokeLinejoin="round" />
          <VMark x={104} y={60} s={1} u={u} />
          <path d="M44 88 L54 80 H148 L156 88Z" fill="#050706" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
          <circle cx="100" cy="76" r="44" fill={u("gemglow")} />
          <Gems list={[[64, 72, 26, -24], [138, 70, 28, 22], [84, 64, 32, -10], [118, 62, 34, 12], [101, 56, 40], [156, 80, 18, 30], [46, 82, 16, -30]]} />
          <rect x="44" y="88" width="112" height="50" rx="6" fill={u("dark")} stroke={INK} strokeWidth="3" />
          <path d="M44 93 H156" stroke={LIME} strokeWidth="2.6" />
          <path d="M62 94 V136 M138 94 V136" stroke={LIME} strokeOpacity="0.85" strokeWidth="2.2" />
          <path d="M46 132 H154" stroke={LIME} strokeOpacity="0.4" strokeWidth="1.6" />
          <VMark x={100} y={114} s={1.6} u={u} />
          <Gems list={[[30, 54, 15, -18], [172, 58, 13, 16]]} />
          <RingFront cx={100} cy={138} rx={68} ry={13} u={u} />
        </>
      );
    // 6 · Lanzamiento aéreo: caja VANTAGG en paracaídas soltando diamantes
    default:
      return (
        <>
          <g stroke={LIME} strokeOpacity="0.22" strokeWidth="3" strokeLinecap="round">
            {[-64, -44, -24, 24, 44, 64].map((a) => (
              <path key={a} d="M100 66 L100 20" transform={`rotate(${a} 100 104)`} />
            ))}
          </g>
          <RingBack cx={100} cy={132} rx={62} ry={12} />
          {/* Cuerdas */}
          <path d="M48 52 L66 84 M74 52 L80 84 M126 52 L120 84 M152 52 L134 84" stroke="#a9c79a" strokeOpacity="0.75" strokeWidth="1.2" />
          {/* Paracaídas */}
          <path d="M48 52 Q100 14 152 52 Q139 44 126 52 Q113 44 100 52 Q87 44 74 52 Q61 44 48 52Z" fill={u("chute")} stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />
          <path d="M74 52 Q80 36 100 33 Q90 42 88 49Z M126 52 Q120 36 100 33 Q110 42 112 49Z" fill="#0a0d0b" opacity="0.5" />
          <path d="M62 42 Q100 22 138 42" fill="none" stroke="#fff" strokeOpacity="0.3" strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="100" cy="100" r="44" fill={u("gemglow")} />
          {/* Caja */}
          <path d="M138 84 L148 78 V120 L138 128Z" fill="#070908" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
          <path d="M62 84 L72 78 H148 L138 84Z" fill="#1d2320" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
          <rect x="62" y="84" width="76" height="44" rx="4" fill={u("dark")} stroke={INK} strokeWidth="2.8" />
          <rect x="67" y="89" width="66" height="34" rx="2" fill="none" stroke={LIME} strokeWidth="2" />
          <VMark x={100} y={106} s={1.3} u={u} />
          <Gems list={[[38, 88, 24, -22], [162, 84, 24, 20], [32, 58, 14, -10], [170, 52, 15, 16], [156, 112, 18, 12, true], [44, 116, 16, -14, true]]} />
          <RingFront cx={100} cy={132} rx={62} ry={12} u={u} />
        </>
      );
  }
}

/** Degradados, filtros y destello que usan las escenas (ids únicos por portada). */
function CoverDefs({ id, glow }: { id: string; glow: number }) {
  return (
    <defs>
      <linearGradient id={`${id}bg`} x1="0" y1="0" x2="0.5" y2="1">
        <stop offset="0" stopColor="#10200f" />
        <stop offset="1" stopColor="#040705" />
      </linearGradient>
      <linearGradient id={`${id}v`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={LIME} stopOpacity="0.42" />
        <stop offset="1" stopColor={LIME} stopOpacity="0.04" />
      </linearGradient>
      <radialGradient id={`${id}glow`} cx="0.5" cy="0.52" r="0.55">
        <stop offset="0" stopColor={LIME} stopOpacity={glow} />
        <stop offset="0.55" stopColor={LIME} stopOpacity={glow / 4} />
        <stop offset="1" stopColor="#000" stopOpacity="0" />
      </radialGradient>
      <radialGradient id={`${id}gemglow`}>
        <stop offset="0" stopColor="#4fc3ff" stopOpacity="0.5" />
        <stop offset="1" stopColor="#4fc3ff" stopOpacity="0" />
      </radialGradient>
      <linearGradient id={`${id}dark`} x1="0" y1="0" x2="0.3" y2="1">
        <stop offset="0" stopColor="#323a36" />
        <stop offset="1" stopColor="#0c100e" />
      </linearGradient>
      <linearGradient id={`${id}lid`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#47524c" />
        <stop offset="1" stopColor="#1b221e" />
      </linearGradient>
      <linearGradient id={`${id}goldcard`} x1="0" y1="0" x2="0.4" y2="1">
        <stop offset="0" stopColor="#5a3a0c" />
        <stop offset="1" stopColor="#1e1303" />
      </linearGradient>
      <linearGradient id={`${id}goldline`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffe9a3" />
        <stop offset="1" stopColor="#e0a019" />
      </linearGradient>
      <linearGradient id={`${id}chute`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={LIME_SOFT} />
        <stop offset="1" stopColor="#5f9a12" />
      </linearGradient>
      <linearGradient id={`${id}ped`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#2d3531" />
        <stop offset="1" stopColor="#141916" />
      </linearGradient>
      <filter id={`${id}soft`} x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="2.6" />
      </filter>
      <path id={`${id}spark`} d="M0 -8 L1.8 -1.8 L8 0 L1.8 1.8 L0 8 L-1.8 1.8 L-8 0 L-1.8 -1.8Z" fill="#fff" />
    </defs>
  );
}


/** Tarjeta de membresía negra con borde lima, chip y la V (centro x, y; ancho; giro). */
function PassCard({ x, y, w, rot = 0, u, days = 0, gold = false }: { x: number; y: number; w: number; rot?: number; u: (n: string) => string; days?: number; gold?: boolean }) {
  const h = w * 0.62;
  const edge = gold ? "#ffcf4a" : LIME;
  return (
    <g transform={`rotate(${rot} ${x} ${y})`}>
      <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={w * 0.08} fill={gold ? u("goldcard") : u("dark")} stroke={INK} strokeWidth="2.6" />
      <rect x={x - w / 2 + 4} y={y - h / 2 + 4} width={w - 8} height={h - 8} rx={w * 0.06} fill="none" stroke={edge} strokeWidth="1.8" />
      <rect x={x - w / 2 + w * 0.1} y={y - h * 0.22} width={w * 0.16} height={h * 0.24} rx="2.5" fill={gold ? "#3b2203" : "#1b221e"} stroke={edge} strokeWidth="1.4" />
      <VMark x={x + w * 0.26} y={y - h * 0.12} s={w / 70} u={u} />
      {/* Días de la membresía: una marca por día */}
      {Array.from({ length: days }, (_, i) => (
        <rect key={i} x={x - w / 2 + w * 0.1 + i * ((w * 0.8) / Math.max(days, 1))} y={y + h * 0.2} width={(w * 0.8) / Math.max(days, 1) - (days > 10 ? 1 : 2.5)} height={h * 0.1} rx="1.2" fill={edge} opacity={0.35 + (0.65 * (i + 1)) / days} />
      ))}
    </g>
  );
}

/** Estrella de cinco puntas (centro x, y; radio exterior). */
function Star({ x, y, r, fill }: { x: number; y: number; r: number; fill: string }) {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const k = i % 2 ? r * 0.45 : r;
    return `${(x + Math.cos(a) * k).toFixed(1)} ${(y + Math.sin(a) * k).toFixed(1)}`;
  });
  return <path d={`M${pts.join(" L")}Z`} fill={fill} stroke="#3b2203" strokeWidth="2.2" strokeLinejoin="round" />;
}

/** Armas Evo: turquesa como el token Evo universal del juego. */
const TEAL = ["#eafeff", "#aef4fb", "#62dcea", "#27b6c8", "#137f92", "#0a4c59", "#05262e"];
const hexPts = (cx: number, cy: number, r: number) => [0, 60, 120, 180, 240, 300].map((a) => [cx + r * Math.cos((a * Math.PI) / 180), cy + r * Math.sin((a * Math.PI) / 180)] as const);
const poly = (pts: ReadonlyArray<readonly [number, number]>) => `M${pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L")}Z`;

/**
 * Fragmento (token) Evo: hexágono turquesa con bisel brillante y un átomo blanco al centro, como el del juego.
 * `face`: id del degradado de la cara (definido en la escena).
 */
function Token({ cx, cy, r, u, face }: { cx: number; cy: number; r: number; u: (n: string) => string; face: string }) {
  const outer = hexPts(cx, cy, r);
  const inner = hexPts(cx, cy, r * 0.78);
  // Bisel: arriba claro (le da la luz), abajo oscuro.
  const shade = [TEAL[4], TEAL[5], TEAL[3], TEAL[2], TEAL[0], TEAL[1]];
  const w = Math.max(1.4, r * 0.085);
  const orbit = (rot: number, color: string, dx = 0, dy = 0) => (
    <ellipse cx={cx + dx} cy={cy + dy} rx={r * 0.5} ry={r * 0.2} fill="none" stroke={color} strokeWidth={w} transform={`rotate(${rot} ${cx + dx} ${cy + dy})`} />
  );
  return (
    <g strokeLinejoin="round">
      <path d={poly(hexPts(cx, cy, r * 1.1))} fill={TEAL[2]} opacity="0.5" filter={u("soft")} />
      {outer.map((p, i) => {
        const q = outer[(i + 1) % 6];
        return <path key={i} d={poly([p, q, inner[(i + 1) % 6], inner[i]])} fill={shade[i]} />;
      })}
      <path d={poly(inner)} fill={`url(#${face})`} />
      {/* Brillo de galaxia en la cara */}
      {[[-0.38, -0.3, 0.05], [0.42, 0.18, 0.04], [-0.2, 0.42, 0.035], [0.3, -0.46, 0.03]].map(([dx, dy, k], i) => (
        <circle key={i} cx={cx + dx * r} cy={cy + dy * r} r={r * k} fill="#fff" opacity="0.55" />
      ))}
      {/* Átomo: sombra y trazo blanco */}
      {[90, 30, -30].map((rot) => (
        <g key={rot}>{orbit(rot, TEAL[6], r * 0.025, r * 0.04)}</g>
      ))}
      {[90, 30, -30].map((rot) => (
        <g key={rot}>{orbit(rot, "#ffffff")}</g>
      ))}
      <circle cx={cx} cy={cy} r={r * 0.1} fill="#fff" />
      <path d={poly(inner)} fill="none" stroke={TEAL[0]} strokeOpacity="0.55" strokeWidth={Math.max(0.8, r * 0.025)} />
      <path d={poly(outer)} fill="none" stroke={INK} strokeWidth={Math.max(1.6, r * 0.05)} />
    </g>
  );
}

/** Escena de las tarjetas y el pase. */
function PassScene({ kind, u }: { kind: PassArt; u: (n: string) => string }): ReactNode {
  switch (kind) {
    // Semanal básica: una tarjeta con sus 7 días
    case "weekly-lite":
      return (
        <>
          <RingBack cx={100} cy={132} rx={56} ry={12} />
          <circle cx="100" cy="92" r="40" fill={u("gemglow")} />
          <PassCard x={100} y={92} w={104} rot={-8} u={u} days={7} />
          <Gems list={[[146, 48, 22, 16], [56, 54, 14, -14]]} />
          <RingFront cx={100} cy={132} rx={56} ry={12} u={u} />
        </>
      );
    // Semanal: tarjeta con sus 7 días y un racimo de diamantes
    case "weekly":
      return (
        <>
          <RingBack cx={100} cy={134} rx={60} ry={12} />
          <circle cx="100" cy="80" r="44" fill={u("gemglow")} />
          <Gems list={[[78, 46, 30, -18], [124, 44, 32, 16], [100, 36, 38]]} />
          <PassCard x={100} y={98} w={110} rot={-6} u={u} days={7} />
          <Gems list={[[160, 66, 16, 18], [40, 72, 13, -14]]} />
          <RingFront cx={100} cy={134} rx={60} ry={12} u={u} />
        </>
      );
    // Mensual: dos tarjetas (la de adelante con sus 30 días) y diamantes dorados
    case "monthly":
      return (
        <>
          <RingBack cx={100} cy={136} rx={64} ry={13} />
          <circle cx="100" cy="84" r="46" fill={u("gemglow")} />
          <PassCard x={112} y={80} w={100} rot={10} u={u} />
          <PassCard x={92} y={100} w={112} rot={-7} u={u} days={30} />
          <Gems list={[[46, 50, 22, -18, true], [156, 50, 24, 16, true], [150, 118, 14, 12]]} />
          <RingFront cx={100} cy={136} rx={64} ry={13} u={u} />
        </>
      );
    // Pase Booyah (básico): pase negro con borde lima y estrella blanca
    case "booyah-basic":
      return (
        <>
          <g stroke={LIME} strokeOpacity="0.22" strokeWidth="3" strokeLinecap="round">
            {[-48, -16, 16, 48].map((a) => (
              <path key={a} d="M100 58 L100 22" transform={`rotate(${a} 100 96)`} />
            ))}
          </g>
          <RingBack cx={100} cy={136} rx={60} ry={12} />
          <PassCard x={100} y={98} w={112} rot={-6} u={u} />
          <Star x={100} y={64} r={22} fill="#f4f7f2" />
          <Gems list={[[46, 72, 16, -16], [156, 76, 16, 16]]} />
          <RingFront cx={100} cy={136} rx={60} ry={12} u={u} />
        </>
      );
    // Pase Booyah Premium Plus: pase dorado con corona y dos estrellas
    case "booyah-plus":
      return (
        <>
          <g stroke="#ffd36b" strokeOpacity="0.28" strokeWidth="3" strokeLinecap="round">
            {[-72, -48, -24, 0, 24, 48, 72].map((a) => (
              <path key={a} d="M100 56 L100 14" transform={`rotate(${a} 100 96)`} />
            ))}
          </g>
          <RingBack cx={100} cy={136} rx={64} ry={13} />
          <PassCard x={112} y={86} w={96} rot={9} u={u} gold />
          <PassCard x={94} y={104} w={112} rot={-6} u={u} gold />
          <g transform="translate(100 52)">
            <path d="M-26 10 L-30 -14 L-14 -2 L0 -22 L14 -2 L30 -14 L26 10Z" fill={u("goldline")} stroke="#3b2203" strokeWidth="2.4" strokeLinejoin="round" />
            <rect x="-27" y="9" width="54" height="8" rx="2" fill={u("goldline")} stroke="#3b2203" strokeWidth="2.2" />
            <circle cx="0" cy="-22" r="3.2" fill="#fff" />
          </g>
          <Star x={44} y={84} r={11} fill={u("goldline")} />
          <Star x={158} y={70} r={13} fill={u("goldline")} />
          <RingFront cx={100} cy={136} rx={64} ry={13} u={u} />
        </>
      );
    // Acceso Evo: emblema hexagonal con un rayo
    case "evo":
      return (
        <>
          <RingBack cx={100} cy={136} rx={58} ry={12} />
          <circle cx="100" cy="88" r="46" fill={u("gemglow")} />
          <path d="M100 38 L142 62 V110 L100 134 L58 110 V62Z" fill={u("dark")} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
          <path d="M100 46 L135 66 V106 L100 126 L65 106 V66Z" fill="none" stroke={LIME} strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M108 56 L80 94 H98 L90 122 L122 80 H103Z" fill={LIME} filter={u("soft")} opacity="0.7" />
          <path d="M108 56 L80 94 H98 L90 122 L122 80 H103Z" fill={LIME_SOFT} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
          <Gems list={[[40, 64, 16, -16], [160, 58, 18, 16]]} />
          <RingFront cx={100} cy={136} rx={58} ry={12} u={u} />
        </>
      );
    // Fragmentos de arma Evo: el token turquesa del juego (hexágono con átomo), con dos más atrás
    case "evo-frag": {
      const face = u("tface").slice(5, -1);
      return (
        <>
          <defs>
            <radialGradient id={face} cx="0.42" cy="0.36" r="0.75">
              <stop offset="0" stopColor="#2cc3d2" />
              <stop offset="0.55" stopColor="#0f7686" />
              <stop offset="1" stopColor="#063943" />
            </radialGradient>
          </defs>
          <RingBack cx={100} cy={136} rx={60} ry={12} />
          <circle cx="100" cy="84" r="58" fill={TEAL[3]} opacity="0.14" />
          <g transform="rotate(-16 50 108)">
            <Token cx={50} cy={108} r={19} u={u} face={face} />
          </g>
          <g transform="rotate(14 152 70)">
            <Token cx={152} cy={70} r={16} u={u} face={face} />
          </g>
          <Token cx={100} cy={84} r={48} u={u} face={face} />
          <use href={`#${u("spark").slice(5, -1)}`} transform="translate(128 44) scale(0.9)" opacity="0.95" />
          <RingFront cx={100} cy={136} rx={60} ry={12} u={u} />
        </>
      );
    }
    // Cajas de fragmentos Evo: el cofre gris del juego (tapa de franjas, luces turquesa y el átomo al frente)
    case "evo-box": {
      const id = (n: string) => u(n).slice(5, -1);
      return (
        <>
          <defs>
            <linearGradient id={id("cbody")} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#415254" />
              <stop offset="1" stopColor="#192224" />
            </linearGradient>
            <linearGradient id={id("clid2")} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#566a6c" />
              <stop offset="1" stopColor="#2a3537" />
            </linearGradient>
            <linearGradient id={id("crib")} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ecf8f8" />
              <stop offset="1" stopColor="#86a4a6" />
            </linearGradient>
          </defs>
          <RingBack cx={100} cy={138} rx={64} ry={12} />
          <circle cx="100" cy="98" r="58" fill={TEAL[3]} opacity="0.14" />
          <ellipse cx="100" cy="137" rx="52" ry="6" fill={TEAL[2]} opacity="0.55" filter={u("soft")} />
          {/* Cuerpo */}
          <rect x="50" y="90" width="100" height="46" rx="5" fill={`url(#${id("cbody")})`} stroke={INK} strokeWidth="2.8" />
          <rect x="62" y="96" width="76" height="33" rx="3" fill="#1e282a" stroke="#0b1213" strokeWidth="1.4" />
          {/* Luces turquesa a los lados y abajo */}
          {[54, 142].map((x) => (
            <g key={x}>
              <rect x={x} y="94" width="4" height="38" rx="2" fill={TEAL[2]} filter={u("soft")} />
              <rect x={x} y="94" width="4" height="38" rx="2" fill={TEAL[1]} />
            </g>
          ))}
          <rect x="62" y="131" width="76" height="2.6" rx="1.3" fill={TEAL[2]} filter={u("soft")} />
          <rect x="62" y="131" width="76" height="2.2" rx="1.1" fill={TEAL[1]} />
          {/* Tapa: franja delantera y franjas acolchadas arriba */}
          {Array.from({ length: 6 }, (_, i) => {
            const x0 = 50 + i * 16.67 + 1;
            const x1 = x0 + 14.7;
            const b0 = 100 + (x0 - 100) * 0.84;
            const b1 = 100 + (x1 - 100) * 0.84;
            return <path key={i} d={`M${x0.toFixed(1)} 75 L${b0.toFixed(1)} 61 C${b0.toFixed(1)} 55 ${b1.toFixed(1)} 55 ${b1.toFixed(1)} 61 L${x1.toFixed(1)} 75Z`} fill={`url(#${id("crib")})`} stroke="#18232a" strokeWidth="1.5" strokeLinejoin="round" />;
          })}
          <rect x="46" y="74" width="108" height="19" rx="4" fill={`url(#${id("clid2")})`} stroke={INK} strokeWidth="2.8" />
          <path d="M52 78 H148" stroke="#ffffff" strokeOpacity="0.18" strokeWidth="1.6" strokeLinecap="round" />
          <rect x="52" y="88.6" width="96" height="2.2" rx="1.1" fill={TEAL[1]} opacity="0.95" />
          {/* Cierre y emblema del átomo */}
          <rect x="94" y="87" width="12" height="9" rx="2" fill="#111a1b" stroke={TEAL[2]} strokeWidth="1.2" />
          <circle cx="100" cy="113" r="13" fill={TEAL[2]} opacity="0.5" filter={u("soft")} />
          <circle cx="100" cy="113" r="11.5" fill="#0c1517" stroke={TEAL[1]} strokeWidth="2" />
          <g fill="none" stroke={TEAL[0]} strokeWidth="1.5">
            {[90, 30, -30].map((rot) => (
              <ellipse key={rot} cx="100" cy="113" rx="7.2" ry="2.7" transform={`rotate(${rot} 100 113)`} />
            ))}
          </g>
          <circle cx="100" cy="113" r="1.6" fill={TEAL[0]} />
          <RingFront cx={100} cy={138} rx={64} ry={12} u={u} />
        </>
      );
    }
    // Paquete de nivel: escudo con flechas hacia arriba
    case "level":
      return (
        <>
          <RingBack cx={100} cy={136} rx={58} ry={12} />
          <circle cx="100" cy="86" r="46" fill={u("gemglow")} />
          <path d="M100 36 L140 50 V88 C140 112 122 126 100 136 C78 126 60 112 60 88 V50Z" fill={u("dark")} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
          <path d="M100 44 L133 56 V88 C133 107 118 119 100 128 C82 119 67 107 67 88 V56Z" fill="none" stroke={LIME} strokeWidth="2.2" strokeLinejoin="round" />
          {[0, 1, 2].map((i) => (
            <path key={i} d={`M80 ${104 - i * 18} L100 ${86 - i * 18} L120 ${104 - i * 18}`} fill="none" stroke={i === 2 ? LIME_SOFT : LIME} strokeOpacity={0.45 + i * 0.27} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
          ))}
          <Gems list={[[42, 70, 16, -16], [158, 64, 18, 16, true]]} />
          <RingFront cx={100} cy={136} rx={58} ry={12} u={u} />
        </>
      );
    // Pase Booyah Premium: pase dorado con estrella
    default:
      return (
        <>
          <g stroke="#ffd36b" strokeOpacity="0.25" strokeWidth="3" strokeLinecap="round">
            {[-60, -36, -12, 12, 36, 60].map((a) => (
              <path key={a} d="M100 58 L100 18" transform={`rotate(${a} 100 96)`} />
            ))}
          </g>
          <RingBack cx={100} cy={136} rx={62} ry={12} />
          <PassCard x={100} y={96} w={116} rot={-6} u={u} gold />
          <g transform="translate(100 64)">
            <path d="M0 -24 L7 -8 L24 -7 L11 4 L15 21 L0 12 L-15 21 L-11 4 L-24 -7 L-7 -8Z" fill={u("goldline")} stroke="#3b2203" strokeWidth="2.4" strokeLinejoin="round" />
            <path d="M0 -14 L3 -5 L-6 -4Z" fill="#fff" opacity="0.6" />
          </g>
          <Gems list={[[44, 70, 18, -16, true], [158, 74, 18, 16, true], [150, 120, 13, 12]]} />
          <RingFront cx={100} cy={136} rx={62} ry={12} u={u} />
        </>
      );
  }
}

/** Qué se dibuja: nivel de diamantes (1–6) o tarjeta/pase. */
export type CoverArtKey = number | PassArt;

/** Nombre del archivo en public/portadas: «paquete-3», «pase-weekly», y «arte-…» para la versión sin fondo. */
export function coverFile(art: CoverArtKey, bare = false): string {
  return `/portadas/${bare ? "arte" : typeof art === "number" ? "paquete" : "pase"}-${art}.svg`;
}

/**
 * La portada completa como SVG independiente (para guardarla como archivo). `bare`: solo el objeto, sin
 * fondo (para banners armados en HTML). `id` prefija los degradados.
 */
export function CoverSvg({ art, bare = false, id = "c" }: { art: CoverArtKey; bare?: boolean; id?: string }) {
  const u = (name: string) => `url(#${id}${name})`;
  const t = typeof art === "number" ? Math.max(1, Math.min(art, 6)) : 0;
  const scale = t ? SCALE[t - 1] : 1.1;
  // Las tarjetas suben un poco: abajo va su nombre en grande.
  const lift = t ? 90 : 78;
  const scene = t ? <Scene t={t} u={u} /> : <PassScene kind={art as PassArt} u={u} />;
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
      <CoverDefs id={id} glow={bare ? 0 : 0.2 + (t || 5) * 0.04} />
      {!bare && (
        <>
          <rect width="200" height="200" fill={u("bg")} />
          {/* La V de la marca, grande detrás de la escena */}
          <path d="M26 -4 H62 L100 86 L138 -4 H174 L108 146 H92Z" fill={u("v")} />
          <rect width="200" height="200" fill={u("glow")} />
          {/* Trazos de velocidad */}
          <g fill={LIME}>
            <path d="M166 58 L198 30 L196 40 L170 62Z" opacity="0.55" />
            <path d="M176 76 L200 56 V62 L180 79Z" opacity="0.3" />
            <path d="M4 112 L34 90 L31 98 L7 117Z" opacity="0.45" />
          </g>
          {/* Nubes oscuras abajo */}
          <g fill="#0d200f" opacity="0.9">
            <circle cx="16" cy="170" r="26" />
            <circle cx="50" cy="180" r="24" />
            <circle cx="160" cy="176" r="26" />
            <circle cx="192" cy="164" r="24" />
          </g>
        </>
      )}
      <g transform={`translate(100 ${lift}) scale(${scale}) translate(-100 -90)`}>{scene}</g>
      {!bare &&
        [[174, 94, 0.9], [28, 92, 0.7], [140, 26, 0.55]].map(([sx, sy, k], i) => <use key={i} href={`#${id}spark`} transform={`translate(${sx} ${sy}) scale(${k})`} opacity="0.9" />)}
    </svg>
  );
}

/** Todas las portadas que se generan como archivo. */
export const COVER_FILES: Array<{ art: CoverArtKey; bare: boolean }> = [
  ...[1, 2, 3, 4, 5, 6].map((t) => ({ art: t, bare: false })),
  ...(["weekly-lite", "weekly", "monthly", "booyah", "booyah-basic", "booyah-plus", "evo", "evo-frag", "evo-box", "level"] as const).map((k) => ({ art: k, bare: false })),
  // Solo el objeto (sin fondo): banners armados en HTML y premios del «Top 3 del mes».
  ...[1, 2, 3, 4, 5, 6].map((t) => ({ art: t, bare: true })),
];
