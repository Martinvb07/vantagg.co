import "server-only";
import type { TopUpProvider } from "./types";
import { centralOneProvider } from "./centralone";
import { rechargeGameProvider } from "./rechargegame";

export const TOPUP_PROVIDERS: TopUpProvider[] = [centralOneProvider, rechargeGameProvider];

/** Proveedor activo según TOPUP_PROVIDER, solo si está completamente configurado. */
export function activeTopUpProvider(): TopUpProvider | null {
  return TOPUP_PROVIDERS.find((p) => p.isEnabled()) ?? null;
}

export function getTopUpProvider(id: string): TopUpProvider | null {
  return TOPUP_PROVIDERS.find((p) => p.id === id) ?? null;
}

/** Proveedor mayorista activo (catálogo, saldo y pedidos), o null. */
export function activeWholesale(): (TopUpProvider & { wholesale: NonNullable<TopUpProvider["wholesale"]> }) | null {
  const p = activeTopUpProvider();
  return p?.wholesale ? (p as TopUpProvider & { wholesale: NonNullable<TopUpProvider["wholesale"]> }) : null;
}

export type { TopUpProvider, WholesaleApi, WholesaleOrder } from "./types";
