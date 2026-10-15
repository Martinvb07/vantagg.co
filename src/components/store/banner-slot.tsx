import { db } from "@/lib/db";
import type { BannerSlot as Slot } from "@/domain/banner-slots";
import { PromoBanners } from "./promo-banners";

/**
 * Inserta los banners activos de una ubicación. Si no hay ninguno, no renderiza nada,
 * así cada página queda limpia cuando el administrador oculta una ubicación.
 */
export async function BannerSlot({
  slot,
  variant,
  label,
  className,
}: {
  slot: Slot;
  variant: "carousel" | "pair" | "wide" | "stack";
  label: string;
  className?: string;
}) {
  const banners = await db.promoBanner
    .findMany({
      where: { placement: slot, active: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, title: true, imageUrl: true, imageMobileUrl: true, href: true },
      take: 12,
    })
    .catch(() => []);
  if (!banners.length) return null;
  return (
    <div className={className}>
      <PromoBanners banners={banners} variant={variant} label={label} />
    </div>
  );
}
