import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/money";

/**
 * Portadas originales de los paquetes con la identidad de VANTAGG. Cada paquete tiene su propia escena:
 * cristal → racimo → bolsa → caja → cápsula de energía → cofre dorado, sobre fondo grafito con la V
 * de la marca. Arte vectorial propio; la cantidad y el bonus van en HTML encima para que se lean nítidos.
 */

/** Nivel visual según la cantidad de diamantes (misma portada en toda la tienda). */
export function tierFor(diamonds: number): number {
  return [200, 450, 800, 1800, 4000].filter((t) => diamonds >= t).length + 1;
}

/** Cristal: x de la base, y de la base, ancho, alto, inclinación (grados), dorado. */
type Shard = [x: number, y: number, w: number, h: number, deg: number, gold?: boolean];

const PALETTE = {
  ice: { cap: "#effcff", capSide: "#9be9ff", light: "#5fd4f5", dark: "#1a7fb6", line: "#062b40" },
  gold: { cap: "#fffbe0", capSide: "#ffe58a", light: "#ffc93d", dark: "#c27a0c", line: "#3b2203" },
};

function ShardShape({ s }: { s: Shard }) {
  const [x, y, w, h, deg, gold] = s;
  const p = gold ? PALETTE.gold : PALETTE.ice;
  const l = x - w / 2;
  const r = x + w / 2;
  const sh = y - h * 0.7; // hombros
  const tip = y - h;
  const mid = y - h * 0.62; // arista central bajo la punta
  return (
    <g transform={`rotate(${deg} ${x} ${y})`} strokeLinejoin="round">
      <path d={`M${l} ${sh} L${x} ${mid} L${x} ${y} L${l} ${y - 4}Z`} fill={p.light} />
      <path d={`M${r} ${sh} L${x} ${mid} L${x} ${y} L${r} ${y - 4}Z`} fill={p.dark} />
      <path d={`M${x} ${tip} L${l} ${sh} L${x} ${mid}Z`} fill={p.cap} />
      <path d={`M${x} ${tip} L${r} ${sh} L${x} ${mid}Z`} fill={p.capSide} />
      <path d={`M${l + w * 0.2} ${sh + h * 0.06} L${l + w * 0.32} ${sh + h * 0.02} L${l + w * 0.32} ${y - h * 0.18} L${l + w * 0.2} ${y - h * 0.14}Z`} fill="#fff" opacity="0.55" />
      <path d={`M${x} ${tip} L${r} ${sh} L${r} ${y - 4} L${x} ${y} L${l} ${y - 4} L${l} ${sh}Z`} fill="none" stroke={p.line} strokeWidth="2.6" />
    </g>
  );
}

const Shards = ({ list }: { list: Shard[] }) => (
  <>
    {list.map((s, i) => (
      <ShardShape key={i} s={s} />
    ))}
  </>
);

/** Color del resplandor de cada paquete (distinto en cada uno). */
const GLOW = ["#5fd4f5", "#3fe0c8", "#c8f04f", "#c8f04f", "#a78bfa", "#ffcc4d"];

