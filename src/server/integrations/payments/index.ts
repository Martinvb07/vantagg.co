import "server-only";
import type { PaymentProvider } from "./types";
import { boldProvider } from "./bold";

/** Registro de pasarelas. Para añadir una nueva: implementar PaymentProvider y registrarla aquí. */
export const PAYMENT_PROVIDERS: PaymentProvider[] = [boldProvider];

export function getPaymentProvider(id: string): PaymentProvider | null {
  return PAYMENT_PROVIDERS.find((p) => p.id === id) ?? null;
}

export function enabledPaymentProviders(): PaymentProvider[] {
  return PAYMENT_PROVIDERS.filter((p) => p.isEnabled());
}

/** Información pública (sin secretos) de las pasarelas habilitadas. */
export function publicPaymentOptions() {
  return enabledPaymentProviders().map((p) => ({
    id: p.id,
    name: p.displayName,
    methods: p.methodsLabel,
    test: p.mode() !== "production",
  }));
}

export type PublicPaymentOption = ReturnType<typeof publicPaymentOptions>[number];
export type { PaymentProvider } from "./types";
