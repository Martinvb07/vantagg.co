import { useId } from "react";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/money";

/**
 * Portadas originales de los paquetes, estilo tienda de juegos: la escena crece con
 * el paquete (diamante → puñado → montón → bolsa → caja → cofre). Arte vectorial
 * propio; el texto va encima en HTML para que siempre se lea nítido.
 */

/** Nivel visual según la cantidad de diamantes (misma portada en toda la tienda). */
export function tierFor(diamonds: number): number {
  return [200, 450, 800, 1800, 4000].filter((t) => diamonds >= t).length + 1;
}

type G = [x: number, y: number, w: number];

/** Gemas por nivel, en coordenadas 200×200 (de atrás hacia adelante). La esquina superior izquierda queda libre para el texto. */
const GEMS: Record<number, G[]> = {
  1: [[56, 142, 40], [94, 94, 88]],
  2: [[112, 92, 64], [62, 120, 66], [122, 128, 62]],
  3: [[96, 100, 54], [140, 96, 52], [50, 132, 56], [98, 134, 60], [150, 140, 46]],
  4: [[100, 96, 40], [144, 96, 36], [120, 88, 42], [50, 166, 32], [168, 174, 26]],
  5: [[70, 106, 44], [104, 96, 48], [142, 102, 44], [86, 120, 42], [124, 118, 44], [160, 122, 34]],
  6: [[72, 108, 40], [104, 98, 46], [140, 102, 42], [88, 122, 40], [122, 118, 46], [158, 124, 34]],
};

const SPARKS: Record<number, Array<[number, number, number]>> = {
  1: [[176, 84, 1], [70, 128, 0.7], [186, 150, 0.6]],
  2: [[182, 86, 1], [56, 112, 0.7], [188, 160, 0.6]],
  3: [[184, 90, 0.9], [44, 124, 0.7], [190, 170, 0.6]],
  4: [[176, 80, 1], [70, 120, 0.7], [44, 150, 0.6]],
  5: [[186, 92, 1], [56, 98, 0.8], [40, 150, 0.6]],
  6: [[188, 88, 1.1], [52, 100, 0.9], [36, 150, 0.7], [180, 120, 0.6]],
};

