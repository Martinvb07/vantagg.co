"use client";

import { createContext, useContext, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Globe } from "lucide-react";
import { COUNTRY_NAMES, formatCurrency, localFromUsd, usdPriceCents } from "@/domain/market";
import { setCountryAction } from "@/app/actions/market";
import { cn } from "@/lib/utils";
import type { Market } from "@/server/market";

const MarketContext = createContext<Market | null>(null);

export function MarketProvider({ market, children }: { market: Market; children: ReactNode }) {
  return <MarketContext.Provider value={market}>{children}</MarketContext.Provider>;
}

export function useMarket() {
  return useContext(MarketContext);
}

/** Texto «≈ US$ 1,09 · ≈ MXN 19» de un precio en pesos para quien está fuera de Colombia (null en Colombia). */
export function useForeignPrice(cop: number): string | null {
  const m = useMarket();
  if (!m || m.home || !m.copPerUsd || !(cop > 0)) return null;
  const usd = usdPriceCents(cop, m.copPerUsd, m.surchargePct);
  const usdText = formatCurrency(usd / 100, "USD");
  if (m.currency === "USD" || !m.localPerUsd) return `≈ ${usdText}`;
  return `≈ ${usdText} · ≈ ${formatCurrency(localFromUsd(usd, m.localPerUsd), m.currency)}`;
}

/**
 * Monto en dólares (centavos) que cobrará la pasarela elegida, o null si se cobra en pesos. Solo fuera de Colombia,
 * con «Cobrar en dólares» activo en Ajustes y una pasarela que cobre en dólares (ePayco). Es el mismo cálculo del servidor.
 */
export function useUsdCharge(cop: number, currencies: readonly string[] | undefined): number | null {
  const m = useMarket();
  if (!m?.usdCharge || !m.copPerUsd || !currencies?.includes("USD") || !(cop > 0)) return null;
  const cents = usdPriceCents(cop, m.copPerUsd, m.surchargePct);
  return cents > 0 ? cents : null;
}

/** Referencia del precio en dólares y en la moneda local (solo fuera de Colombia). */
export function PriceHint({ cop, className }: { cop: number; className?: string }) {
  const text = useForeignPrice(cop);
  if (!text) return null;
  return <span className={cn("block text-[11.5px] font-normal tabular-nums text-fg-subtle", className)}>{text}</span>;
}

/** Selector de país (pie de página): corrige la detección por IP, por ejemplo con VPN. */
export function CountrySelect() {
  const m = useMarket();
  const router = useRouter();
  const [pending, start] = useTransition();
  if (!m) return null;
  return (
    <label className="inline-flex items-center gap-2 text-[12.5px] text-fg-muted">
      <Globe className="size-4 shrink-0" />
      <span className="sr-only">País para los precios</span>
      <select
        aria-label="País para los precios"
        disabled={pending}
        value={m.chosen && m.country ? m.country : ""}
        onChange={(e) =>
          start(async () => {
            await setCountryAction(e.target.value);
            router.refresh();
          })
        }
        className="h-9 rounded-lg border border-white/10 bg-ink-850 px-2.5 text-[12.5px] text-fg"
      >
        <option value="">{m.country && !m.chosen ? `${COUNTRY_NAMES[m.country] ?? m.country} (detectado)` : "Colombia (automático)"}</option>
        {Object.entries(COUNTRY_NAMES)
          .sort((a, b) => a[1].localeCompare(b[1], "es"))
          .map(([code, name]) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
      </select>
    </label>
  );
}
