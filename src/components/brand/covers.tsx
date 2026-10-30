import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/money";

/**
 * Portadas originales de los paquetes con la identidad de VANTAGG: fondo negro verdoso con la V verde lima
 * detrás, diamantes azules tallados y objetos negros con bordes verde lima sobre un anillo de energía.
 * Cada paquete sube de nivel: diamante → racimo → bolsa → caja → cofre → lanzamiento aéreo.
 * Arte vectorial propio; la cantidad y el bonus van en HTML encima para que se lean nítidos.
 */

/** Nivel visual según la cantidad de diamantes (misma portada en toda la tienda). */
export function tierFor(diamonds: number): number {
  return [200, 450, 800, 1800, 4000].filter((t) => diamonds >= t).length + 1;
}

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

/** Escena de cada paquete. `u` resuelve los degradados y filtros definidos en <defs>. */
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

/** `plain`: solo la ilustración, sin cantidad ni bonus. */
export function DiamondCover({ tier, diamonds, bonus = 0, plain = false, className }: { tier: number; diamonds: number; bonus?: number; plain?: boolean; className?: string }) {
  const t = Math.max(1, Math.min(tier, 6));
  const id = useId().replace(/:/g, "");
  const u = (name: string) => `url(#${id}${name})`;
  const glow = 0.2 + t * 0.04;

  return (
    <div className={cn("relative aspect-square overflow-hidden bg-[#060a07]", className)} style={{ containerType: "inline-size" }} aria-hidden>
      <svg viewBox="0 0 200 200" className="absolute inset-0 size-full">
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

        <g transform={`translate(100 90) scale(${SCALE[t - 1]}) translate(-100 -90)`}>
          <Scene t={t} u={u} />
        </g>

        {/* Destellos */}
        {[[174, 94, 0.9], [28, 92, 0.7], [140, 26, 0.55]].map(([sx, sy, k], i) => (
          <use key={i} href={`#${id}spark`} transform={`translate(${sx} ${sy}) scale(${k})`} opacity="0.9" />
        ))}
      </svg>

      {/* Bonus: etiqueta verde de la marca, arriba a la izquierda */}
      {!plain && bonus > 0 && (
        <span
          className="absolute left-[6%] top-[6%] bg-[#c8f04f] px-[0.55em] py-[0.2em] font-display font-black italic leading-none text-[#0b0f14]"
          style={{ fontSize: "6.6cqw", clipPath: "polygon(0 0, 100% 0, 92% 100%, 0 100%)" }}
        >
          +{formatNumber(bonus)} BONUS
        </span>
      )}

      {/* Cantidad abajo, sobre un degradado para que siempre se lea */}
      {!plain && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/45 to-transparent px-[7%] pb-[6%] pt-[16%]">
          <p className="font-display font-black italic leading-none tracking-tight text-white" style={{ fontSize: "18cqw" }}>
            {formatNumber(diamonds)}
          </p>
          <p className="mt-[2.5%] flex items-center gap-[0.4em] font-bold uppercase tracking-[0.16em] text-[#c8f04f]" style={{ fontSize: "5.6cqw" }}>
            <span className="inline-block h-[0.18em] w-[1.2em] bg-[#c8f04f]" />
            Diamantes
          </p>
        </div>
      )}
    </div>
  );
}
