import "server-only";
import type { CostKind } from "@/domain/accounting";

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);

type CostSource = {
  type: string;
  itemSnapshot: unknown;
  delivery: { costCents: number | null; simulated: boolean } | null;
  package: { costCents: number | null } | null;
};

/** Costo de una recarga y de dónde sale (null si es una cuenta o no hay ningún dato). */
export function costOf(o: CostSource): { cents: number; kind: CostKind } | null {
  if (o.type !== "TOPUP") return null;
  const real = o.delivery && !o.delivery.simulated ? num(o.delivery.costCents) : null;
  if (real) return { cents: real, kind: "real" };
  const saved = num((o.itemSnapshot as { costCents?: unknown } | null)?.costCents);
  if (saved) return { cents: saved, kind: "venta" };
  const est = num(o.package?.costCents);
  return est ? { cents: est, kind: "estimado" } : null;
}

