import "server-only";
import { db } from "@/lib/db";
import { compareRegions, DEFAULT_TOPUP_REGION, parseRegionList, regionalPrice, regionLabel, splitBonus, suggestedPrice } from "@/domain/topup-regions";
import { PASS_INFO, passKindOf } from "@/domain/packs";
import { activeWholesale } from "./integrations/topup";
import { SupplierError } from "./integrations/topup/rechargegame";
import type { TopUpProvider } from "./integrations/topup/types";
import { getSettings, saveSettings } from "./settings";

/**
 * Catálogo del proveedor mayorista activo (Central One o RechargeGame): copia local + vínculo con los
 * paquetes de la tienda. Los precios de venta nunca se cambian solos: la sincronización solo actualiza
 * costos y existencias. Los costos se guardan en centavos de la moneda del proveedor (USD o USDT).
 */

const GAME = "free-fire";
/** Región de respaldo: si el proveedor vende Free Fire como «GLOBAL», esos productos sirven a la región de la tienda. */
const GLOBAL_REGION = "global";
const toCents = (usdt: number | string) => Math.round(Number(usdt) * 100);
const isDiamondPack = (p: { unit: string | null; amount: number | null; delivery: string }) => p.unit === "Diamonds" && (p.amount ?? 0) > 0 && p.delivery === "player_id";

export async function supplierRate() {
  const s = await getSettings();
  const usdtCop = Number(s.usdtCop) > 0 ? Number(s.usdtCop) : 3400;
  const margin = Number(s.topupMargin) >= 0 ? Number(s.topupMargin) : 30;
  return { usdtCop, margin, regions: parseRegionList(s.topupRegions), syncedAt: s.supplierSyncedAt ? new Date(s.supplierSyncedAt) : null };
}

let syncing: Promise<SyncSummary> | null = null;
export type SyncSummary = { products: number; regions: number; linked: number; updated: number };

/** Descarga el catálogo de Free Fire y actualiza costo/agotado de los paquetes vinculados. */
export function syncSupplierCatalog(): Promise<SyncSummary> {
  syncing ??= doSync().finally(() => (syncing = null));
  return syncing;
}

async function doSync(): Promise<SyncSummary> {
  const supplier = activeWholesale();
  if (!supplier) throw new SupplierError("not_configured", 0, "No hay un proveedor mayorista configurado.");
  const { groups } = await supplier.wholesale.catalog();
  const now = new Date();
  const rows = groups.flatMap((g) =>
    g.products.map((p) => ({
      productKey: p.product_key.slice(0, 191),
      game: GAME,
      regionSlug: g.slug,
      regionName: g.key.slice(0, 100),
      name: p.name.slice(0, 191),
      amount: p.amount ?? null,
      unit: p.unit ?? null,
      priceCents: toCents(p.price),
      outOfStock: !!p.out_of_stock,
      delivery: p.delivery,
      syncedAt: now,
    })),
  );
  await db.$transaction([db.supplierProduct.deleteMany({ where: { game: GAME } }), db.supplierProduct.createMany({ data: rows })]);
  const byKey = new Map(rows.map((r) => [r.productKey, r]));

  let linked = 0;
  let updated = 0;
  const packages = await db.diamondPackage.findMany({ select: { id: true, region: true, diamonds: true, bonusDiamonds: true, providerSku: true, costCents: true, supplierOutOfStock: true } });
  for (const p of packages) {
    let product = p.providerSku ? byKey.get(p.providerSku) : undefined;
    // Sin vínculo vigente (paquete creado a mano, o de otro proveedor tras cambiarlo): se vincula por la
    // cantidad total dentro de su región, o en la región global del proveedor si no tiene esa región.
    if (!product) {
      const total = p.diamonds + p.bonusDiamonds;
      product =
        rows.find((r) => r.regionSlug === p.region && isDiamondPack(r) && r.amount === total) ??
        rows.find((r) => r.regionSlug === GLOBAL_REGION && isDiamondPack(r) && r.amount === total);
      if (product) linked++;
    }
    if (!product) {
      if (p.providerSku && !p.supplierOutOfStock) {
        // El proveedor ya no lista ese producto: se trata como agotado.
        await db.diamondPackage.update({ where: { id: p.id }, data: { supplierOutOfStock: true } });
        updated++;
      }
      continue;
    }
    if (p.providerSku !== product.productKey || p.costCents !== product.priceCents || p.supplierOutOfStock !== product.outOfStock) {
      await db.diamondPackage.update({ where: { id: p.id }, data: { providerSku: product.productKey, costCents: product.priceCents, supplierOutOfStock: product.outOfStock } });
      updated++;
    }
  }
  await saveSettings({ supplierSyncedAt: now.toISOString() });
  return { products: rows.length, regions: groups.length, linked, updated };
}

