import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * Insignias ORIGINALES del «Top 3 del mes» (identidad VANTAGG: negro, borde lima y gemas talladas como las portadas).
 *  1 · Campeón: escudo con alas grandes, corona y gema dorada; tres destellos.
 *  2 · Subcampeón: escudo con alas cortas y gema azul; dos destellos.
 *  3 · Tercer lugar: escudo con gema verde lima; un destello.
 *  4+ · Perseguidores: escudo sencillo con el número.
 */

const GEMS = {
  gold: ["#fff7d1", "#ffe37d", "#ffc63a", "#ee9c18", "#bd6b0b"],
  ice: ["#e3f9ff", "#98e1ff", "#52bbff", "#2d84f0", "#1a52c4"],
  lime: ["#f6ffd6", "#dcff7a", "#b9f43c", "#7fb51c", "#4d7a0c"],
} as const;

/** Gema tallada centrada en (cx, top) de ancho w. */
function Gem({ cx, top, w, c }: { cx: number; top: number; w: number; c: readonly string[] }) {
  const h = w * 0.86;
  const y1 = top + h * 0.3;
  const tip = top + h;
  const [t1, t2] = [cx - w * 0.27, cx + w * 0.27];
  const [gl, g1, g2, gr] = [cx - w / 2, cx - w / 6, cx + w / 6, cx + w / 2];
  return (
    <g strokeLinejoin="round">
      <path d={`M${t1} ${top} L${gl} ${y1} L${g1} ${y1}Z`} fill={c[2]} />
      <path d={`M${t1} ${top} L${cx} ${top} L${g1} ${y1}Z`} fill={c[0]} />
      <path d={`M${cx} ${top} L${g1} ${y1} L${g2} ${y1}Z`} fill={c[1]} />
      <path d={`M${cx} ${top} L${t2} ${top} L${g2} ${y1}Z`} fill={c[2]} />
      <path d={`M${t2} ${top} L${gr} ${y1} L${g2} ${y1}Z`} fill={c[3]} />
      <path d={`M${gl} ${y1} L${g1} ${y1} L${cx} ${tip}Z`} fill={c[2]} />
      <path d={`M${g1} ${y1} L${g2} ${y1} L${cx} ${tip}Z`} fill={c[1]} />
      <path d={`M${g2} ${y1} L${gr} ${y1} L${cx} ${tip}Z`} fill={c[4]} />
      <path d={`M${t1} ${top} L${t2} ${top} L${gr} ${y1} L${cx} ${tip} L${gl} ${y1}Z`} fill="none" stroke="#030504" strokeWidth="1.1" />
    </g>
  );
}

/** Ala de tres plumas (lado izquierdo; el derecho se refleja). */
function Wing({ big, fill }: { big: boolean; fill: string }) {
  return big ? (
    <g fill={fill} stroke="#030504" strokeWidth="1" strokeLinejoin="round">
      <path d="M17 20 C9 18 3 13 1 7 C7 9 13 11 18 14Z" />
      <path d="M16 27 C7 27 1 23 -1 17 C6 19 12 21 17 22Z" />
      <path d="M16 34 C8 35 3 32 1 27 C7 28 12 29 17 30Z" />
    </g>
  ) : (
    <g fill={fill} stroke="#030504" strokeWidth="1" strokeLinejoin="round">
      <path d="M16 24 C9 23 5 19 4 14 C9 16 13 18 17 20Z" />
      <path d="M16 31 C9 31 5 28 4 24 C9 25 13 26 17 27Z" />
    </g>
  );
}

function Spark({ x, y, s = 1, fill }: { x: number; y: number; s?: number; fill: string }) {
  return <path d="M0 -4L0.9 -0.9L4 0L0.9 0.9L0 4L-0.9 0.9L-4 0L-0.9 -0.9Z" transform={`translate(${x} ${y}) scale(${s})`} fill={fill} />;
}

const SHIELD = "M32 9 L50 15 V31 C50 43 42 51 32 56 C22 51 14 43 14 31 V15 Z";

export function TopBadge({ pos, className }: { pos: number; className?: string }) {
  const uid = useId().replace(/:/g, "");
  const u = (n: string) => `url(#${n}${uid})`;
  const tier = pos === 1 ? "gold" : pos === 2 ? "ice" : pos === 3 ? "lime" : null;
  return (
    <svg viewBox="0 0 64 64" className={cn("size-12 shrink-0", className)} aria-hidden>
      <defs>
        <linearGradient id={`body${uid}`} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor="#3a443e" />
          <stop offset="1" stopColor="#0a0e0c" />
        </linearGradient>
        <linearGradient id={`wing${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ecffb0" />
          <stop offset="1" stopColor="#7fb51c" />
        </linearGradient>
        <linearGradient id={`crown${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff1b0" />
          <stop offset="1" stopColor="#e3a21a" />
        </linearGradient>
        <radialGradient id={`aura${uid}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={pos === 1 ? "#ffd75a" : pos === 2 ? "#52bbff" : "#b9f43c"} stopOpacity=".45" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
      </defs>

      {tier && <circle cx="32" cy="32" r="30" fill={u("aura")} />}

      {/* Alas (1 y 2) */}
      {(pos === 1 || pos === 2) && (
        <>
          <Wing big={pos === 1} fill={u("wing")} />
          <g transform="translate(64 0) scale(-1 1)">
            <Wing big={pos === 1} fill={u("wing")} />
          </g>
        </>
      )}

      {/* Escudo negro con borde lima (como los objetos de las portadas) */}
      <path d={SHIELD} fill={u("body")} stroke="#030504" strokeWidth="4" strokeLinejoin="round" />
      <path d={SHIELD} fill="none" stroke={tier ? "#b9f43c" : "#6b7a70"} strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M32 13.5 L46 18.3 V31 C46 40.5 40 47 32 51.3 C24 47 18 40.5 18 31 V18.3 Z" fill="none" stroke={tier ? "#b9f43c" : "#6b7a70"} strokeOpacity=".3" strokeWidth="1" />

      {/* Corona (1) */}
      {pos === 1 && (
        <path d="M22 9 L25.5 1.5 L29 7 L32 0 L35 7 L38.5 1.5 L42 9 Z" fill={u("crown")} stroke="#030504" strokeWidth="1.2" strokeLinejoin="round" />
      )}

      {tier ? (
        <>
          <Gem cx={32} top={pos === 1 ? 20 : 21} w={pos === 1 ? 22 : 20} c={GEMS[tier]} />
          {/* Destellos: 3, 2 o 1 según el puesto */}
          {(pos === 1 ? [24, 32, 40] : pos === 2 ? [28, 36] : [32]).map((x) => (
            <Spark key={x} x={x} y={46} s={0.8} fill="#b9f43c" />
          ))}
          <Spark x={44} y={19} s={0.7} fill="#ffffff" />
        </>
      ) : (
        <text x="32" y="38" textAnchor="middle" fontFamily='"Arial Black", Arial, sans-serif' fontWeight="900" fontStyle="italic" fontSize="17" fill="#c9d3cc">
          {pos}
        </text>
      )}
    </svg>
  );
}