export function DiamondCover({ tier, diamonds, bonus = 0, className }: { tier: number; diamonds: number; bonus?: number; className?: string }) {
  const t = Math.max(1, Math.min(tier, 6));
  const id = useId().replace(/:/g, "");
  const u = (name: string) => `url(#${id}${name})`;
  const gold = t === 6;

  return (
    <div className={cn("relative aspect-square overflow-hidden bg-[#071228]", className)} style={{ containerType: "inline-size" }} aria-hidden>
      <svg viewBox="0 0 200 200" className="absolute inset-0 size-full">
        <defs>
          <linearGradient id={`${id}bg`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#0b2257" />
            <stop offset="1" stopColor="#050b1d" />
          </linearGradient>
          <radialGradient id={`${id}spot`} cx="0.62" cy="0.66" r="0.55">
            <stop offset="0" stopColor={gold ? "#ffcf5a" : "#3fb6ff"} stopOpacity={gold ? 0.75 : 0.7} />
            <stop offset="0.5" stopColor={gold ? "#ff8a1f" : "#1d5fd6"} stopOpacity="0.28" />
            <stop offset="1" stopColor="#000" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${id}floor`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor={gold ? "#ffcf5a" : "#3fb6ff"} stopOpacity="0.45" />
            <stop offset="1" stopColor={gold ? "#ffcf5a" : "#3fb6ff"} stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`${id}top`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f2fbff" />
            <stop offset="1" stopColor="#8fd3ff" />
          </linearGradient>
          <linearGradient id={`${id}bag`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#8b5cf6" />
            <stop offset="1" stopColor="#3b0f8c" />
          </linearGradient>
          <linearGradient id={`${id}steel`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2b4b8f" />
            <stop offset="1" stopColor="#13234a" />
          </linearGradient>
          <linearGradient id={`${id}wood`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#9a4f16" />
            <stop offset="1" stopColor="#5a2a08" />
          </linearGradient>
          <linearGradient id={`${id}gold`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffe9a3" />
            <stop offset="1" stopColor="#e0a019" />
          </linearGradient>
          <symbol id={`${id}gem`} viewBox="-3 -3 126 112">
            <path d="M30 8h60l26 30H4Z" fill={u("top")} />
            <path d="M30 8 44 38H4Z" fill="#a9ddff" />
            <path d="M90 8 76 38h40Z" fill="#3f8ff2" />
            <path d="M44 38 60 8l16 30Z" fill="#ecf8ff" />
            <path d="M4 38h40l16 64Z" fill="#4aa8ff" />
            <path d="M44 38h32l-16 64Z" fill="#94d3ff" />
            <path d="M76 38h40L60 102Z" fill="#1d5bd0" />
            <path d="M34 13h16l-5 7H30Z" fill="#fff" />
            <path d="M4 38h112" stroke="#fff" strokeOpacity="0.7" strokeWidth="1.5" />
            <path d="M30 8h60l26 30L60 102 4 38Z" fill="none" stroke="#06205c" strokeWidth="3.5" strokeLinejoin="round" />
          </symbol>
          <path id={`${id}spark`} d="M0 -9 L2.2 -2.2 L9 0 L2.2 2.2 L0 9 L-2.2 2.2 L-9 0 L-2.2 -2.2Z" fill="#fff" />
        </defs>

        <rect width="200" height="200" fill={u("bg")} />
        {/* haces de luz */}
        <g fill="#fff" opacity={gold ? 0.09 : 0.06}>
          <path d="M150 -10 L190 -10 L120 210 L90 210Z" />
          <path d="M200 20 L215 30 L150 210 L132 210Z" />
        </g>
        <rect width="200" height="200" fill={u("spot")} />
        <ellipse cx="122" cy="194" rx="86" ry="16" fill={u("floor")} />

        {/* contenedores detrás de las gemas */}
        {t === 6 && <path d="M66 140 L72 96 C94 82 154 82 176 96 L182 140Z" fill="#3a1a05" stroke={u("gold")} strokeWidth="4" strokeLinejoin="round" />}

        {/* gemas que van dentro/encima del contenedor */}
        {(t === 5 || t === 6 ? GEMS[t] : []).map(([x, y, w], i) => (
          <use key={i} href={`#${id}gem`} x={x} y={y} width={w} height={w * (112 / 126)} />
        ))}

        {t === 4 && (
          <g>
            <path d="M102 120 C90 104 96 92 106 98 L125 108 L144 98 C154 92 160 104 148 120Z" fill={u("bag")} stroke="#1c0548" strokeWidth="3.5" strokeLinejoin="round" />
            {GEMS[4].slice(0, 3).map(([x, y, w], i) => (
              <use key={i} href={`#${id}gem`} x={x} y={y} width={w} height={w * (112 / 126)} />
            ))}
            <path d="M104 124 C70 138 62 196 125 196 C188 196 180 138 146 124Z" fill={u("bag")} stroke="#1c0548" strokeWidth="3.5" strokeLinejoin="round" />
            <path d="M86 156 C88 180 104 190 122 191" fill="none" stroke="#fff" strokeOpacity="0.18" strokeWidth="6" strokeLinecap="round" />
            <rect x="100" y="114" width="50" height="13" rx="6.5" fill={u("gold")} stroke="#7a4a05" strokeWidth="2.5" />
          </g>
        )}
        {t === 5 && (
          <g>
            <rect x="62" y="138" width="126" height="58" rx="6" fill={u("steel")} stroke="#081530" strokeWidth="3.5" />
            <path d="M62 157 H188 M62 176 H188" stroke="#081530" strokeWidth="2.5" />
            <path d="M62 150 v-6 a6 6 0 0 1 6-6 h8 M188 150 v-6 a6 6 0 0 0-6-6 h-8 M62 184 v6 a6 6 0 0 0 6 6 h8 M188 184 v6 a6 6 0 0 1-6 6 h-8" fill="none" stroke={u("gold")} strokeWidth="4" strokeLinecap="round" />
          </g>
        )}
        {t === 6 && (
          <g>
            <rect x="60" y="138" width="128" height="58" rx="8" fill={u("wood")} stroke="#2b1405" strokeWidth="3.5" />
            <path d="M60 156 H188" stroke="#2b1405" strokeWidth="2.5" />
            <rect x="76" y="138" width="9" height="58" fill={u("gold")} />
            <rect x="163" y="138" width="9" height="58" fill={u("gold")} />
            <rect x="113" y="148" width="22" height="26" rx="4" fill={u("gold")} stroke="#7a4a05" strokeWidth="2.5" />
            <circle cx="124" cy="160" r="3.5" fill="#5a2a08" />
          </g>
        )}

        {/* gemas sueltas / que asoman de la bolsa */}
        {(t <= 3 ? GEMS[t] : t === 4 ? GEMS[4].slice(3) : []).map(([x, y, w], i) => (
          <use key={i} href={`#${id}gem`} x={x} y={y} width={w} height={w * (112 / 126)} />
        ))}

        {SPARKS[t].map(([x, y, s], i) => (
          <use key={i} href={`#${id}spark`} transform={`translate(${x} ${y}) scale(${s})`} />
        ))}
      </svg>

      <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/50 to-transparent p-[7%] pb-[14%]">
        <p className="font-display font-bold leading-none tracking-tight text-white drop-shadow" style={{ fontSize: "19cqw" }}>
          {formatNumber(diamonds)}
        </p>
        <p className="mt-[2%] font-semibold uppercase tracking-[0.12em] text-white/80" style={{ fontSize: "6.2cqw" }}>
          Diamantes
        </p>
        {bonus > 0 && (
          <span className="mt-[4%] inline-block rounded-[0.35em] bg-sky-400 px-[0.45em] py-[0.15em] font-bold text-ink-950" style={{ fontSize: "6.4cqw" }}>
            +{formatNumber(bonus)} BONUS
          </span>
        )}
      </div>
    </div>
  );
}
