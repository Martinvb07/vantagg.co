import { cn } from "@/lib/utils";

/** Racimo de cristales facetados de VANTAGG (arte propio, igual estilo que las portadas de los paquetes). */
const PALETTES = {
  ice: { cap: "#effcff", capSide: "#9be9ff", light: "#5fd4f5", dark: "#1a7fb6", line: "#062b40" },
  volt: { cap: "#f7ffd9", capSide: "#e4fb9c", light: "#c8f04f", dark: "#6f8f12", line: "#263304" },
};

/** Cristal: x de la base, y de la base, ancho, alto, inclinación (grados). */
const SHARDS: Array<[number, number, number, number, number]> = [
  [30, 104, 22, 54, -18],
  [92, 104, 24, 60, 16],
  [60, 104, 40, 100, 0],
];

export function Gem({ className, hue = "ice" }: { className?: string; hue?: "ice" | "volt" }) {
  const p = PALETTES[hue];
  return (
    <svg viewBox="0 0 120 110" className={cn("drop-shadow-[0_12px_24px_rgba(0,0,0,0.45)]", className)} aria-hidden>
      {SHARDS.map(([x, y, w, h, deg], i) => {
        const l = x - w / 2;
        const r = x + w / 2;
        const sh = y - h * 0.7;
        const tip = y - h;
        const mid = y - h * 0.62;
        return (
          <g key={i} transform={`rotate(${deg} ${x} ${y})`} strokeLinejoin="round">
            <path d={`M${l} ${sh} L${x} ${mid} L${x} ${y} L${l} ${y - 3}Z`} fill={p.light} />
            <path d={`M${r} ${sh} L${x} ${mid} L${x} ${y} L${r} ${y - 3}Z`} fill={p.dark} />
            <path d={`M${x} ${tip} L${l} ${sh} L${x} ${mid}Z`} fill={p.cap} />
            <path d={`M${x} ${tip} L${r} ${sh} L${x} ${mid}Z`} fill={p.capSide} />
            <path d={`M${l + w * 0.2} ${sh + h * 0.06} L${l + w * 0.32} ${sh + h * 0.02} L${l + w * 0.32} ${y - h * 0.18} L${l + w * 0.2} ${y - h * 0.14}Z`} fill="#fff" opacity="0.55" />
            <path d={`M${x} ${tip} L${r} ${sh} L${r} ${y - 3} L${x} ${y} L${l} ${y - 3} L${l} ${sh}Z`} fill="none" stroke={p.line} strokeWidth="2.4" />
          </g>
        );
      })}
    </svg>
  );
}