/** Sincroniza si la copia local está vieja (Central One: 15 min; RechargeGame: 3 h). Nunca lanza error. */
export async function ensureFreshCatalog(): Promise<boolean> {
  const supplier = activeWholesale();
  if (!supplier) return false;
  const { syncedAt } = await supplierRate();
  if (syncedAt && Date.now() - syncedAt.getTime() < supplier.wholesale.catalogMaxAgeMs) return false;
  try {
    await syncSupplierCatalog();
    return true;
  } catch (e) {
    console.error("[proveedor] no se pudo sincronizar el catálogo:", (e as Error).message);
    return false;
  }
}

export type SupplierRegion = { slug: string; name: string; label: string; packs: number; minCents: number | null; maxCents: number | null; outOfStock: number; storePackages: number; enabled: boolean };

export async function listSupplierRegions(): Promise<SupplierRegion[]> {
  const [products, packages, { regions }] = await Promise.all([
    db.supplierProduct.findMany({ where: { game: GAME }, orderBy: { priceCents: "asc" } }),
    db.diamondPackage.groupBy({ by: ["region"], where: { active: true }, _count: { _all: true } }),
    supplierRate(),
  ]);
  const map = new Map<string, SupplierRegion>();
  for (const p of products) {
    if (!isDiamondPack(p)) continue;
    const r = map.get(p.regionSlug) ?? { slug: p.regionSlug, name: p.regionName, label: regionLabel(p.regionSlug, p.regionName), packs: 0, minCents: null, maxCents: null, outOfStock: 0, storePackages: 0, enabled: regions.includes(p.regionSlug) };
    r.packs++;
    if (p.outOfStock) r.outOfStock++;
    r.minCents = r.minCents == null ? p.priceCents : Math.min(r.minCents, p.priceCents);
    r.maxCents = r.maxCents == null ? p.priceCents : Math.max(r.maxCents, p.priceCents);
    map.set(p.regionSlug, r);
  }
  for (const g of packages) {
    const r = map.get(g.region);
    if (r) r.storePackages = g._count._all;
  }
  // Orden fijo (no cambia al activar/ocultar: evita clics en la fila equivocada).
  return [...map.values()].sort(compareRegions);
}

/**
 * Crea en la tienda los paquetes de diamantes de una región. Precio:
 *  - LATAM (región principal): costo × tasa + margen general.
 *  - Otras regiones: mismo margen que el escalón equivalente de LATAM, sin pasar su precio (ver regionalPrice).
 * Los que ya existen conservan su precio salvo que se pida recalcular.
 */
