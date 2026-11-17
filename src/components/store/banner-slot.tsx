import { db } from "@/lib/db";
import type { BannerSlot as Slot } from "@/domain/banner-slots";
import { currentSeason, seasonalBanner } from "@/domain/season";
import { getSettings } from "@/server/settings";
import { PromoBanners } from "./promo-banners";

/**
 * Inserta los banners activos de una ubicación. Si no hay ninguno, no renderiza nada,
 * así cada página queda limpia cuando el administrador oculta una ubicación.
 * En Navidad, los banners de la marca se ven en su versión navideña (ver seasonalBanner).
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
  const [rows, settings] = await Promise.all([
    db.promoBanner
      .findMany({
        where: { placement: slot, active: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: { id: true, title: true, imageUrl: true, imageMobileUrl: true, href: true },
        take: 12,
      })
      .catch(() => []),
    getSettings(),
  ]);
  if (!rows.length) return null;
  const season = currentSeason(settings.seasonTheme);
  const banners = rows.map((b) => seasonalBanner(b, season));
  return (
    <div className={className}>
      <PromoBanners banners={banners} variant={variant} label={label} />
    </div>
  );
}
