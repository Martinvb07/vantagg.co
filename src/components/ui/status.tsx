import { Badge } from "./primitives";
import { ORDER_STATUS_META, type OrderStatusValue } from "@/domain/order-status";
import { LISTING_STATUS_META, PRODUCT_LABELS, type ListingStatusValue, type ProductLabelValue } from "@/domain/labels";

export function OrderStatusBadge({ status, simulated }: { status: OrderStatusValue; simulated?: boolean }) {
  const meta = ORDER_STATUS_META[status];
  return (
    <Badge tone={meta.tone} dot>
      {meta.label}
      {simulated && status === "DELIVERED" ? " · simulación" : ""}
    </Badge>
  );
}

export function ListingStatusBadge({ status }: { status: ListingStatusValue }) {
  const meta = LISTING_STATUS_META[status];
  return (
    <Badge tone={meta.tone} dot>
      {meta.label}
    </Badge>
  );
}

export function ProductLabelTag({ label, className }: { label: ProductLabelValue; className?: string }) {
  const text = PRODUCT_LABELS[label];
  if (!text) return null;
  const tone = label === "OFFER" ? "bg-bad-400/14 text-[#ff8d8d] border-bad-400/25" : label === "BONUS" ? "bg-sky-400/12 text-sky-400 border-sky-400/25" : "bg-volt-400/12 text-volt-300 border-volt-400/25";
  return <span className={`inline-flex items-center rounded-[5px] border px-1.5 py-px text-[10.5px] font-semibold uppercase tracking-[0.08em] ${tone} ${className ?? ""}`}>{text}</span>;
}
