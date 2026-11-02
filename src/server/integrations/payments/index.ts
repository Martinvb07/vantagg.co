import "server-only";
import type { PaymentProvider } from "./types";
import { boldProvider } from "./bold";
import { epaycoProvider } from "./epayco";

/**
 * Registro de pasarelas. Para añadir una nueva: implementar PaymentProvider y registrarla aquí.
 * Se activan con PAYMENT_PROVIDER (p. ej. «bold,epayco»): Bold sigue siendo la principal; ePayco suma el cobro en dólares.
 */
export const PAYMENT_PROVIDERS: PaymentProvider[] = [boldProvider, epaycoProvider];

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
    currencies: [...p.currencies],
    test: p.mode() !== "production",
  }));
}

export type PublicPaymentOption = ReturnType<typeof publicPaymentOptions>[number];
export type { PaymentProvider } from "./types";
