/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { Gift, Snowflake, TreePine } from "lucide-react";

/**
 * Decoración de Navidad para la tienda. Va encima del diseño (sin tocar nada) y solo se dibuja en temporada (ver
 * src/domain/season.ts y Panel → Ajustes → Temporada):
 *  - barra roja con la cuenta regresiva (ChristmasBar), arriba del encabezado;
 *  - guirnalda de pino con nieve y luces que titilan, debajo del encabezado;
 *  - copos de nieve de cristal que caen girando, un trineo que cruza la pantalla de vez en cuando y brillo de fondo;
 *  - pueblito nevado antes del pie de página (ChristmasVillage).
 * El gorro del logo, la nieve y el regalo de las portadas y el acebo de los títulos son piezas «navidad-only» /
 * «navidad-inline» (globals.css). Con «reducir movimiento» no hay animaciones, ni nieve, ni trineo.
 */

const COLORS = ["#ff4d5e", "#ffc63a", "#b9f43c", "#62dcea", "#ff8fd0"];
const WIDTH = 2400;
const BAND = 20; // centro de la guirnalda (alto del dibujo: 54)

/** Ramas de pino a lo largo de la guirnalda: una cada 34 px, en ola suave. */
const CLUSTERS = Array.from({ length: Math.ceil(WIDTH / 34) + 1 }, (_, i) => {
  const x = i * 34;
  return { x, y: BAND + 2.5 * Math.sin(x / 110), r: ((i * 47) % 50) - 25 };
});
/** Bombillos colgando de la guirnalda y moños rojos. */
const BULBS = Array.from({ length: WIDTH / 64 }, (_, i) => ({ x: 32 + i * 64, y: BAND + 9 + 2.5 * Math.sin((32 + i * 64) / 110), c: i % COLORS.length }));
const BOWS = Array.from({ length: WIDTH / 480 }, (_, i) => 240 + i * 480);
const BALLS = Array.from({ length: WIDTH / 480 }, (_, i) => ({ x: 120 + i * 480, c: i % 2 ? "#ffc63a" : "#e0293f" }));

/** Agujas de una rama de pino (centro 0,0). */
const NEEDLES = [-160, -140, -118, -96, -74, -52, -30, 20, 42, 64, 86, 108, 130, 152, 172, 0].map((a, i) => {
  const len = 11 + ((i * 7) % 7);
  const rad = (a * Math.PI) / 180;
  return { d: `M0 0L${(Math.cos(rad) * len).toFixed(1)} ${(Math.sin(rad) * len * 0.62).toFixed(1)}`, c: ["#0e3b22", "#17572f", "#1f7040"][i % 3] };
});

export function ChristmasGarland({ className }: { className?: string }) {
  return (
    <div aria-hidden className={className}>
      <svg viewBox={`0 0 ${WIDTH} 54`} preserveAspectRatio="xMidYMin slice" className="block h-[42px] w-full sm:h-[50px]">
        <defs>
          <g id="xmas-pine">
            <ellipse cx="0" cy="0" rx="17" ry="7" fill="#0b2e1a" />
            {NEEDLES.map((n, i) => (
              <path key={i} d={n.d} stroke={n.c} strokeWidth="2.6" strokeLinecap="round" />
            ))}
          </g>
          {COLORS.map((c, i) => (
            <radialGradient key={c} id={`xmas-glow-${i}`}>
              <stop offset="0" stopColor={c} stopOpacity="0.6" />
              <stop offset="1" stopColor={c} stopOpacity="0" />
            </radialGradient>
          ))}
        </defs>
        {CLUSTERS.map((c, i) => (
          <use key={i} href="#xmas-pine" transform={`translate(${c.x} ${c.y.toFixed(1)}) rotate(${c.r})`} />
        ))}
        {/* Nieve encima de las ramas */}
        {CLUSTERS.map((c, i) => (
          <ellipse key={i} cx={c.x + ((i * 5) % 9) - 2} cy={(c.y - 5.5 - ((i * 3) % 3) * 0.8).toFixed(1)} rx={7 + ((i * 7) % 6)} ry={2.6 + ((i * 3) % 3) * 0.5} fill={i % 4 ? "#f4fbff" : "#dcebf3"} />
        ))}
        {BALLS.map((b) => (
          <g key={b.x}>
            <path d={`M${b.x} ${BAND} V${BAND + 10}`} stroke="#c8a476" strokeWidth="1" />
            <circle cx={b.x} cy={BAND + 17} r="6.5" fill={b.c} stroke="#2a0a10" strokeWidth="1.2" />
            <circle cx={b.x - 2.2} cy={BAND + 14.8} r="1.8" fill="#fff" opacity="0.65" />
          </g>
        ))}
        {BULBS.map((b, i) => (
          <g key={i} transform={`translate(${b.x} ${b.y.toFixed(1)})`}>
            <rect x="-2.2" y="-1" width="4.4" height="4.4" rx="1" fill="#26302b" />
            <g className="xmas-bulb" style={{ animationDelay: `${-(i % 3) * 0.8}s` }}>
              <circle cx="0" cy="9" r="11" fill={`url(#xmas-glow-${b.c})`} />
              <ellipse cx="0" cy="9" rx="3.8" ry="5.6" fill={COLORS[b.c]} />
              <ellipse cx="-1.2" cy="7" rx="1" ry="1.8" fill="#fff" opacity="0.6" />
            </g>
          </g>
        ))}
        {BOWS.map((x) => (
          <g key={x} transform={`translate(${x} ${BAND})`} stroke="#5a0a14" strokeWidth="1.2" strokeLinejoin="round">
            <path d="M-2 2L-9 22L-4 19L-1 24Z M2 2L9 22L4 19L1 24Z" fill="#c81d33" />
            <path d="M0 0C-6 -9 -18 -8 -16 1C-14 8 -5 4 0 0ZM0 0C6 -9 18 -8 16 1C14 8 5 4 0 0Z" fill="#e0293f" />
            <circle cx="0" cy="0" r="3.4" fill="#b3132b" />
          </g>
        ))}
      </svg>
    </div>
  );
}

