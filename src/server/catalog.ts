import "server-only";
import { cache } from "react";
import type { AccountListing, AccountImage, AccountTag, DiamondPackage, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { quotePrice, type PriceQuote } from "@/domain/pricing";
import { compareRegions, DEFAULT_TOPUP_REGION, parseRegionList, regionFlag, regionLabel } from "@/domain/topup-regions";
import { getSettings } from "./settings";

// ---------------------------------------------------------------------
// Paquetes de diamantes
// ---------------------------------------------------------------------

export type PackageView = Pick<
  DiamondPackage,
  "id" | "slug" | "name" | "diamonds" | "bonusDiamonds" | "currency" | "label" | "available" | "featured" | "isDemo" | "region"
> & { quote: PriceQuote };

export type TopupRegionView = { slug: string; label: string; flag: string | null; packages: number };

/** Regiones activas en la tienda (Panel → Proveedor) que tienen al menos un paquete visible. LATAM va primero. */
export async function getTopupRegions(): Promise<TopupRegionView[]> {
  const enabled = parseRegionList((await getSettings()).topupRegions);
  if (enabled.length === 0) return [];
  const counts = await db.diamondPackage.groupBy({ by: ["region"], where: { active: true, region: { in: enabled } }, _count: { _all: true } });
  const names = await db.supplierProduct.findMany({ where: { regionSlug: { in: enabled } }, distinct: ["regionSlug"], select: { regionSlug: true, regionName: true } }).catch(() => []);
  return enabled
    .map((slug) => ({
      slug,
      label: regionLabel(slug, names.find((n) => n.regionSlug === slug)?.regionName),
      flag: regionFlag(slug),
      packages: counts.find((c) => c.region === slug)?._count._all ?? 0,
    }))
    .filter((r) => r.packages > 0)
    .sort(compareRegions);
}

/** Región principal (inicio, buscador): LATAM si está activa; si no, la primera activa. */
export async function mainTopupRegion(): Promise<string> {
  const enabled = parseRegionList((await getSettings()).topupRegions);
  return enabled.includes(DEFAULT_TOPUP_REGION) || enabled.length === 0 ? DEFAULT_TOPUP_REGION : enabled[0];
}

/** Paquetes visibles. Sin `regions`, solo los de la región principal. */
export async function getPackages(opts: { featuredOnly?: boolean; regions?: string[] } = {}): Promise<PackageView[]> {
  const regions = opts.regions ?? [await mainTopupRegion()];
  const rows = await db.diamondPackage.findMany({
    where: { active: true, region: { in: regions }, ...(opts.featuredOnly ? { featured: true } : {}) },
    orderBy: [{ sortOrder: "asc" }, { diamonds: "asc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    diamonds: r.diamonds,
    bonusDiamonds: r.bonusDiamonds,
    currency: r.currency,
    label: r.label,
    available: r.available && !r.supplierOutOfStock,
    featured: r.featured,
    isDemo: r.isDemo,
    region: r.region,
    quote: quotePrice(r.price, r.compareAtPrice),
  }));
}

// ---------------------------------------------------------------------
// Cuentas
// ---------------------------------------------------------------------

type ListingWithRels = AccountListing & { images: AccountImage[]; tags: AccountTag[] };

export type AccountCardView = {
  id: string;
  slug: string;
  title: string;
  level: number | null;
  skinsCount: number | null;
  rank: string | null;
  region: string;
  label: AccountListing["label"];
  status: AccountListing["status"];
  available: boolean;
  reservedTemporarily: boolean;
  inventoryVerified: boolean;
  isDemo: boolean;
  featured: boolean;
  image: { url: string; alt: string } | null;
  imagesCount: number;
  tags: string[];
  currency: string;
  quote: PriceQuote;
};

export function listingAvailability(l: Pick<AccountListing, "status" | "reservedUntil">, now = new Date()) {
  const reservationExpired = l.status === "RESERVED" && (!l.reservedUntil || l.reservedUntil < now);
  return {
    available: l.status === "PUBLISHED" || reservationExpired,
    reservedTemporarily: l.status === "RESERVED" && !reservationExpired,
  };
}

function toCard(l: ListingWithRels): AccountCardView {
  const img = [...l.images].sort((a, b) => a.sortOrder - b.sortOrder)[0];
  return {
    id: l.id,
    slug: l.slug,
    title: l.title,
    level: l.level,
    skinsCount: l.skinsCount,
    rank: l.rank,
    region: l.region,
    label: l.label,
    status: l.status,
    ...listingAvailability(l),
    inventoryVerified: l.inventoryVerified,
    isDemo: l.isDemo,
    featured: l.featured,
    image: img ? { url: img.url, alt: img.alt || l.title } : null,
    imagesCount: l.images.length,
    tags: l.tags.map((t) => t.tag),
    currency: l.currency,
    quote: quotePrice(l.price, l.compareAtPrice),
  };
}

export type AccountFilters = {
  q?: string;
  minPrice?: number;
  maxPrice?: number;
  minLevel?: number;
  maxLevel?: number;
  regions?: string[];
  verifiedOnly?: boolean;
  ranks?: string[];
  tags?: string[];
  onlyAvailable?: boolean;
  sort?: "recent" | "price_asc" | "price_desc" | "level_desc";
  featuredOnly?: boolean;
  take?: number;
};

const PUBLIC_STATUSES: AccountListing["status"][] = ["PUBLISHED", "RESERVED"];

export async function getAccounts(f: AccountFilters = {}): Promise<AccountCardView[]> {
  const where: Prisma.AccountListingWhereInput = {
    status: { in: PUBLIC_STATUSES },
    ...(f.featuredOnly ? { featured: true } : {}),
    ...(f.minPrice != null || f.maxPrice != null ? { price: { gte: f.minPrice, lte: f.maxPrice } } : {}),
    ...(f.minLevel != null || f.maxLevel != null ? { level: { gte: f.minLevel, lte: f.maxLevel } } : {}),
    ...(f.regions?.length ? { region: { in: f.regions } } : {}),
    ...(f.verifiedOnly ? { inventoryVerified: true } : {}),
    ...(f.ranks?.length ? { rank: { in: f.ranks } } : {}),
    ...(f.tags?.length ? { tags: { some: { tag: { in: f.tags } } } } : {}),
    ...(f.q ? { OR: [{ title: { contains: f.q } }, { description: { contains: f.q } }, { rank: { contains: f.q } }] } : {}),
  };
  const orderBy: Prisma.AccountListingOrderByWithRelationInput[] =
    f.sort === "price_asc"
      ? [{ price: "asc" }]
      : f.sort === "price_desc"
        ? [{ price: "desc" }]
        : f.sort === "level_desc"
          ? [{ level: "desc" }]
          : [{ featured: "desc" }, { createdAt: "desc" }];

  const rows = await db.accountListing.findMany({ where, orderBy, take: f.take ?? 60, include: { images: true, tags: true } });
  let cards = rows.map((r) => toCard(r));
  if (f.onlyAvailable) cards = cards.filter((c) => c.available);
  return cards;
}

export async function getAccountFacets() {
  const rows = await db.accountListing.findMany({
    where: { status: { in: PUBLIC_STATUSES } },
    select: { rank: true, price: true, region: true, tags: { select: { tag: true } } },
  });
  const tally = (list: Array<string | null>) => {
    const m: Record<string, number> = {};
    for (const x of list) if (x) m[x] = (m[x] ?? 0) + 1;
    return m;
  };
  const tagCounts = tally(rows.flatMap((r) => r.tags.map((t) => t.tag)));
  const rankCounts = tally(rows.map((r) => r.rank));
  const top = (m: Record<string, number>, n: number) => Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k);
  return {
    total: rows.length,
    rankCounts,
    regionCounts: tally(rows.map((r) => r.region)),
    tags: Object.keys(tagCounts).sort(),
    tagCounts,
    popular: [
      ...top(tagCounts, 4).map((v) => ({ kind: "caracteristica" as const, value: v })),
      ...top(rankCounts, 2).map((v) => ({ kind: "rango" as const, value: v })),
    ],
  };
}

export type AccountFacets = Awaited<ReturnType<typeof getAccountFacets>>;

export async function getAccountBySlug(slug: string) {
  const l = await db.accountListing.findUnique({
    where: { slug },
    include: { images: { orderBy: { sortOrder: "asc" } }, tags: true },
  });
  if (!l || !["PUBLISHED", "RESERVED", "SOLD"].includes(l.status)) return null;
  return {
    ...toCard(l),
    description: l.description,
    inventoryItems: l.inventoryItems.split("\n").map((s) => s.trim()).filter(Boolean),
    deliveryConditions: l.deliveryConditions,
    extraInfo: l.extraInfo,
    inventoryVerifiedAt: l.inventoryVerifiedAt,
    images: l.images.map((i) => ({ url: i.url, alt: i.alt || l.title })),
    sold: l.status === "SOLD",
    updatedAt: l.updatedAt,
  };
}

export type AccountDetail = NonNullable<Awaited<ReturnType<typeof getAccountBySlug>>>;

export async function getRelatedAccounts(excludeId: string, take = 3) {
  const all = await getAccounts({ onlyAvailable: true, take: take + 1 });
  return all.filter((a) => a.id !== excludeId).slice(0, take);
}

// ---------------------------------------------------------------------
// Entregas recientes (datos reales, anonimizados)
// ---------------------------------------------------------------------

/**
 * Últimas entregas confirmadas. Solo se muestra el producto, el ID de jugador
 * enmascarado y el tiempo transcurrido. Nunca incluye pedidos de prueba.
 */
export async function getRecentDeliveries(take = 10) {
  const rows = await db.order.findMany({
    where: { status: "DELIVERED", deliveredAt: { not: null }, isTest: false },
    orderBy: { deliveredAt: "desc" },
    take,
    select: { id: true, type: true, itemSnapshot: true, playerId: true, deliveredAt: true, isTest: true },
  });
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    name: (r.itemSnapshot as { name?: string }).name ?? "Producto digital",
    player: r.playerId ? `ID •••${r.playerId.slice(-3)}` : null,
    at: r.deliveredAt!,
    isTest: r.isTest,
  }));
}

/**
 * ¿Se muestra la sección de cuentas? «auto» (predeterminado): solo si hay cuentas publicadas o reservadas,
 * así la tienda nunca muestra un catálogo vacío; «on» siempre; «off» nunca.
 */
export const accountsVisible = cache(async (): Promise<boolean> => {
  const s = await getSettings();
  if (s.accountsMode === "on") return true;
  if (s.accountsMode === "off") return false;
  return (await db.accountListing.count({ where: { status: { in: PUBLIC_STATUSES } } }).catch(() => 0)) > 0;
});
