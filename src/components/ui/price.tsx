import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { PriceQuote } from "@/domain/pricing";

export function Price({ quote, currency = "COP", size = "md", className }: { quote: PriceQuote; currency?: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const main = { sm: "text-[15px]", md: "text-lg", lg: "text-3xl" }[size];
  return (
    <div className={cn("flex flex-wrap items-baseline gap-x-2 gap-y-0.5", className)}>
      <span className={cn("font-display font-semibold tabular-nums tracking-tight text-fg", main)}>{formatMoney(quote.price, currency)}</span>
      {quote.original != null && (
        <>
          <span className="text-[13px] tabular-nums text-fg-subtle line-through decoration-fg-subtle/60">
            <span className="sr-only">Antes </span>
            {formatMoney(quote.original, currency)}
          </span>
          <span className="rounded-[5px] bg-volt-400/12 px-1.5 py-px text-[11.5px] font-semibold tabular-nums text-volt-300">−{quote.discountPct}%</span>
        </>
      )}
    </div>
  );
}
