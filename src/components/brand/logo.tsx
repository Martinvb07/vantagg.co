import Image from "next/image";
import { cn } from "@/lib/utils";

/** Isotipo original: chevron facetado (V + faceta de gema). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden>
      <rect x="0.5" y="0.5" width="31" height="31" rx="8" fill="#171a21" stroke="rgba(255,255,255,0.08)" />
      <path d="M7 9h5.2L16 19.6 19.8 9H25l-7.1 15h-3.8L7 9Z" fill="#c8f04f" />
      <path d="M16 19.6 12.2 9H7l7.1 15H16v-4.4Z" fill="#10140a" fillOpacity="0.18" />
      <path d="M19.8 9H25l-1.6 3.4h-4.8L19.8 9Z" fill="#fff" fillOpacity="0.35" />
    </svg>
  );
}

export function Logo({ name, logoUrl, className }: { name: string; logoUrl?: string; className?: string }) {
  if (logoUrl) {
    return (
      <span className={cn("inline-flex items-center", className)}>
        <Image src={logoUrl} alt={name} width={140} height={32} className="h-8 w-auto" priority />
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="font-display text-[17px] font-bold tracking-[0.14em] text-fg">{name.toUpperCase()}</span>
    </span>
  );
}
