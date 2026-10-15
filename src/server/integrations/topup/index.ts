import "server-only";
import type { TopUpProvider } from "./types";
import { rechargeGameProvider } from "./rechargegame";

export const TOPUP_PROVIDERS: TopUpProvider[] = [rechargeGameProvider];

/** Proveedor activo según TOPUP_PROVIDER, solo si está completamente configurado. */
export function activeTopUpProvider(): TopUpProvider | null {
  return TOPUP_PROVIDERS.find((p) => p.isEnabled()) ?? null;
}

export function getTopUpProvider(id: string): TopUpProvider | null {
  return TOPUP_PROVIDERS.find((p) => p.id === id) ?? null;
}

export type { TopUpProvider } from "./types";
