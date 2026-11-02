import "server-only";
import { db } from "@/lib/db";
import { compareRegions, DEFAULT_TOPUP_REGION, floorPrice, MIN_DIAMOND_PACK, minMarginFor, type MinMarginRule, parseRegionList, regionalPrice, regionLabel, splitBonus, suggestedPrice } from "@/domain/topup-regions";
import { PASS_INFO, passKindOf, type PassKind } from "@/domain/packs";
import { audit } from "@/lib/audit";
import { activeTopUpProvider, activeWholesale } from "./integrations/topup";
import { SupplierError } from "./integrations/topup/rechargegame";
import type { TopUpProvider } from "./integrations/topup/types";
import { getSettings, saveSettings } from "./settings";

/**
 * Catálogo del proveedor mayorista activo (Central One o RechargeGame): copia local + vínculo con los
 * paquetes de la tienda. La sincronización actualiza costos y existencias; los precios de venta solo cambian
 * solos para subir hasta la ganancia mínima que fijó el dueño (Panel → Proveedor), nunca para bajar.
 * Los costos se guardan en centavos de la moneda del proveedor (USD o USDT).
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
  const pct = (v: string | undefined) => (Number(v) > 0 && Number(v) < 90 ? Number(v) : 0);
  const minMargin: MinMarginRule = { general: pct(s.minMarginPct), small: pct(s.minMarginSmallPct) };
  return { usdtCop, margin, minMargin, regions: parseRegionList(s.topupRegions), syncedAt: s.supplierSyncedAt ? new Date(s.supplierSyncedAt) : null };
}

/** Diamantes y productos que se entregan con el ID; los paquetes muy chicos no se venden (ver MIN_DIAMOND_PACK). */
const sellableDiamonds = (p: { unit: string | null; amount: number | null; delivery: string }) => isDiamondPack(p) && (p.amount ?? 0) >= MIN_DIAMOND_PACK;

/** Precio de un paquete nuevo: el sugerido, sin bajar de la ganancia mínima. */
function withFloor(price: number, costCents: number, usdtCop: number, pct: number) {
  return pct > 0 ? Math.max(price, floorPrice(costCents, usdtCop, pct)) : price;
}

export type PriceChange = { id: string; name: string; region: string; from: number; to: number };

/**
 * Ganancia mínima: sube el precio de los paquetes activos (con costo conocido) que quedaron por debajo, por
 * ejemplo porque el proveedor subió su costo. Nunca baja un precio. Queda registrado en la auditoría.
 * Un paquete que se reactiva a mano se ajusta en la siguiente sincronización (cada 15 min) o al guardarlo.
 */
export async function enforceMinimumMargins(): Promise<PriceChange[]> {
  const { usdtCop, minMargin } = await supplierRate();
  if (!(minMargin.general > 0 || minMargin.small > 0)) return [];
  const pkgs = await db.diamondPackage.findMany({ where: { active: true, costCents: { not: null } }, select: { id: true, name: true, region: true, diamonds: true, bonusDiamonds: true, price: true, compareAtPrice: true, costCents: true } });
  const changes: PriceChange[] = [];
  for (const p of pkgs) {
    const pct = minMarginFor(p, minMargin);
    if (!(pct > 0)) continue;
    const floor = floorPrice(p.costCents!, usdtCop, pct);
    if (p.price >= floor) continue;
    // Condicional sobre el precio leído: si alguien lo editó justo ahora, no se pisa.
    const r = await db.diamondPackage.updateMany({ where: { id: p.id, price: p.price }, data: { price: floor, ...(p.compareAtPrice != null && p.compareAtPrice <= floor ? { compareAtPrice: null } : {}) } });
    if (r.count) changes.push({ id: p.id, name: p.name, region: p.region, from: p.price, to: floor });
  }
  if (changes.length) await audit({ actorId: null, action: "package.min_margin", entity: "DiamondPackage", data: { usdtCop, minMargin, changes } });
  return changes;
}