export async function importRegionPackages(regionSlug: string, opts: { reprice?: boolean } = {}) {
  const { usdtCop, margin } = await supplierRate();
  const products = (await db.supplierProduct.findMany({ where: { game: GAME, regionSlug }, orderBy: { amount: "asc" } })).filter(isDiamondPack);
  if (products.length === 0) return { created: 0, repriced: 0 };
  const existing = await db.diamondPackage.findMany({ where: { providerSku: { in: products.map((p) => p.productKey) } } });
  const latam =
    regionSlug === DEFAULT_TOPUP_REGION
      ? []
      : (await db.diamondPackage.findMany({ where: { region: DEFAULT_TOPUP_REGION, active: true }, select: { diamonds: true, bonusDiamonds: true, price: true, costCents: true } })).map((l) => ({
          amount: l.diamonds + l.bonusDiamonds,
          price: l.price,
          costCents: l.costCents,
        }));
  let created = 0;
  let repriced = 0;
  for (const [i, p] of products.entries()) {
    const price = regionalPrice({ amount: p.amount!, costCents: p.priceCents, usdtCop, latam })?.price ?? suggestedPrice(p.priceCents, usdtCop, margin);
    const found = existing.find((e) => e.providerSku === p.productKey);
    if (found) {
      if (opts.reprice && found.price !== price) {
        await db.diamondPackage.update({ where: { id: found.id }, data: { price, compareAtPrice: null, costCents: p.priceCents, supplierOutOfStock: p.outOfStock } });
        repriced++;
      }
      continue;
    }
    const { diamonds, bonusDiamonds } = splitBonus(p.amount!);
    let slug = `diamantes-${regionSlug}-${p.amount}`.slice(0, 180);
    if (await db.diamondPackage.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString(36)}`;
    await db.diamondPackage.create({
      data: {
        slug,
        name: `${p.amount} diamantes (${regionLabel(regionSlug, p.regionName)})`,
        diamonds,
        bonusDiamonds,
        price,
        region: regionSlug,
        providerSku: p.productKey,
        costCents: p.priceCents,
        supplierOutOfStock: p.outOfStock,
        sortOrder: i,
        active: true,
        available: true,
      },
    });
    created++;
  }
  return { created, repriced };
}

/** Tarjetas y pases del catálogo de una región que la tienda puede vender (entregables con el ID). */
export async function supplierPasses(regionSlug: string) {
  const rows = await db.supplierProduct.findMany({ where: { game: GAME, regionSlug, delivery: "player_id" }, orderBy: { priceCents: "asc" } });
  return rows.map((p) => ({ product: p, kind: passKindOf(p.name) })).filter((x): x is { product: (typeof rows)[number]; kind: NonNullable<ReturnType<typeof passKindOf>> } => !!x.kind && !x.product.amount);
}

/**
 * Crea en la tienda las tarjetas y pases de una región (sin diamantes: diamonds = 0, con su nombre).
 * Precio inicial: costo × tasa + margen general, como los diamantes; luego se ajusta en Paquetes.
 * Las que ya existen no se tocan.
 */
export async function importRegionPasses(regionSlug: string): Promise<{ created: number; names: string[] }> {
  const { usdtCop, margin } = await supplierRate();
  const found = await supplierPasses(regionSlug);
  const existing = new Set((await db.diamondPackage.findMany({ where: { providerSku: { in: found.map((f) => f.product.productKey) } }, select: { providerSku: true } })).map((p) => p.providerSku));
  const names: string[] = [];
  for (const { product, kind } of found) {
    if (existing.has(product.productKey) || names.includes(PASS_INFO[kind].title)) continue;
    let slug = `${kind === "weekly-lite" ? "tarjeta-semanal-basica" : kind === "weekly" ? "tarjeta-semanal" : kind === "monthly" ? "tarjeta-mensual" : "pase-booyah"}${regionSlug === DEFAULT_TOPUP_REGION ? "" : `-${regionSlug}`}`;
    if (await db.diamondPackage.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString(36)}`;
    await db.diamondPackage.create({
      data: {
        slug,
        name: PASS_INFO[kind].title,
        diamonds: 0,
        bonusDiamonds: 0,
        price: suggestedPrice(product.priceCents, usdtCop, margin),
        region: regionSlug,
        providerSku: product.productKey,
        costCents: product.priceCents,
        supplierOutOfStock: product.outOfStock,
        sortOrder: 100 + PASS_INFO[kind].sort,
        active: true,
        available: true,
      },
    });
    names.push(PASS_INFO[kind].title);
  }
  return { created: names.length, names };
}

// Cambios a la lista de regiones activas, uno a la vez (dos clics seguidos no deben pisarse).
let regionsLock: Promise<unknown> = Promise.resolve();
export function updateEnabledRegions(change: (current: string[]) => string[] | Promise<string[]>): Promise<string[]> {
  const run = regionsLock.then(async () => {
    const current = parseRegionList((await getSettings()).topupRegions);
    const next = [...new Set(await change(current))];
    await saveSettings({ topupRegions: next.join(",") });
    return next;
  });
  regionsLock = run.catch(() => {});
  return run;
}

/** Nombre de la región como lo usa el proveedor ("LATAM", "Brazil"), para pedidos y verificación de ID. */
export async function supplierRegionName(regionSlug: string): Promise<string | null> {
  const row =
    (await db.supplierProduct.findFirst({ where: { game: GAME, regionSlug }, select: { regionName: true } })) ??
    (await db.supplierProduct.findFirst({ where: { game: GAME, regionSlug: GLOBAL_REGION }, select: { regionName: true } }));
  return row?.regionName ?? null;
}

/** Paquete del proveedor con el que se comprueba un ID en una región (el más barato disponible). */
async function representativeProduct(regionSlug: string) {
  const pick = (slug: string) =>
    db.supplierProduct.findMany({ where: { game: GAME, regionSlug: slug, outOfStock: false, delivery: "player_id", unit: "Diamonds" }, orderBy: { priceCents: "asc" }, take: 1, select: { productKey: true, regionName: true } });
  return (await pick(regionSlug))[0] ?? (await pick(GLOBAL_REGION))[0] ?? null;
}

/** Busca el slug de región a partir del nombre que devuelve el verificador de IDs. */
export async function regionSlugFromName(name: string | null | undefined): Promise<string | null> {
  if (!name) return null;
  const rows = await db.supplierProduct.findMany({ where: { game: GAME }, distinct: ["regionSlug"], select: { regionSlug: true, regionName: true } });
  const n = name.toLowerCase().trim();
  return rows.find((r) => r.regionName.toLowerCase() === n || r.regionSlug === n)?.regionSlug ?? null;
}

