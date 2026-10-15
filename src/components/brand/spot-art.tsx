import { useId } from "react";
import { cn } from "@/lib/utils";

const ROUTE = "M24 64 Q 64 20 108 48 T 196 44 T 292 28";
const STOPS = [
  { x: 24, y: 64, c: "#fbbf24", label: "Pedido" },
  { x: 108, y: 48, c: "#38bdf8", label: "Pago" },
  { x: 196, y: 44, c: "#c8f04f", label: "Proceso" },
  { x: 292, y: 28, c: "#34d399", label: "Entregado" },
];

/** Mapa de ruta del pedido: las 4 paradas reales del seguimiento. */
export function RouteArt({ className }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 320 96" className={cn("overflow-visible", className)} aria-hidden>
      <defs>
        <linearGradient id={`${id}g`} x1="0" x2="1">
          <stop offset="0" stopColor="#fbbf24" />
          <stop offset="0.35" stopColor="#38bdf8" />
          <stop offset="0.65" stopColor="#c8f04f" />
          <stop offset="1" stopColor="#34d399" />
        </linearGradient>
      </defs>
      <path d={ROUTE} fill="none" stroke={`url(#${id}g)`} strokeOpacity="0.55" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="1 7" />
      <g>
        <circle r="9" fill="#ffffff" fillOpacity="0.12" />
        <circle r="3.5" fill="#ffffff" />
        <animateMotion dur="5s" repeatCount="indefinite" path={ROUTE} />
      </g>
      {STOPS.map((s, i) => {
        const last = i === STOPS.length - 1;
        return (
          <g key={s.label}>
            <circle cx={s.x} cy={s.y} r={last ? 13 : 10} fill="#0f1116" stroke={s.c} strokeWidth="2.5" />
            {last ? <path d={`M${s.x - 5} ${s.y} l3.5 3.5 l6.5 -7`} fill="none" stroke={s.c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /> : <circle cx={s.x} cy={s.y} r="3.5" fill={s.c} />}
            <text x={s.x} y={s.y + (last ? 30 : 26)} textAnchor="middle" fontSize="10.5" fontWeight="600" fill="#ffffff" fillOpacity="0.55">
              {s.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Burbujas de conversación + salvavidas: el centro de ayuda. */
export function HelpArt({ className }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 230 112" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#34d399" />
          <stop offset="1" stopColor="#047857" />
        </linearGradient>
      </defs>
      {/* salvavidas */}
      <g transform="translate(40 66) rotate(-18)">
        <circle r="25" fill="none" stroke="#f1f5f9" strokeWidth="11" />
        <circle r="25" fill="none" stroke="#f87171" strokeWidth="11" strokeDasharray="19.6 19.6" />
        <circle r="30.5" fill="none" stroke="#000" strokeOpacity="0.25" strokeWidth="1" />
      </g>
      {/* burbuja principal */}
      <path d="M78 10h86a16 16 0 0 1 16 16v32a16 16 0 0 1-16 16h-58l-16 14v-14h-12a16 16 0 0 1-16-16V26a16 16 0 0 1 16-16Z" fill={`url(#${id}b)`} />
      <text x="121" y="56" textAnchor="middle" fontSize="38" fontWeight="800" fill="#ffffff">?</text>
      {/* respuesta escribiéndose */}
      <path d="M148 62h56a14 14 0 0 1 14 14v8a14 14 0 0 1-14 14h-6v12l-14-12h-36a14 14 0 0 1-14-14v-8a14 14 0 0 1 14-14Z" fill="#1a1d26" stroke="#ffffff" strokeOpacity="0.16" />
      {[164, 176, 188].map((x, i) => (
        <circle key={x} cx={x} cy="80" r="3.5" fill="#ffffff">
          <animate attributeName="fill-opacity" values="0.25;0.9;0.25" dur="1.2s" begin={`${i * 0.2}s`} repeatCount="indefinite" />
        </circle>
      ))}
    </svg>
  );
}
