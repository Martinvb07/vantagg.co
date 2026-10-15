import { useId } from "react";
import { cn } from "@/lib/utils";

/** Gema facetada original (no reproduce el arte del juego). */
export function Gem({ className, hue = "ice" }: { className?: string; hue?: "ice" | "volt" }) {
  const id = useId().replace(/:/g, "");
  const c = hue === "volt"
    ? { a: "#f1ffc8", b: "#c8f04f", c: "#7f9f1a", d: "#3f5108" }
    : { a: "#e8f6ff", b: "#7cc8ff", c: "#2f7fe0", d: "#173a8a" };
  return (
    <svg viewBox="0 0 120 110" className={cn("drop-shadow-[0_12px_24px_rgba(0,0,0,0.45)]", className)} aria-hidden>
      <defs>
        <linearGradient id={`${id}t`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c.a} />
          <stop offset="1" stopColor={c.b} />
        </linearGradient>
        <linearGradient id={`${id}l`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={c.b} />
          <stop offset="1" stopColor={c.c} />
        </linearGradient>
        <linearGradient id={`${id}r`} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c.c} />
          <stop offset="1" stopColor={c.d} />
        </linearGradient>
      </defs>
      {/* corona */}
      <path d="M30 8h60l26 30H4L30 8Z" fill={`url(#${id}t)`} />
      <path d="M30 8 44 38H4L30 8Z" fill={c.b} fillOpacity="0.55" />
      <path d="M90 8 76 38h40L90 8Z" fill={c.c} fillOpacity="0.55" />
      <path d="M44 38 60 8l16 30H44Z" fill="#fff" fillOpacity="0.35" />
      {/* pabellón */}
      <path d="M4 38h40l16 66L4 38Z" fill={`url(#${id}l)`} />
      <path d="M44 38h32l-16 66-16-66Z" fill={c.b} />
      <path d="M76 38h40L60 104l16-66Z" fill={`url(#${id}r)`} />
      <path d="M44 38h32l-16 66-16-66Z" fill="#fff" fillOpacity="0.12" />
      {/* brillo */}
      <path d="M36 14h18l-6 8H31l5-8Z" fill="#fff" fillOpacity="0.7" />
      <path d="M4 38h112" stroke="#fff" strokeOpacity="0.5" strokeWidth="1" />
    </svg>
  );
}
