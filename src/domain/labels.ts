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

/** Requisitos para que una cuenta pueda pasar a PUBLISHED. */
export function publishBlockers(l: {
  authorizationConfirmed: boolean;
  provenanceSource: string | null;
  provenanceVerifiedAt: Date | null;
  inventoryVerified: boolean;
  imagesCount: number;
  openClaims: number;
}): string[] {
  const out: string[] = [];
  if (!l.provenanceSource) out.push("Registrar la procedencia de la cuenta.");
  if (!l.authorizationConfirmed || !l.provenanceVerifiedAt)
    out.push("Confirmar la autorización comercial del titular para venderla.");
  if (!l.inventoryVerified) out.push("Verificar el inventario declarado.");
  if (l.imagesCount === 0) out.push("Subir al menos una imagen.");
  if (l.openClaims > 0) out.push("Resolver las reclamaciones abiertas.");
  return out;
}