/** Escena de cada paquete. `u` resuelve los degradados definidos en <defs>. */
function Scene({ t, u, id }: { t: number; u: (n: string) => string; id: string }): ReactNode {
  switch (t) {
    // 1 · Cristal sobre una roca
    case 1:
      return (
        <>
          <path d="M84 150 L100 134 L130 130 L156 136 L168 150 L124 158Z" fill={u("rock")} stroke="#0a0d11" strokeWidth="2.5" strokeLinejoin="round" />
          <Shards list={[[102, 140, 16, 38, -20], [146, 140, 13, 28, 18], [124, 138, 36, 96, 0]]} />
          <g transform="translate(76 66) scale(0.55)">
            <ShardShape s={[0, 20, 16, 36, -16]} />
          </g>
        </>
      );
    // 2 · Racimo de cristales
    case 2:
      return (
        <>
          <path d="M60 150 L78 130 L110 124 L150 126 L180 134 L190 150 L122 160Z" fill={u("rock")} stroke="#0a0d11" strokeWidth="2.5" strokeLinejoin="round" />
          <Shards list={[[72, 146, 14, 32, -30], [176, 147, 14, 32, 28], [96, 140, 24, 64, -16], [150, 140, 26, 70, 14], [122, 136, 38, 104, 0]]} />
        </>
      );
    // 3 · Bolsa VANTAGG con cristales asomando
    case 3:
      return (
        <>
          <Shards list={[[104, 106, 17, 40, -20], [142, 106, 17, 42, 20], [123, 104, 24, 58, 0]]} />
          <path d="M86 106 C66 122 60 172 123 174 C186 172 180 122 160 106Z" fill={u("bag")} stroke="#05070a" strokeWidth="3" strokeLinejoin="round" />
          <path d="M80 112 Q123 96 166 112" fill="none" stroke="#c8f04f" strokeWidth="6" strokeLinecap="round" />
          <circle cx="166" cy="112" r="4.5" fill="#c8f04f" />
          <path d="M156 116 Q162 132 158 140" fill="none" stroke="#c8f04f" strokeWidth="3" strokeLinecap="round" />
          <path d="M108 132 L123 156 L138 132" fill="none" stroke="#c8f04f" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M80 140 C80 158 92 168 108 170" fill="none" stroke="#fff" strokeOpacity="0.12" strokeWidth="6" strokeLinecap="round" />
        </>
      );
    // 4 · Caja abierta rebosando cristales
    case 4:
      return (
        <>
          <path d="M80 120 L166 120 L178 84 L94 84Z" fill="#1a2028" stroke="#05070a" strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M100 92 L172 92" stroke="#c8f04f" strokeOpacity="0.6" strokeWidth="3" />
          <Shards list={[[94, 126, 20, 52, -16], [148, 126, 24, 62, 12], [168, 128, 14, 32, 26], [120, 124, 30, 84, -2]]} />
          <path d="M166 122 L182 112 L182 160 L166 172Z" fill="#11151b" stroke="#05070a" strokeWidth="2.5" strokeLinejoin="round" />
          <rect x="74" y="122" width="92" height="50" rx="3" fill={u("crate")} stroke="#05070a" strokeWidth="2.5" />
          <path d="M74 122 H166" stroke="#c8f04f" strokeWidth="3" />
          {/* franjas de advertencia */}
          <g clipPath={`url(#${id}cratefront)`}>
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <path key={i} d={`M${70 + i * 16} 172 L${82 + i * 16} 158 L${90 + i * 16} 158 L${78 + i * 16} 172Z`} fill="#c8f04f" opacity="0.85" />
            ))}
          </g>
          <rect x="108" y="132" width="24" height="16" rx="2" fill="#0b0f14" stroke="#c8f04f" strokeWidth="2" />
          <path d="M113 136 L120 144 L127 136" fill="none" stroke="#c8f04f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    // 5 · Cápsula de energía con cristales dentro
    case 5:
      return (
        <>
          <ellipse cx="123" cy="164" rx="52" ry="11" fill="#11151b" stroke="#05070a" strokeWidth="2.5" />
          <ellipse cx="123" cy="160" rx="52" ry="11" fill={u("ped")} stroke="#a78bfa" strokeOpacity="0.9" strokeWidth="2.4" />
          <ellipse cx="123" cy="92" rx="56" ry="13" fill="none" stroke="#a78bfa" strokeOpacity="0.4" strokeWidth="2" strokeDasharray="6 5" />
          <rect x="91" y="50" width="64" height="110" rx="30" fill="#fff" fillOpacity="0.05" />
          <Shards list={[[108, 156, 18, 52, -10], [140, 156, 18, 48, 12], [124, 154, 28, 86, 0]]} />
          <rect x="91" y="50" width="64" height="110" rx="30" fill="none" stroke="#c9f4ff" strokeOpacity="0.55" strokeWidth="2.5" />
          <path d="M101 70 V140" stroke="#fff" strokeOpacity="0.35" strokeWidth="4" strokeLinecap="round" />
          <rect x="99" y="40" width="48" height="14" rx="5" fill="#1a2028" stroke="#05070a" strokeWidth="2.5" />
          <rect x="112" y="44" width="22" height="5" rx="2.5" fill="#a78bfa" />
          <path d="M67 122 A56 13 0 0 0 179 122" fill="none" stroke="#a78bfa" strokeOpacity="0.85" strokeWidth="2.4" />
        </>
      );
    // 6 · Cofre con cristales dorados
    default:
      return (
        <>
          <g stroke="#ffd36b" strokeOpacity="0.32" strokeWidth="3" strokeLinecap="round">
            {[-60, -40, -20, 0, 20, 40, 60].map((a) => (
              <path key={a} d="M122 64 L122 18" transform={`rotate(${a} 122 96)`} />
            ))}
          </g>
          <path d="M70 122 L174 122 L180 86 Q122 66 64 86Z" fill="#2b1405" stroke={u("goldline")} strokeWidth="3.5" strokeLinejoin="round" />
          <Shards list={[[82, 128, 14, 32, -30], [166, 128, 14, 34, 28], [100, 124, 22, 60, -16, true], [146, 124, 24, 64, 14, true], [122, 120, 32, 90, 0, true]]} />
          <rect x="66" y="122" width="112" height="50" rx="6" fill={u("wood")} stroke="#2b1405" strokeWidth="3" />
          <path d="M66 138 H178" stroke="#2b1405" strokeWidth="2.5" />
          <rect x="80" y="122" width="9" height="50" fill={u("goldline")} />
          <rect x="155" y="122" width="9" height="50" fill={u("goldline")} />
          <rect x="111" y="130" width="22" height="26" rx="4" fill={u("goldline")} stroke="#7a4a05" strokeWidth="2.5" />
          <circle cx="122" cy="142" r="3.5" fill="#5a2a08" />
        </>
      );
  }
}