let syncing: Promise<SyncSummary> | null = null;
export type SyncSummary = { products: number; regions: number; linked: number; updated: number; repriced: number };

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
  // Protección: un catálogo vacío o al que le falta la mayoría de los productos vinculados es una falla del
  // proveedor, no «dejó de vender todo». No se aplica (se conserva la copia anterior) y se reintenta después.
  const incoming = new Set(groups.flatMap((g) => g.products.map((p) => p.product_key.slice(0, 191))));
  const linkedActive = (await db.diamondPackage.findMany({ where: { active: true, providerSku: { not: null } }, select: { providerSku: true } })).map((p) => p.providerSku!);
  const stillThere = linkedActive.filter((k) => incoming.has(k)).length;
  if (incoming.size === 0 || (linkedActive.length >= 4 && stillThere < linkedActive.length / 2)) {
    throw new SupplierError("incomplete_catalog", 0, `El proveedor devolvió un catálogo ${incoming.size === 0 ? "vacío" : `incompleto (${stillThere} de ${linkedActive.length} productos vinculados)`}: no se aplicó y se conserva la copia anterior.`);
  }
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
  // Costos nuevos: ningún paquete queda por debajo de la ganancia mínima.
  const repriced = await enforceMinimumMargins().catch((e) => {
    console.error("[proveedor] no se pudo aplicar la ganancia mínima:", (e as Error).message);
    return [] as PriceChange[];
  });
  return { products: rows.length, regions: groups.length, linked, updated, repriced: repriced.length };
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
  const { usdtCop, margin, minMargin } = await supplierRate();
  const products = (await db.supplierProduct.findMany({ where: { game: GAME, regionSlug }, orderBy: { amount: "asc" } })).filter(sellableDiamonds);
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
    const { diamonds, bonusDiamonds } = splitBonus(p.amount!, p.name);
    const base = regionalPrice({ amount: p.amount!, costCents: p.priceCents, usdtCop, latam })?.price ?? suggestedPrice(p.priceCents, usdtCop, margin);
    const price = withFloor(base, p.priceCents, usdtCop, minMarginFor({ diamonds, bonusDiamonds }, minMargin));
    const found = existing.find((e) => e.providerSku === p.productKey);
    if (found) {
      if (opts.reprice && found.price !== price) {
        await db.diamondPackage.update({ where: { id: found.id }, data: { price, compareAtPrice: null, costCents: p.priceCents, supplierOutOfStock: p.outOfStock } });
        repriced++;
      }
      continue;
    }
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
  const { usdtCop, margin, minMargin } = await supplierRate();
  const found = await supplierPasses(regionSlug);
  const existing = new Set((await db.diamondPackage.findMany({ where: { providerSku: { in: found.map((f) => f.product.productKey) } }, select: { providerSku: true } })).map((p) => p.providerSku));
  const names: string[] = [];
  for (const { product, kind } of found) {
    if (existing.has(product.productKey) || names.includes(PASS_INFO[kind].title)) continue;
    const slug = await freeSlug(passSlug(kind, regionSlug));
    await db.diamondPackage.create({
      data: {
        slug,
        name: PASS_INFO[kind].title,
        diamonds: 0,
        bonusDiamonds: 0,
        price: withFloor(suggestedPrice(product.priceCents, usdtCop, margin), product.priceCents, usdtCop, minMargin.general),
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

export type ActivatedPackage = { region: string; name: string; price: number };
export type ActivationResult = {
  regions: string[];
  created: ActivatedPackage[];
  reactivated: ActivatedPackage[];
  deactivated: ActivatedPackage[];
  repriced: PriceChange[];
  /** Paquetes de diamantes del proveedor que no se venden por ser muy chicos (menos de MIN_DIAMOND_PACK). */
  skippedSmall: number;
  rate: { before: number; after: number; dailyUsd: number | null };
};

/**
 * Activa todo lo que el proveedor vende de Free Fire y se entrega con el ID, en todas sus regiones: paquetes
 * de diamantes (desde MIN_DIAMOND_PACK), tarjetas, pases, paquetes de nivel y acceso Evo. Precios con la
 * ganancia mínima (`rule`, que queda guardada). Deja visibles todas las regiones con paquetes y desactiva
 * (no borra) los paquetes cuyo producto ya no existe o ya no se entrega con el ID.
 */
export async function activateAllFreeFire(rule?: MinMarginRule): Promise<ActivationResult> {
  // Copia fresca del catálogo (si llega vacío o incompleto, se detiene aquí sin tocar nada).
  await syncSupplierCatalog();
  // La regla se guarda después de sincronizar: así todos los precios que suben quedan en el informe de abajo.
  if (rule) await saveSettings({ minMarginPct: String(rule.general), minMarginSmallPct: String(rule.small) });

  // Tasa: si el dólar del día (+2 %, como «Usar la tasa del día») está por encima de la guardada, se usa ese.
  const before = (await supplierRate()).usdtCop;
  let dailyUsd: number | null = null;
  try {
    dailyUsd = await fetchDailyUsdCop();
    const daily = Math.round(dailyUsd * 1.02);
    if (daily > before) await saveSettings({ usdtCop: String(daily) });
  } catch (e) {
    console.error("[proveedor] no se pudo consultar la tasa del día:", (e as Error).message);
  }
  const { usdtCop, margin, minMargin } = await supplierRate();

  const rows = await db.supplierProduct.findMany({ where: { game: GAME, delivery: "player_id" }, orderBy: [{ regionSlug: "asc" }, { amount: "asc" }, { priceCents: "asc" }] });
  const deliverable = new Set(rows.map((r) => r.productKey));
  const skippedSmall = rows.filter((r) => isDiamondPack(r) && !sellableDiamonds(r)).length;

  // Qué se vende: un producto por cantidad de diamantes y uno por tipo de tarjeta/pase en cada región (el más barato).
  type Wanted = { row: (typeof rows)[number]; key: string; kind: PassKind | null };
  const wanted = new Map<string, Wanted>();
  for (const row of rows) {
    const kind = row.amount ? null : passKindOf(row.name);
    if (!kind && !sellableDiamonds(row)) continue;
    const key = `${row.regionSlug}|${kind ?? `d${row.amount}`}`;
    const prev = wanted.get(key);
    if (!prev || (prev.row.outOfStock && !row.outOfStock) || (prev.row.outOfStock === row.outOfStock && row.priceCents < prev.row.priceCents)) wanted.set(key, { row, key, kind });
  }

  const pkgs = await db.diamondPackage.findMany({ orderBy: { updatedAt: "desc" } });
  const pkgKey = (p: (typeof pkgs)[number]) => {
    const kind = p.diamonds > 0 ? null : passKindOf(p.name);
    return `${p.region}|${kind ?? `d${p.diamonds + p.bonusDiamonds}`}`;
  };
  const created: ActivatedPackage[] = [];
  const reactivated: ActivatedPackage[] = [];
  const deactivated: ActivatedPackage[] = [];

  // 1) Lo que ya no se puede entregar se desactiva (los pedidos y el historial no se tocan).
  for (const p of pkgs) {
    if (!p.active || !p.providerSku || deliverable.has(p.providerSku)) continue;
    await db.diamondPackage.update({ where: { id: p.id }, data: { active: false } });
    p.active = false;
    deactivated.push({ region: p.region, name: p.name, price: p.price });
  }

  // 2) Cada producto vendible queda con un paquete activo: el que ya existe, uno desactivado que se reactiva, o uno nuevo.
  const latam = (await db.diamondPackage.findMany({ where: { region: DEFAULT_TOPUP_REGION, active: true, diamonds: { gt: 0 } }, select: { diamonds: true, bonusDiamonds: true, price: true, costCents: true } })).map((l) => ({
    amount: l.diamonds + l.bonusDiamonds,
    price: l.price,
    costCents: l.costCents,
  }));
  const order = new Map<string, number>();
  for (const { row, key, kind } of [...wanted.values()].sort((a, b) => (a.row.amount ?? 0) - (b.row.amount ?? 0))) {
    const linked = pkgs.filter((p) => p.providerSku === row.productKey);
    if (linked.some((p) => p.active) || pkgs.some((p) => p.active && pkgKey(p) === key)) continue;
    const old = linked.find((p) => !p.isDemo);
    if (old) {
      await db.diamondPackage.update({ where: { id: old.id }, data: { active: true, available: true, costCents: row.priceCents, supplierOutOfStock: row.outOfStock } });
      old.active = true;
      reactivated.push({ region: old.region, name: old.name, price: old.price });
      continue;
    }
    if (row.outOfStock) continue; // no se crean paquetes agotados
    const label = regionLabel(row.regionSlug, row.regionName);
    if (kind) {
      const price = withFloor(suggestedPrice(row.priceCents, usdtCop, margin), row.priceCents, usdtCop, minMargin.general);
      const pkg = await db.diamondPackage.create({
        data: { slug: await freeSlug(passSlug(kind, row.regionSlug)), name: PASS_INFO[kind].title, diamonds: 0, bonusDiamonds: 0, price, region: row.regionSlug, providerSku: row.productKey, costCents: row.priceCents, supplierOutOfStock: false, sortOrder: 100 + PASS_INFO[kind].sort, active: true, available: true },
      });
      pkgs.push(pkg);
      created.push({ region: row.regionSlug, name: pkg.name, price });
    } else {
      const { diamonds, bonusDiamonds } = splitBonus(row.amount!, row.name);
      const base = row.regionSlug === DEFAULT_TOPUP_REGION ? suggestedPrice(row.priceCents, usdtCop, margin) : (regionalPrice({ amount: row.amount!, costCents: row.priceCents, usdtCop, latam })?.price ?? suggestedPrice(row.priceCents, usdtCop, margin));
      const price = withFloor(base, row.priceCents, usdtCop, minMarginFor({ diamonds, bonusDiamonds }, minMargin));
      const n = order.get(row.regionSlug) ?? 0;
      order.set(row.regionSlug, n + 1);
      const pkg = await db.diamondPackage.create({
        data: { slug: await freeSlug(`diamantes-${row.regionSlug}-${row.amount}`.slice(0, 180)), name: `${row.amount} diamantes (${label})`, diamonds, bonusDiamonds, price, region: row.regionSlug, providerSku: row.productKey, costCents: row.priceCents, supplierOutOfStock: false, sortOrder: 50 + n, active: true, available: true },
      });
      pkgs.push(pkg);
      created.push({ region: row.regionSlug, name: pkg.name, price });
    }
  }

  // 3) Todas las regiones con algo que vender quedan visibles (Latinoamérica primero, «Global» al final),
  //    salvo las que se apagaron a mano (p. ej. Indonesia): esas siguen ocultas.
  const off = new Set(parseRegionList((await getSettings()).topupRegionsOff));
  const withPackages = [...new Set(pkgs.filter((p) => p.active && p.providerSku && deliverable.has(p.providerSku) && !off.has(p.region)).map((p) => p.region))];
  const regions = withPackages.map((slug) => ({ slug, label: regionLabel(slug) })).sort(compareRegions).map((r) => r.slug);
  if (regions.length) await updateEnabledRegions(() => regions);

  // 4) Ganancia mínima en todo (sube los que quedaron por debajo; nunca baja precios).
  const repriced = await enforceMinimumMargins();
  const result: ActivationResult = { regions, created, reactivated, deactivated, repriced, skippedSmall, rate: { before, after: usdtCop, dailyUsd } };
  await audit({ actorId: null, action: "supplier.activate_all", entity: "DiamondPackage", data: { regions, created: created.length, reactivated: reactivated.length, deactivated: deactivated.length, repriced: repriced.length, minMargin, usdtCop } });
  return result;
}

/** Slug de una tarjeta o pase: «tarjeta-semanal», «paquete-de-nivel-10-brazil»… */
function passSlug(kind: PassKind, regionSlug: string) {
  const base = kind === "booyah" ? "pase-booyah" : PASS_INFO[kind].title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${base}${regionSlug === DEFAULT_TOPUP_REGION ? "" : `-${regionSlug}`}`.slice(0, 180);
}

async function freeSlug(slug: string) {
  return (await db.diamondPackage.findUnique({ where: { slug }, select: { id: true } })) ? `${slug}-${Date.now().toString(36)}` : slug;
}

/**
 * Recuerda las regiones apagadas a mano (para que «Activar todo» no las vuelva a mostrar) o las quita de esa
 * lista al encenderlas de nuevo.
 */
export async function rememberRegionsOff(slugs: string[], off: boolean): Promise<string[]> {
  const current = parseRegionList((await getSettings()).topupRegionsOff);
  const next = off ? [...new Set([...current, ...slugs])] : current.filter((r) => !slugs.includes(r));
  if (next.join(",") !== current.join(",")) await saveSettings({ topupRegionsOff: next.join(",") });
  return next;
}

/** Apaga regiones en la tienda (siempre queda al menos una). Los paquetes y pedidos no se tocan. */
export async function turnOffRegions(slugs: string[]): Promise<{ before: string[]; after: string[]; off: string[] }> {
  const before = parseRegionList((await getSettings()).topupRegions);
  const after = await updateEnabledRegions((current) => {
    const next = current.filter((r) => !slugs.includes(r));
    return next.length ? next : current;
  });
  const off = await rememberRegionsOff(slugs.filter((r) => !after.includes(r)), true);
  return { before, after, off };
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
  const check = async (slug: string) => {
    const product = await representativeProduct(slug);
    if (!product) return null;
    checked++;
    return { slug, product, r: await provider.validatePlayer(playerId, { productKey: product.productKey, region: product.regionName }) };
  };
  // Primero la región que está viendo el cliente (lo normal: una sola consulta); si no es esa, las demás a la vez
  // para no hacerlo esperar región por región. Gana la primera de la lista donde la cuenta existe.
  const [first, ...rest] = order;
  const results = first ? [await check(first)] : [];
  if (!(results[0]?.r.verifiable && results[0].r.valid)) results.push(...(await Promise.all(rest.map(check))));
  for (const x of results) {
    if (!x) continue;
    const { slug, product, r } = x;
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

// ---------------------------------------------------------------------
// Tarjetas de Global en Latinoamérica
// ---------------------------------------------------------------------

/**
 * La ficha del producto de Global dice que sirve en todas las regiones salvo algunas y Latinoamérica no está entre
 * ellas: «Free Fire · Tarjeta Semanal (excepto VN/TH/ID/Medio Oriente)».
 */
export function globalNameCoversLatam(name: string): boolean {
  const m = /\((?:excepto|except|excluding|salvo|sin)\s+([^)]*)\)/i.exec(name);
  return !!m && !/lat(?:am|in)|am[eé]rica|sudam|sur\s*am|centroam|brasil|brazil/i.test(m[1]);
}

/** Tarjetas de membresía (no pases): las que se pasan de Global a Latinoamérica si allá son más baratas. */
export const MEMBERSHIP_CARDS: PassKind[] = ["weekly-lite", "weekly", "monthly"];

export type CardMove = {
  card: string;
  action: "moved" | "created" | "kept" | "skipped";
  reason: string;
  priceFrom: number | null;
  priceTo: number | null;
  /** Comprobación con Central One: cuentas reales de Latinoamérica que el producto de Global acepta. */
  checks: { valid: number; invalid: number; unverified: number };
};

/**
 * Pasa las tarjetas de membresía de Latinoamérica al producto de Global cuando el de Global es más barato (o en
 * Latinoamérica no existe o está agotado), para venderlas a mejor precio. Solo si Central One confirma, con IDs
 * reales de cuentas de Latinoamérica (de pedidos entregados), que el producto de Global las acepta: es la misma
 * comprobación gratuita que se hace con cada cliente, no compra nada. El precio baja al de la tarjeta de Global
 * en la tienda (o al sugerido), nunca por debajo de la ganancia mínima. `dryRun`: solo informa.
 */
export async function moveGlobalCardsToLatam(opts: { dryRun?: boolean } = {}): Promise<{ moves: CardMove[]; accounts: number }> {
  const provider = activeTopUpProvider();
  if (!provider?.wholesale || provider.wholesale.playerCheck !== "per-product") throw new SupplierError("not_configured", 0, "Hace falta Central One para comprobar las cuentas.");
  await syncSupplierCatalog();
  const { usdtCop, margin, minMargin } = await supplierRate();
  const latamName = (await supplierRegionName(DEFAULT_TOPUP_REGION)) ?? "LATAM";

  const cheapest = async (region: string) => {
    const byKind = new Map<PassKind, Awaited<ReturnType<typeof supplierPasses>>[number]["product"]>();
    for (const { product, kind } of await supplierPasses(region)) {
      const prev = byKind.get(kind);
      if (!prev || (prev.outOfStock && !product.outOfStock) || (prev.outOfStock === product.outOfStock && product.priceCents < prev.priceCents)) byKind.set(kind, product);
    }
    return byKind;
  };
  const [global, latam] = await Promise.all([cheapest(GLOBAL_REGION), cheapest(DEFAULT_TOPUP_REGION)]);

  // Cuentas reales de Latinoamérica: IDs de recargas entregadas en esa región (los más recientes, sin repetir).
  const recent = await db.order.findMany({
    where: { type: "TOPUP", status: "DELIVERED", isTest: false, playerId: { not: null }, itemSnapshot: { path: "$.region", equals: DEFAULT_TOPUP_REGION } },
    orderBy: { deliveredAt: "desc" },
    take: 60,
    select: { playerId: true },
  });
  const ids = [...new Set(recent.map((r) => r.playerId!).filter((id) => /^\d{6,12}$/.test(id)))].slice(0, 5);

  const pkgs = await db.diamondPackage.findMany({ where: { diamonds: 0 }, orderBy: { updatedAt: "desc" } });
  const moves: CardMove[] = [];
  for (const kind of MEMBERSHIP_CARDS) {
    const card = PASS_INFO[kind].title;
    const g = global.get(kind);
    const pkg = pkgs.find((p) => p.region === DEFAULT_TOPUP_REGION && p.active && passKindOf(p.name) === kind) ?? null;
    const move = (action: CardMove["action"], reason: string, checks = { valid: 0, invalid: 0, unverified: 0 }, priceTo: number | null = pkg?.price ?? null): CardMove => ({ card, action, reason, priceFrom: pkg?.price ?? null, priceTo, checks });
    if (!g) { moves.push(move("skipped", "Central One no vende esta tarjeta en Global.")); continue; }
    if (g.outOfStock) { moves.push(move("skipped", "La de Global está agotada.")); continue; }
    if (pkg?.providerSku === g.productKey) { moves.push(move("kept", "Ya usa la tarjeta de Global.")); continue; }
    const own = latam.get(kind);
    const currentCost = pkg?.costCents ?? own?.priceCents ?? null;
    const latamUsable = !!pkg && !pkg.supplierOutOfStock && currentCost != null;
    if (latamUsable && g.priceCents >= currentCost!) { moves.push(move("kept", "La de Latinoamérica ya cuesta igual o menos que la de Global.")); continue; }

    // ¿Central One entrega la de Global a cuentas de Latinoamérica? Se pregunta con cuentas reales (gratis).
    const checks = { valid: 0, invalid: 0, unverified: 0 };
    for (const id of ids) {
      const r = await provider.validatePlayer(id, { productKey: g.productKey, region: latamName }).catch(() => ({ valid: true, verifiable: false }) as const);
      if (r.verifiable && r.valid) checks.valid++;
      else if (r.verifiable) checks.invalid++;
      else checks.unverified++;
      if (checks.valid >= 2) break;
    }
    // Vale si Central One acepta cuentas de Latinoamérica, o si no tiene verificación para esta tarjeta y su ficha dice
    // que sirve fuera de las regiones excluidas (Latinoamérica no está entre ellas). Si rechaza alguna cuenta, no se mueve.
    const declared = globalNameCoversLatam(g.name);
    if (checks.invalid > 0 && !checks.valid) { moves.push(move("skipped", "Central One rechazó cuentas de Latinoamérica con la tarjeta de Global.", checks)); continue; }
    if (!checks.valid && !(declared && ids.length)) {
      moves.push(move("skipped", ids.length ? "Central One no confirmó que la tarjeta de Global sirva para cuentas de Latinoamérica." : "No hay cuentas de Latinoamérica con entregas para comprobarla.", checks));
      continue;
    }
    const basis = checks.valid ? "Central One aceptó cuentas de Latinoamérica" : `Central One no verifica IDs para esta tarjeta; su ficha dice «${g.name.replace(/^.*?\(/, "(")}»`;

    // Precio: el de esa tarjeta en Global en la tienda (o el sugerido), nunca más caro que el actual ni bajo la ganancia mínima.
    const globalListing = pkgs.find((p) => p.active && p.providerSku === g.productKey);
    const target = globalListing?.price ?? suggestedPrice(g.priceCents, usdtCop, margin);
    const price = withFloor(pkg ? Math.min(pkg.price, target) : target, g.priceCents, usdtCop, minMargin.general);
    if (opts.dryRun) { moves.push(move(pkg ? "moved" : "created", `Se haría (modo revisar). ${basis}.`, checks, price)); continue; }
    if (pkg) {
      await db.diamondPackage.update({
        where: { id: pkg.id },
        // Si el precio cambia, se quita el «precio anterior» tachado (no se inventan descuentos).
        data: { providerSku: g.productKey, costCents: g.priceCents, supplierOutOfStock: false, available: true, price, ...(pkg.compareAtPrice != null && (price !== pkg.price || pkg.compareAtPrice <= price) ? { compareAtPrice: null } : {}) },
      });
      moves.push(move("moved", `${pkg.supplierOutOfStock ? "La de Latinoamérica estaba agotada; ahora usa la de Global." : "Ahora usa la tarjeta de Global (más barata)."} ${basis}.`, checks, price));
    } else {
      await db.diamondPackage.create({
        data: { slug: await freeSlug(passSlug(kind, DEFAULT_TOPUP_REGION)), name: card, diamonds: 0, bonusDiamonds: 0, price, region: DEFAULT_TOPUP_REGION, providerSku: g.productKey, costCents: g.priceCents, supplierOutOfStock: false, sortOrder: 100 + PASS_INFO[kind].sort, active: true, available: true },
      });
      moves.push(move("created", `Latinoamérica no la tenía: se agregó con la de Global. ${basis}.`, checks, price));
    }
  }
  if (!opts.dryRun && moves.some((m) => m.action === "moved" || m.action === "created")) {
    await audit({ actorId: null, action: "supplier.global_cards_latam", entity: "DiamondPackage", data: { moves: moves.map(({ card, action, priceFrom, priceTo, checks }) => ({ card, action, priceFrom, priceTo, checks })) } });
  }
  return { moves, accounts: ids.length };
}

/**
 * Prueba con el historial: recargas de Global ya entregadas a cuentas que también recibieron recargas de
 * Latinoamérica (es decir, cuentas de Latinoamérica a las que el producto de Global sí les llegó). Solo conteos.
 */
export async function globalDeliveredToLatam(): Promise<{ globalDelivered: number; latamAccounts: number }> {
  const where = (region: string) => ({ type: "TOPUP" as const, status: "DELIVERED" as const, isTest: false, playerId: { not: null }, itemSnapshot: { path: "$.region", equals: region } });
  const [g, l] = await Promise.all([
    db.order.findMany({ where: where(GLOBAL_REGION), select: { playerId: true }, take: 5000 }),
    db.order.findMany({ where: where(DEFAULT_TOPUP_REGION), select: { playerId: true }, distinct: ["playerId"], take: 20000 }),
  ]);
  const latamIds = new Set(l.map((o) => o.playerId));
  return { globalDelivered: g.length, latamAccounts: new Set(g.map((o) => o.playerId).filter((id) => latamIds.has(id))).size };
}