/** Copos: la mitad de cristal (girando) y la mitad redondos; posiciones fijas (iguales en servidor y navegador). */
const FLAKES = Array.from({ length: 34 }, (_, i) => ({
  left: (i * 37 + 11) % 100,
  crystal: i % 3 !== 0,
  size: i % 3 !== 0 ? 9 + ((i * 7) % 9) : 3 + ((i * 7) % 4),
  duration: 12 + ((i * 13) % 10),
  delay: -((i * 17) % 21),
  spin: 5 + ((i * 3) % 6),
  drift: (i % 2 ? 1 : -1) * (14 + ((i * 5) % 26)),
  opacity: 0.5 + ((i * 3) % 4) * 0.12,
}));

export function ChristmasDecor() {
  return (
    <>
      {/* Brillo navideño de fondo (rojo, verde y dorado), detrás de todo el contenido */}
      <div aria-hidden className="xmas-glow pointer-events-none fixed inset-0 -z-10" />
      <ChristmasGarland className="pointer-events-none relative z-[5] -mb-2" />
      <svg aria-hidden className="absolute size-0">
        <defs>
          <g id="xmas-crystal" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" fill="none">
            <path d="M0 -9V9M-7.8 -4.5L7.8 4.5M-7.8 4.5L7.8 -4.5" />
            <path d="M0 -6L-2 -8M0 -6L2 -8M0 6L-2 8M0 6L2 8M-5.2 -3L-7.4 -2.1M-5.2 -3L-5.6 -5.4M5.2 3L7.4 2.1M5.2 3L5.6 5.4M-5.2 3L-5.6 5.4M-5.2 3L-7.4 2.1M5.2 -3L5.6 -5.4M5.2 -3L7.4 -2.1" />
          </g>
        </defs>
      </svg>
      <div aria-hidden className="xmas-snow pointer-events-none fixed inset-0 z-[5] overflow-hidden">
        {FLAKES.map((f, i) => (
          <span
            key={i}
            className={i % 2 ? "xmas-flake max-sm:hidden" : "xmas-flake"}
            style={{ left: `${f.left}%`, width: f.size, height: f.size, opacity: f.opacity, animationDuration: `${f.duration}s`, animationDelay: `${f.delay}s`, ["--xmas-drift" as string]: `${f.drift}px` }}
          >
            {f.crystal ? (
              <svg viewBox="-10 -10 20 20" className="xmas-spin block size-full" style={{ animationDuration: `${f.spin}s` }}>
                <use href="#xmas-crystal" />
              </svg>
            ) : (
              <span className="block size-full rounded-full bg-white shadow-[0_0_6px_rgb(255_255_255/0.7)]" />
            )}
          </span>
        ))}
      </div>
      {/* Trineo con renos: cruza la pantalla cada ~40 s */}
      <img src="/temporada/trineo.svg" alt="" aria-hidden decoding="async" draggable={false} className="xmas-sleigh pointer-events-none fixed left-0 top-[118px] z-[6] w-[170px] sm:top-[150px] sm:w-[250px]" />
    </>
  );
}

/** Barra roja de temporada con la cuenta regresiva (o el saludo del día), arriba del encabezado. */
export function ChristmasBar({ message }: { message: string }) {
  return (
    <Link href="/recargas" className="group relative block overflow-hidden bg-[linear-gradient(90deg,#6d0c1a,#b3182d_50%,#6d0c1a)] text-center">
      <span aria-hidden className="block h-[4px] bg-[repeating-linear-gradient(135deg,#fff_0_7px,#e0293f_7px_14px)]" />
      <span className="flex items-center justify-center gap-2 whitespace-nowrap px-4 py-[7px] text-[12.5px] font-semibold text-[#ffe08a] sm:text-[13.5px]">
        <Snowflake aria-hidden className="size-3.5 shrink-0 text-white/80" />
        <TreePine aria-hidden className="size-4 shrink-0 text-[#7ee29c]" />
        {/* En el celular solo el mensaje (una línea); en pantallas grandes también el nombre y «Regala diamantes». */}
        <span className="hidden font-display font-black italic tracking-wide text-white sm:inline">NAVIDAD VANTAGG</span>
        <span aria-hidden className="hidden text-white/50 sm:inline">·</span>
        <span className="truncate">{message}</span>
        <span className="hidden items-center gap-1 text-white group-hover:underline sm:inline-flex">
          <span aria-hidden className="text-white/50">·</span> <Gift aria-hidden className="size-3.5" /> Regala diamantes →
        </span>
        <Snowflake aria-hidden className="size-3.5 shrink-0 text-white/80" />
      </span>
      <span aria-hidden className="block h-[4px] bg-[repeating-linear-gradient(135deg,#fff_0_7px,#e0293f_7px_14px)]" />
    </Link>
  );
}

/** Pueblito nevado (pinos, casitas con luz y el árbol de la plaza) justo encima del pie de página. */
export function ChristmasVillage() {
  return (
    <div aria-hidden className="pointer-events-none relative z-[1] mt-10 -mb-10 sm:mt-16 sm:-mb-16">
      <img src="/temporada/pueblo.svg" alt="" decoding="async" draggable={false} className="block h-[86px] w-full object-cover object-bottom sm:h-[130px]" />
    </div>
  );
}
