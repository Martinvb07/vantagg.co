"use server";

import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { DEFAULT_TOPUP_REGION, regionLabel } from "@/domain/topup-regions";
import { fetchDailyUsdCop, importRegionPackages, syncSupplierCatalog, updateEnabledRegions } from "@/server/supplier";
import { saveSettings } from "@/server/settings";
import type { ActionResult } from "./admin";

const ok = (message: string): ActionResult => ({ ok: true, message });
const fail = (message: string): ActionResult => ({ ok: false, message });
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

function refresh() {
  revalidatePath("/admin/proveedor");
  revalidatePath("/admin/paquetes");
  revalidatePath("/recargas");
  revalidatePath("/");
}

export async function syncSupplierAction(_: ActionResult, _form: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  if (!rateLimit(`supplier-sync:${user.id}`, 6, 60_000).ok) return fail("Espera un minuto antes de sincronizar de nuevo.");
  try {
    const r = await syncSupplierCatalog();
    await audit({ actorId: user.id, action: "supplier.sync", entity: "SupplierProduct", data: r });
    refresh();
    return ok(`Catálogo actualizado: ${r.products} productos en ${r.regions} regiones${r.linked ? ` · ${r.linked} paquete(s) vinculados` : ""}${r.updated ? ` · ${r.updated} paquete(s) con costo o existencias nuevos` : ""}.`);
  } catch (e) {
    return fail(`No se pudo sincronizar: ${(e as Error).message}`);
  }
}

export async function saveSupplierRatesAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const rate = Number(str(form, "usdtCop").replace(/[.\s]/g, "").replace(",", "."));
  const margin = Number(str(form, "topupMargin").replace(",", "."));
  if (!Number.isFinite(rate) || rate < 1000 || rate > 10000) return fail("La tasa debe estar entre 1.000 y 10.000 pesos por USDT.");
  if (!Number.isFinite(margin) || margin < 0 || margin > 300) return fail("El margen debe estar entre 0 % y 300 %.");
  const values = { usdtCop: String(Math.round(rate)), topupMargin: String(Math.round(margin * 10) / 10) };
  await saveSettings(values);
  await audit({ actorId: user.id, action: "supplier.rates", entity: "Setting", data: values });
  refresh();
  return ok("Tasa y margen guardados. Los precios actuales no cambian; usa «Recalcular precios» en la región que quieras.");
}

export async function dailyRateAction(_: ActionResult, _form: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  try {
    const usd = await fetchDailyUsdCop();
    // El USDT en Colombia suele costar un poco más que el dólar oficial: +2 % para no quedar corto.
    const rate = Math.round(usd * 1.02);
    await saveSettings({ usdtCop: String(rate) });
    await audit({ actorId: user.id, action: "supplier.rates", entity: "Setting", data: { usdtCop: rate, source: "open.er-api.com", usd } });
    refresh();
    return ok(`Tasa actualizada: $${rate.toLocaleString("es-CO")} por USDT (dólar del día $${usd.toLocaleString("es-CO")} + 2 %).`);
  } catch (e) {
    return fail(`No se pudo consultar la tasa del día: ${(e as Error).message}`);
  }
}

/** Activa o desactiva una región en la tienda. Al activarla por primera vez crea sus paquetes con precio sugerido. */
export async function toggleRegionAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const slug = str(form, "region").toLowerCase();
  if (!/^[a-z0-9-]{2,60}$/.test(slug)) return fail("Región inválida.");
  const enable = str(form, "op") === "enable";
  let created = 0;
  let lastOne = false;
  await updateEnabledRegions(async (current) => {
    if (enable) {
      created = (await importRegionPackages(slug)).created;
      return [...current, slug];
    }
    const next = current.filter((r) => r !== slug);
    if (next.length === 0) {
      lastOne = true;
      return current;
    }
    return next;
  });
  if (lastOne) return fail("Debe quedar al menos una región activa.");
  await audit({ actorId: user.id, action: enable ? "supplier.region_on" : "supplier.region_off", entity: "Setting", entityId: slug, data: { created } });
  refresh();
  const name = regionLabel(slug);
  return ok(enable ? `${name} activada${created ? `: ${created} paquete(s) creados con precio sugerido. Revísalos en «Diamantes y precios».` : "."}` : `${name} ya no se muestra en la tienda (sus paquetes se conservan).`);
}

export async function repriceRegionAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const slug = str(form, "region").toLowerCase();
  if (!/^[a-z0-9-]{2,60}$/.test(slug)) return fail("Región inválida.");
  if (slug === DEFAULT_TOPUP_REGION && str(form, "confirmMain") !== "1") return fail("Confirma que quieres reemplazar los precios de LATAM.");
  const r = await importRegionPackages(slug, { reprice: true });
  await audit({ actorId: user.id, action: "supplier.reprice", entity: "DiamondPackage", entityId: slug, data: r });
  refresh();
  return ok(`${regionLabel(slug)}: ${r.repriced} precio(s) recalculados${r.created ? ` y ${r.created} paquete(s) nuevos` : ""}.`);
}
