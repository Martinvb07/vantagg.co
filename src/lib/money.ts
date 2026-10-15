const cop = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

export function formatMoney(amount: number, currency = "COP"): string {
  if (currency === "COP") return cop.format(amount);
  return new Intl.NumberFormat("es-CO", { style: "currency", currency }).format(amount);
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
