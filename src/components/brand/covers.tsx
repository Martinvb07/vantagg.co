import { useId } from "react";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/money";

/**
 * Portadas originales de los paquetes con la identidad de VANTAGG: cristales facetados sobre fondo
 * grafito con la V de la marca. La escena crece con el paquete (cristales sueltos → racimo → roca →
 * pedestal → anillo de energía → corona dorada). Arte vectorial propio; el texto va en HTML encima.
 */

/** Nivel visual según la cantidad de diamantes (misma portada en toda la tienda). */
export function tierFor(diamonds: number): number {
  return [200, 450, 800, 1800, 4000].filter((t) => diamonds >= t).length + 1;
}

/** Cristal: x de la base, y de la base, ancho, alto, inclinación (grados), dorado. */
type Shard = [x: number, y: number, w: number, h: number, deg: number, gold?: boolean];

const SHARDS: Record<number, Shard[]> = {
  1: [[96, 140, 18, 42, -18], [148, 141, 16, 36, 16], [122, 140, 32, 84, 0]],
  2: [[74, 144, 13, 30, -30], [94, 141, 24, 60, -16], [150, 141, 24, 64, 14], [122, 139, 36, 96, 0]],
  3: [[70, 140, 18, 44, -28], [170, 141, 16, 40, 26], [95, 137, 26, 72, -14], [149, 137, 28, 76, 12], [122, 134, 38, 104, 0]],
  4: [[74, 132, 18, 46, -26], [168, 133, 17, 42, 24], [97, 129, 27, 74, -13], [148, 129, 29, 80, 11], [122, 126, 40, 108, 0]],
  5: [[68, 132, 19, 50, -28], [174, 133, 18, 46, 26], [94, 128, 29, 80, -14], [151, 128, 31, 86, 12], [122, 124, 44, 116, 0]],
  6: [[68, 134, 19, 50, -28], [176, 135, 18, 46, 26], [94, 130, 30, 82, -14, true], [152, 130, 32, 88, 12, true], [122, 126, 46, 120, 0, true]],
};

/** Cristales flotando (niveles altos): x, y, tamaño. */
const FLOATERS: Record<number, Array<[number, number, number]>> = {
  5: [[60, 62, 0.8], [182, 70, 0.65], [170, 30, 0.5]],
  6: [[56, 58, 0.85], [186, 66, 0.7], [176, 26, 0.55], [70, 24, 0.45]],
};

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
      {/* brillo */}
      <path d={`M${l + w * 0.2} ${sh + h * 0.06} L${l + w * 0.32} ${sh + h * 0.02} L${l + w * 0.32} ${y - h * 0.18} L${l + w * 0.2} ${y - h * 0.14}Z`} fill="#fff" opacity="0.55" />
      <path d={`M${x} ${tip} L${r} ${sh} L${r} ${y - 4} L${x} ${y} L${l} ${y - 4} L${l} ${sh}Z`} fill="none" stroke={p.line} strokeWidth="2.6" />
    </g>
  );
}

/** `plain`: solo la ilustración, sin cantidad ni bonus (p. ej. la imagen del producto en /recargas). */
export function DiamondCover({ tier, diamonds, bonus = 0, plain = false, className }: { tier: number; diamonds: number; bonus?: number; plain?: boolean; className?: string }) {
  const t = Math.max(1, Math.min(tier, 6));
  const id = useId().replace(/:/g, "");
  const u = (name: string) => `url(#${id}${name})`;
  const gold = t === 6;
  const glow = gold ? "#ffcc4d" : "#c8f04f";

  return (
    <div className={cn("relative aspect-square overflow-hidden bg-[#0b0f14]", className)} style={{ containerType: "inline-size" }} aria-hidden>
      <svg viewBox="0 0 200 200" className="absolute inset-0 size-full">
        <defs>
          <linearGradient id={`${id}bg`} x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0" stopColor="#161c24" />
            <stop offset="1" stopColor="#090c10" />
          </linearGradient>
          <radialGradient id={`${id}glow`} cx="0.6" cy="0.62" r="0.5">
            <stop offset="0" stopColor={glow} stopOpacity={gold ? 0.42 : 0.3} />
            <stop offset="0.55" stopColor={gold ? "#ff8a1f" : "#2bb7e0"} stopOpacity="0.12" />
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
          <pattern id={`${id}hatch`} width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)">
            <rect width="1.2" height="9" fill="#fff" fillOpacity="0.035" />
          </pattern>
          <path id={`${id}spark`} d="M0 -8 L1.8 -1.8 L8 0 L1.8 1.8 L0 8 L-1.8 1.8 L-8 0 L-1.8 -1.8Z" fill="#fff" />
        </defs>

        <rect width="200" height="200" fill={u("bg")} />
        <rect width="200" height="200" fill={u("hatch")} />
        {/* La V de la marca, grande y tenue detrás de la escena */}
        <path d="M58 6 L122 128 L186 6" fill="none" stroke="#c8f04f" strokeOpacity={gold ? 0.05 : 0.08} strokeWidth="26" strokeLinejoin="miter" />
        <rect width="200" height="200" fill={u("glow")} />

        {/* Corona de rayos (nivel máximo) */}
        {gold && (
          <g stroke="#ffd36b" strokeOpacity="0.35" strokeWidth="3" strokeLinecap="round">
            {[-60, -40, -20, 0, 20, 40, 60].map((a) => (
              <path key={a} d="M122 70 L122 22" transform={`rotate(${a} 122 96)`} />
            ))}
          </g>
        )}

        {/* Anillo de energía detrás (niveles 5 y 6) */}
        {t >= 5 && <ellipse cx="122" cy="118" rx="70" ry="18" fill="none" stroke={glow} strokeOpacity="0.35" strokeWidth="2" strokeDasharray="6 5" />}

        {/* Base: roca (3), pedestal hexagonal con borde de la marca (4+) */}
        {t === 3 && <path d="M54 146 L74 128 L104 124 L150 126 L180 136 L188 150 L120 158 L60 154Z" fill={u("rock")} stroke="#0a0d11" strokeWidth="2.5" strokeLinejoin="round" />}
        {t >= 4 && (
          <g>
            <path d="M58 128 L88 116 L156 116 L186 128 L186 146 L156 158 L88 158 L58 146Z" fill={u("ped")} stroke="#05070a" strokeWidth="2.5" strokeLinejoin="round" />
            <path d="M58 128 L88 140 L156 140 L186 128" fill="none" stroke={glow} strokeOpacity="0.85" strokeWidth="2.2" strokeLinejoin="round" />
            <path d="M88 140 V158 M156 140 V158" stroke="#05070a" strokeWidth="2" />
          </g>
        )}

        {/* Cristales */}
        {SHARDS[t].map((s, i) => (
          <ShardShape key={i} s={s} />
        ))}

        {/* Frente del anillo de energía */}
        {t >= 5 && <path d="M52 118 A70 18 0 0 0 192 118" fill="none" stroke={glow} strokeOpacity="0.8" strokeWidth="2.4" />}

        {/* Cristales flotando */}
        {(FLOATERS[t] ?? []).map(([fx, fy, k], i) => (
          <g key={i} transform={`translate(${fx} ${fy}) scale(${k})`}>
            <ShardShape s={[0, 14, 14, 30, i % 2 ? 18 : -14, gold && i === 0]} />
          </g>
        ))}

        {/* Destellos */}
        {[[178, 92, 1], [72, 90, 0.7], [150, 46, 0.55]].map(([sx, sy, k], i) => (
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
