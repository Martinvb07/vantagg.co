export const PRODUCT_LABELS = {
  NONE: null,
  BEST_SELLER: "Más vendido",
  OFFER: "Oferta",
  BONUS: "Bonus",
  RECOMMENDED: "Recomendado",
} as const;
export type ProductLabelValue = keyof typeof PRODUCT_LABELS;

export const LISTING_STATUS_META = {
  DRAFT: { label: "Borrador", tone: "neutral" },
  PENDING_REVIEW: { label: "En revisión", tone: "warning" },
  PUBLISHED: { label: "Publicada", tone: "success" },
  RESERVED: { label: "Reservada", tone: "info" },
  SOLD: { label: "Vendida", tone: "neutral" },
  PAUSED: { label: "Pausada", tone: "warning" },
  SUSPENDED: { label: "Suspendida", tone: "danger" },
  RETIRED: { label: "Retirada", tone: "neutral" },
} as const;
export type ListingStatusValue = keyof typeof LISTING_STATUS_META;

/**
 * Requisitos para que una cuenta pueda pasar a PUBLISHED: al menos una foto y ningún reclamo abierto.
 * El origen y la revisión son opcionales (se registran en «Más detalles» del panel).
 */
export function publishBlockers(l: { imagesCount: number; openClaims: number }): string[] {
  const out: string[] = [];
  if (l.imagesCount === 0) out.push("Subir al menos una imagen.");
  if (l.openClaims > 0) out.push("Resolver las reclamaciones abiertas.");
  return out;
}
