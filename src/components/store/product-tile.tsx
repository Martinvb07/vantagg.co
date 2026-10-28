import Link from "next/link";
import type { ReactNode } from "react";
import { DemoBadge } from "@/components/ui/primitives";
import { PRODUCT_LABELS, type ProductLabelValue } from "@/domain/labels";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

const BADGE: Record<string, string> = {
  BEST_SELLER: "bg-[#ff5a3c] text-white",
  RECOMMENDED: "bg-volt-400 text-volt-ink",
  OFFER: "bg-[#ff3d71] text-white",
  BONUS: "bg-sky-400 text-ink-950",
};

/** Tarjeta de producto estilo marketplace: la portada manda, el texto es breve. */
export function ProductTile({
  href,
  cover,
  title,
  meta,
  price,
  original,
  currency = "COP",
  label = "NONE",
  isDemo,
  disabled,
  pricePrefix,
}: {
  href: string;
  cover: ReactNode;
  title: string;
  meta?: ReactNode;
  price: number;
  original?: number | null;
  currency?: string;
  label?: ProductLabelValue;
  isDemo?: boolean;
  disabled?: boolean;
  pricePrefix?: string;
}) {
  const badge = PRODUCT_LABELS[label];
  const body = (
    <>
      <div className={cn("relative overflow-hidden rounded-[10px] bg-ink-800", label === "RECOMMENDED" ? "ring-2 ring-volt-400 shadow-[0_0_28px_-4px_rgba(200,240,79,0.55)]" : "ring-1 ring-white/[0.06]")}>
        <div className="transition-transform duration-300 group-hover:scale-[1.04]">{cover}</div>
        {badge && <span className={cn("absolute right-2 top-2 rounded-[5px] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide", BADGE[label])}>{badge}</span>}
        {original != null && original > price && (
          <span className="absolute right-2 top-2 rounded-[5px] bg-ink-950/85 px-1.5 py-0.5 text-[10px] font-bold text-volt-300">
            −{Math.round(((original - price) / original) * 100)}%
          </span>
        )}
        {disabled && <span className="absolute inset-0 grid place-items-center bg-ink-950/70 text-[13px] font-semibold text-fg-muted">No disponible</span>}
      </div>
      <div className="px-0.5 pt-2.5">
        <p className="line-clamp-2 text-[13.5px] font-medium leading-snug text-fg group-hover:text-volt-300">{title}</p>
        {meta && <p className="mt-1 truncate text-[12px] text-fg-subtle">{meta}</p>}
        <p className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5">
          {pricePrefix && <span className="text-[11.5px] text-fg-subtle">{pricePrefix}</span>}
          <span className="text-[15px] font-bold tabular-nums text-fg">{formatMoney(price, currency)}</span>
          {original != null && original > price && <span className="text-[11.5px] tabular-nums text-fg-subtle line-through">{formatMoney(original, currency)}</span>}
        </p>
        {isDemo && <DemoBadge className="mt-1.5" />}
      </div>
    </>
  );
  if (disabled) return <div className="group block opacity-70">{body}</div>;
  return (
    <Link href={href} className="group block rounded-[12px] outline-offset-4">
      {body}
    </Link>
  );
}