/** `plain`: solo la ilustración, sin cantidad ni bonus (p. ej. la imagen del producto en /recargas). */
export function DiamondCover({ tier, diamonds, bonus = 0, plain = false, className }: { tier: number; diamonds: number; bonus?: number; plain?: boolean; className?: string }) {
  const t = Math.max(1, Math.min(tier, 6));
  const id = useId().replace(/:/g, "");
  const u = (name: string) => `url(#${id}${name})`;
  const glow = GLOW[t - 1];

  return (
    <div className={cn("relative aspect-square overflow-hidden bg-[#0b0f14]", className)} style={{ containerType: "inline-size" }} aria-hidden>
      <svg viewBox="0 0 200 200" className="absolute inset-0 size-full">
        <defs>
          <linearGradient id={`${id}bg`} x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0" stopColor="#161c24" />
            <stop offset="1" stopColor="#090c10" />
          </linearGradient>
          <radialGradient id={`${id}glow`} cx="0.6" cy="0.58" r="0.5">
            <stop offset="0" stopColor={glow} stopOpacity="0.36" />
            <stop offset="0.6" stopColor={glow} stopOpacity="0.08" />
            <stop offset="1" stopColor="#000" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`${id}rock`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3a4452" />
            <stop offset="1" stopColor="#1b2028" />
          </linearGradient>
          <linearGradient id={`${id}ped`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#262e39" />
            <stop offset="1" stopColor="#11151b" />
          </linearGradient>
          <linearGradient id={`${id}bag`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#323a46" />
            <stop offset="1" stopColor="#12161c" />
          </linearGradient>
          <linearGradient id={`${id}crate`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2a313c" />
            <stop offset="1" stopColor="#161a21" />
          </linearGradient>
          <linearGradient id={`${id}wood`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#9a4f16" />
            <stop offset="1" stopColor="#5a2a08" />
          </linearGradient>
          <linearGradient id={`${id}goldline`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffe9a3" />
            <stop offset="1" stopColor="#e0a019" />
          </linearGradient>
          <clipPath id={`${id}cratefront`}>
            <rect x="74" y="122" width="92" height="50" rx="3" />
          </clipPath>
          <pattern id={`${id}hatch`} width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)">
            <rect width="1.2" height="9" fill="#fff" fillOpacity="0.035" />
          </pattern>
          <path id={`${id}spark`} d="M0 -8 L1.8 -1.8 L8 0 L1.8 1.8 L0 8 L-1.8 1.8 L-8 0 L-1.8 -1.8Z" fill="#fff" />
        </defs>

        <rect width="200" height="200" fill={u("bg")} />
        <rect width="200" height="200" fill={u("hatch")} />
        {/* La V de la marca, grande y tenue detrás de la escena */}
        <path d="M58 6 L122 128 L186 6" fill="none" stroke="#c8f04f" strokeOpacity="0.07" strokeWidth="26" strokeLinejoin="miter" />
        <rect width="200" height="200" fill={u("glow")} />

        {/* Subida un poco para que la cantidad de abajo no tape la escena */}
        <g transform="translate(4 -18)">
          <Scene t={t} u={u} id={id} />
        </g>

        {/* Destellos */}
        {[[178, 92, 1], [72, 90, 0.7], [150, 40, 0.55]].map(([sx, sy, k], i) => (
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
