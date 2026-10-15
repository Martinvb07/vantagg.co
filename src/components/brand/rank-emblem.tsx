import { useId } from "react";
import { toRankId, type RankId } from "@/domain/freefire";
import { cn } from "@/lib/utils";

/**
 * Emblemas de rango ORIGINALES: siguen el código de color y la progresión de
 * forma de cada rango para que se reconozcan, sin reproducir el arte del juego.
 */
const STYLE: Record<RankId | "NONE", { a: string; b: string; edge: string }> = {
  BRONCE: { a: "#e9a46a", b: "#7a3b14", edge: "#ffd2ad" },
  PLATA: { a: "#f3f5f8", b: "#7b8494", edge: "#ffffff" },
  ORO: { a: "#ffd970", b: "#b26a06", edge: "#fff1bd" },
  PLATINO: { a: "#bfe6ff", b: "#3b5bb5", edge: "#e3f4ff" },
  DIAMANTE: { a: "#d1b6ff", b: "#5b21b6", edge: "#efe4ff" },
  HEROICO: { a: "#ff7a6b", b: "#9f1239", edge: "#ffd0c8" },
  GRAN_MAESTRO: { a: "#ffe08a", b: "#c2410c", edge: "#fff4cc" },
  NONE: { a: "#d9f77f", b: "#4d6612", edge: "#f1ffc8" },
};

export function RankEmblem({ rank, className }: { rank: string | null; className?: string }) {
  const uid = useId().replace(/:/g, "");
  const id = toRankId(rank) ?? "NONE";
  const s = STYLE[id];
  const fill = `url(#g${uid})`;
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8 shrink-0", className)} aria-hidden>
      <defs>
        <linearGradient id={`g${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={s.a} />
          <stop offset="1" stopColor={s.b} />
        </linearGradient>
      </defs>
      {id === "BRONCE" && (
        <>
          <rect x="7" y="5" width="18" height="22" rx="2.5" fill={fill} stroke={s.edge} strokeOpacity=".5" />
          <path d="M12 9v14M16 9v14M20 9v14" stroke="#000" strokeOpacity=".28" strokeWidth="2" />
        </>
      )}
      {id === "PLATA" && (
        <>
          <path d="M16 3l11 6v14l-11 6-11-6V9l11-6Z" fill={fill} stroke={s.edge} strokeOpacity=".6" />
          <path d="M16 9l6 3.5v7L16 23l-6-3.5v-7L16 9Z" fill="#000" fillOpacity=".22" />
        </>
      )}
      {id === "ORO" && (
        <>
          <path d="M6 5h20v11c0 6.5-4.5 10.5-10 12C10.5 26.5 6 22.5 6 16V5Z" fill={fill} stroke={s.edge} strokeOpacity=".6" />
          <path d="M11 9h10v7.5c0 3.3-2.2 5.6-5 6.6-2.8-1-5-3.3-5-6.6V9Z" fill="#000" fillOpacity=".25" />
        </>
      )}
      {id === "PLATINO" && (
        <>
          <path d="M16 2.5 27 7v8.5c0 6.8-4.7 11.6-11 14-6.3-2.4-11-7.2-11-14V7l11-4.5Z" fill={fill} stroke={s.edge} strokeOpacity=".6" />
          <path d="M16 9l1.6 3.4 3.7.5-2.7 2.6.7 3.7L16 17.4l-3.3 1.8.7-3.7-2.7-2.6 3.7-.5L16 9Z" fill="#fff" fillOpacity=".95" />
        </>
      )}
      {id === "DIAMANTE" && (
        <>
          <path d="M6 8l4 3 6-6 6 6 4-3v9c0 6-4.4 10-10 12C10.4 27 6 23 6 17V8Z" fill={fill} stroke={s.edge} strokeOpacity=".6" />
          <path d="M16 12l4 4-4 6-4-6 4-4Z" fill="#fff" fillOpacity=".95" />
        </>
      )}
      {id === "HEROICO" && (
        <>
          <path d="M3 10l5 1.5L6 6l6 3.5L16 4l4 5.5L26 6l-2 5.5L29 10l-3 7c-1.8 5.2-5.5 8.6-10 11-4.5-2.4-8.2-5.8-10-11l-3-7Z" fill={fill} stroke={s.edge} strokeOpacity=".55" />
          <circle cx="16" cy="17" r="4.5" fill="#fff" fillOpacity=".92" />
          <circle cx="16" cy="17" r="2" fill={s.b} />
        </>
      )}
      {id === "GRAN_MAESTRO" && (
        <>
          <path d="M2 12l6 1-3-5 6 2 1-5 4 4 4-4 1 5 6-2-3 5 6-1-4 7c-2 4.6-5.7 7.6-10 9.5C11.7 26.6 8 23.6 6 19l-4-7Z" fill={fill} stroke={s.edge} strokeOpacity=".6" />
          <path d="M11 15l2.5 2 2.5-4 2.5 4 2.5-2-1 6h-8l-1-6Z" fill="#fff" fillOpacity=".95" />
        </>
      )}
      {id === "NONE" && (
        <>
          <path d="M16 2.5 27 7v8.6c0 6.6-4.6 11.6-11 13.9C9.6 27.2 5 22.2 5 15.6V7l11-4.5Z" fill={fill} />
          <path d="M11 11h2.6l2.4 6.4 2.4-6.4H21l-3.8 9.4h-2.4L11 11Z" fill="#fff" fillOpacity=".92" />
        </>
      )}
    </svg>
  );
}