/** Tasa del día USD→COP (fuente pública). El USDT se negocia muy cerca del dólar. */
export async function fetchDailyUsdCop(): Promise<number> {
  const res = await fetch("https://open.er-api.com/v6/latest/USD", { cache: "no-store", signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = (await res.json()) as { result?: string; rates?: Record<string, number> };
  const cop = j.rates?.COP;
  if (j.result !== "success" || !cop || cop < 1000 || cop > 10000) throw new Error("Respuesta inesperada");
  return Math.round(cop);
}

export type PlayerRegionCheck =
  /** verified: false = el proveedor no pudo comprobar el ID (se vende con la confirmación del cliente). */
  | { ok: true; playerId: string; region: string; regionSlug: string; verified?: boolean; message?: string; nickname?: string | null }
  | { ok: false; error: string; region?: string | null };

/** "Latinoamérica, Brasil o Europa" */
function regionsText(slugs: string[]) {
  const names = slugs.map((s) => regionLabel(s));
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} o ${names[names.length - 1]}`;
}

/**
 * Regla de venta: solo se recargan cuentas cuya región confirma el proveedor y que está activa en la tienda.
 * Sin región confirmada (EXISTS, verificador caído) no se vende: una recarga a otra región no llega.
 */
export async function checkPlayerRegion(provider: TopUpProvider, playerId: string, preferredRegion?: string | null): Promise<PlayerRegionCheck> {
  const { regions } = await supplierRate();
  if (provider.wholesale?.playerCheck === "per-product") return checkPerProduct(provider, playerId, regions, preferredRegion);
  const r = await provider.validatePlayer(playerId);
  if (r.verifiable && !r.valid) return { ok: false, error: r.message ?? "No encontramos ese ID de jugador. Revísalo e intenta de nuevo." };
  if (!r.verifiable) return { ok: false, error: r.message ?? "No pudimos verificar la región de esta cuenta ahora mismo. Intenta de nuevo en unos minutos." };
  const list = regionsText(regions);
  if (!r.region) {
    return { ok: false, error: `Encontramos la cuenta, pero no pudimos confirmar que sea de ${list}. Por ahora solo recargamos cuentas de esas regiones.` };
  }
  const slug = await regionSlugFromName(r.region);
  if (!slug || !regions.includes(slug)) {
    return { ok: false, region: r.region, error: `Esta cuenta es de ${regionLabel(slug, r.region)}. Por ahora solo recargamos cuentas de ${list}.` };
  }
  return { ok: true, playerId, region: r.region, regionSlug: slug };
}


/**
 * Central One no dice de qué región es una cuenta: el ID se comprueba contra un paquete de cada región
 * activa (primero la que está viendo el cliente). La primera donde la cuenta existe es su región.
 * Si el proveedor no puede comprobarlo (sin verificación para ese juego o caído), se vende igual con la
 * confirmación del cliente: si el ID estuviera mal, Central One no cobra y el pedido queda para reembolso.
 */
async function checkPerProduct(provider: TopUpProvider, playerId: string, regions: string[], preferred?: string | null): Promise<PlayerRegionCheck> {
  const order = [...new Set([preferred, ...regions].filter((r): r is string => !!r && regions.includes(r)))];
  let unverified: { slug: string; name: string; message?: string } | null = null;
  let checked = 0;
  for (const slug of order) {
    const product = await representativeProduct(slug);
    if (!product) continue;
    checked++;
    const r = await provider.validatePlayer(playerId, { productKey: product.productKey, region: product.regionName });
    if (r.verifiable && r.valid) return { ok: true, playerId, region: product.regionName, regionSlug: slug, verified: true, nickname: r.nickname?.trim().slice(0, 64) || null };
    if (!r.verifiable) unverified ??= { slug, name: product.regionName, message: r.message };
  }
  if (unverified) {
    return {
      ok: true,
      playerId,
      region: unverified.name,
      regionSlug: unverified.slug,
      verified: false,
      message: unverified.message ?? "El proveedor no permite comprobar este ID por ahora. Revisa que sea exactamente el de tu cuenta antes de pagar.",
    };
  }
  if (!checked) return { ok: false, error: "Por ahora no hay paquetes disponibles para recargar. Intenta más tarde." };
  return {
    ok: false,
    error: regions.length > 1 ? `No encontramos ese ID en ${regionsText(regions)}. Revísalo e intenta de nuevo.` : "No encontramos ese ID de jugador. Revísalo e intenta de nuevo.",
  };
}
