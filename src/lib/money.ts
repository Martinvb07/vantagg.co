const cop = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

export function formatMoney(amount: number, currency = "COP"): string {
  if (currency === "COP") return cop.format(amount);
  return new Intl.NumberFormat("es-CO", { style: "currency", currency }).format(amount);
}

/**
 * Monto cobrado por la pasarela: pesos enteros en COP y centavos en USD (799 → «US$ 7,99»).
 * Se usa para los pagos y para lo que se cobró en dólares a clientes de otros países.
 */
export function formatCharge(amount: number, currency = "COP"): string {
  if (currency === "USD") return `US$ ${new Intl.NumberFormat("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount / 100)}`;
  return formatMoney(amount, currency);
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("es-CO").format(n);
}

export function formatDate(d: Date | string, withTime = true): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    ...(withTime ? { timeStyle: "short" } : {}),
    timeZone: "America/Bogota",
  }).format(date);
}

/** "100 + 10 Bonus" (o "100 Diamantes" sin bonificación). */
export function packageTitle(diamonds: number, bonus: number): string {
  if (!bonus) return `${formatNumber(diamonds)} Diamantes`;
  return `${formatNumber(diamonds)} + ${formatNumber(bonus)} Bonus`;
}
