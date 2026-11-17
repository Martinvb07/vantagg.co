/* eslint-disable @next/next/no-img-element */
/**
 * Decoración de Navidad para la tienda: una instalación de luces de colores arriba (titilan) y nieve suave cayendo.
 * Va encima del diseño (sin tocar nada) y solo se dibuja en temporada (ver src/domain/season.ts). El gorro del logo y
 * el regalo de las portadas son piezas «navidad-only» (globals.css). Con «reducir movimiento» no hay animaciones.
 */

const COLORS = ["#ff4d5e", "#ffc63a", "#b9f43c", "#62dcea", "#ff8fd0"];
const STEP = 120;
const WIDTH = 2400;
const TOP = 3;
const SAG = 9;

/** Bombillos sobre el cable: tres por cada tramo que cuelga entre dos ganchos. */
const BULBS = (() => {
  const out: Array<{ x: number; y: number; r: number; c: number }> = [];
  let k = 0;
  for (let x = 0; x < WIDTH; x += STEP) {
    for (const t of [0.22, 0.5, 0.78]) {
      out.push({ x: x + STEP * t, y: TOP + 2 * (1 - t) * t * SAG * 2, r: (t - 0.5) * 36, c: k++ % COLORS.length });
    }
  }
  return out;
})();
const WIRE = Array.from({ length: WIDTH / STEP }, (_, i) => `Q${i * STEP + STEP / 2} ${TOP + SAG * 2} ${(i + 1) * STEP} ${TOP}`).join("");

export function ChristmasLights({ className }: { className?: string }) {
  return (
    <div aria-hidden className={className}>
      <svg viewBox={`0 0 ${WIDTH} 34`} preserveAspectRatio="xMidYMin slice" className="block h-[30px] w-full sm:h-[34px]">
        <defs>
          {COLORS.map((c, i) => (
            <radialGradient key={c} id={`xmas-glow-${i}`}>
              <stop offset="0" stopColor={c} stopOpacity="0.55" />
              <stop offset="1" stopColor={c} stopOpacity="0" />
            </radialGradient>
          ))}
        </defs>
        <path d={`M0 ${TOP}${WIRE}`} fill="none" stroke="#2a3530" strokeWidth="1.6" />
        {BULBS.map((b, i) => (
          <g key={i} transform={`translate(${b.x.toFixed(1)} ${b.y.toFixed(1)}) rotate(${b.r.toFixed(1)})`}>
            <rect x="-2.2" y="-1" width="4.4" height="4.4" rx="1" fill="#26302b" />
            <g className="xmas-bulb" style={{ animationDelay: `${-(i % 3) * 0.8}s` }}>
              <circle cx="0" cy="9" r="10" fill={`url(#xmas-glow-${b.c})`} />
              <ellipse cx="0" cy="9" rx="3.6" ry="5.4" fill={COLORS[b.c]} />
              <ellipse cx="-1.2" cy="7" rx="1" ry="1.8" fill="#fff" opacity="0.6" />
            </g>
          </g>
        ))}
      </svg>
    </div>
  );
}

/** Copos de nieve: posiciones fijas (iguales en el servidor y en el navegador), la mitad se ocultan en el celular. */
const FLAKES = Array.from({ length: 26 }, (_, i) => ({
  left: (i * 37 + 11) % 100,
  size: 3 + ((i * 7) % 4),
  duration: 11 + ((i * 13) % 9),
  delay: -((i * 17) % 19),
  drift: (i % 2 ? 1 : -1) * (12 + ((i * 5) % 22)),
  opacity: 0.45 + ((i * 3) % 4) * 0.1,
}));

export function ChristmasDecor() {
  return (
    <>
      <ChristmasLights className="pointer-events-none relative z-[5]" />
      <div aria-hidden className="xmas-snow pointer-events-none fixed inset-0 z-[5] overflow-hidden">
        {FLAKES.map((f, i) => (
          <span
            key={i}
            className={i % 2 ? "xmas-flake max-sm:hidden" : "xmas-flake"}
            style={{ left: `${f.left}%`, width: f.size, height: f.size, opacity: f.opacity, animationDuration: `${f.duration}s`, animationDelay: `${f.delay}s`, ["--xmas-drift" as string]: `${f.drift}px` }}
          />
        ))}
      </div>
    </>
  );
}
