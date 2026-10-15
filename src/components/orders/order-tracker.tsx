import { Check, X } from "lucide-react";
import { HAPPY_PATH, ORDER_STATUS_META, timelineIndex, type OrderStatusValue } from "@/domain/order-status";
import { cn } from "@/lib/utils";

const LABELS: Record<string, string> = {
  PENDING_PAYMENT: "Pedido creado",
  PAID: "Pago confirmado",
  PROCESSING: "En procesamiento",
  DELIVERED: "Entregado",
};

export function OrderTimeline({ status }: { status: OrderStatusValue }) {
  const idx = timelineIndex(status);
  const off = idx < 0; // cancelado / reembolso
  const failed = status === "DELIVERY_FAILED";
  return (
    <ol className="grid grid-cols-4 gap-2" aria-label="Progreso del pedido">
      {HAPPY_PATH.map((s, i) => {
        const done = !off && (i < idx || (i === idx && status === "DELIVERED"));
        const current = !off && i === idx && status !== "DELIVERED";
        const error = failed && i === idx;
        return (
          <li key={s} className="flex flex-col gap-2">
            <div className={cn("h-1 rounded-full", done ? "bg-volt-400" : current ? (error ? "bg-bad-400" : "bg-volt-400/40") : "bg-white/[0.07]")} />
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "grid size-4 shrink-0 place-items-center rounded-full",
                  done && "bg-volt-400 text-volt-ink",
                  current && !error && "border-2 border-volt-400/80",
                  error && "bg-bad-400 text-ink-900",
                  !done && !current && "border border-white/15",
                )}
              >
                {done && <Check className="size-2.5" strokeWidth={3.5} />}
                {error && <X className="size-2.5" strokeWidth={3.5} />}
              </span>
              <span className={cn("text-[12px] leading-tight sm:text-[13px]", done || current ? "text-fg" : "text-fg-subtle")}>
                {error ? ORDER_STATUS_META.DELIVERY_FAILED.label : LABELS[s]}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
