import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { TopBadge } from "@/components/brand/top-badge";
import { formatMoney, formatNumber } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { Standing } from "@/server/ranking";

/** Texto del puesto de un cliente en el Top 3 del mes (sus propios datos). */
export function standingText(s: Standing): { title: string; detail: string } {
  if (!s.optIn) return { title: "Participa por diamantes gratis", detail: `Activa las ofertas por correo y tus compras de ${s.month} cuentan para el Top 3 del mes.` };
  if (s.pos && s.pos <= 3) return { title: `Vas #${s.pos} en el Top 3 del mes`, detail: `Hoy te llevarías ${formatNumber(s.prize ?? 0)} diamantes. Mantén tu puesto hasta el cierre de ${s.month}.` };
  if (s.pos) return { title: `Vas #${s.pos} en el Top del mes`, detail: `Te faltan ${formatMoney(s.toPodium)} en compras para entrar al podio.` };
  return s.total > 0
    ? { title: `Te faltan ${formatMoney(s.toMin)} para pelear el Top 3`, detail: `Llevas ${formatMoney(s.total)} en compras de ${s.month}; desde ${formatMoney(s.minCop)} entras a la clasificación.` }
    : { title: "Top 3 del mes: gana diamantes", detail: `Suma ${formatMoney(s.minCop)} en compras de ${s.month} y entra a la clasificación.` };
}

/** Tarjeta del puesto del cliente: en «Mi cuenta» y, compacta, en la página de un pedido entregado. */
export function TopStanding({ standing, href, compact, className }: { standing: Standing; href: string; compact?: boolean; className?: string }) {
  const t = standingText(standing);
  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-3.5 rounded-[16px] bg-gradient-to-r from-volt-400/[0.1] via-volt-400/[0.03] to-transparent ring-1 ring-volt-400/25 transition hover:ring-volt-400/45",
        compact ? "px-3.5 py-3" : "p-4",
        className,
      )}
    >
      <TopBadge pos={standing.pos ?? 4} className={compact ? "size-10" : "size-12"} />
      <span className="min-w-0 flex-1">
        <span className="block font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-volt-300">Temporada {standing.month}</span>
        <span className={cn("block font-semibold leading-snug", compact ? "text-[14px]" : "text-[15px]")}>{t.title}</span>
        <span className="mt-0.5 block text-[12.5px] leading-snug text-fg-muted">{t.detail}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-fg-subtle transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
