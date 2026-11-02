import { NextResponse } from "next/server";
import { safeEqual } from "@/lib/crypto";
import { env } from "@/lib/env";
import { parseRegionList } from "@/domain/topup-regions";
import { activeTopUpProvider } from "@/server/integrations/topup";
import { getSettings } from "@/server/settings";
import { globalDeliveredToLatam, moveGlobalCardsToLatam, purgeRemovedPackages, turnOffRegions } from "@/server/supplier";

export const dynamic = "force-dynamic";

/**
 * Regiones y tarjetas (flujo manual «Regiones y tarjetas de Global»):
 *  - off: regiones a apagar en la tienda (p. ej. ["id"] = Indonesia); «Activar todo» no las vuelve a mostrar.
 *  - cards: pasar las tarjetas de membresía de Global a Latinoamérica si allá son más baratas (comprobado con Central One).
 *  - purge: borra de la base los paquetes de las regiones quitadas y las tarjetas viejas ya reemplazadas
 *    (los pedidos se conservan con su copia del producto).
 *  - dryRun: solo informa, no cambia nada.
 * Requiere: Authorization: Bearer <CRON_SECRET>. La respuesta no incluye costos, saldo ni IDs de jugadores.
 */
export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  if (!env.cronSecret || !safeEqual(auth, `Bearer ${env.cronSecret}`)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!activeTopUpProvider()?.wholesale) return NextResponse.json({ error: "No hay un proveedor mayorista configurado." }, { status: 409 });
  const body = (await req.json().catch(() => ({}))) as { off?: unknown; cards?: unknown; purge?: unknown; dryRun?: unknown };
  const off = Array.isArray(body.off) ? parseRegionList(body.off.map(String).join(",")) : [];
  const dryRun = body.dryRun !== false;
  try {
    const before = parseRegionList((await getSettings()).topupRegions);
    const regions = dryRun
      ? { before, after: before.filter((r) => !off.includes(r)), off: parseRegionList((await getSettings()).topupRegionsOff), deactivated: 0 }
      : off.length
        ? await turnOffRegions(off)
        : { before, after: before, off: parseRegionList((await getSettings()).topupRegionsOff), deactivated: 0 };
    const evidence = await globalDeliveredToLatam();
    const cards = body.cards === true ? await moveGlobalCardsToLatam({ dryRun }) : null;
    // Borrado definitivo de los paquetes de las regiones quitadas y de las tarjetas viejas ya reemplazadas.
    const purged = body.purge === true ? await purgeRemovedPackages({ dryRun }) : null;
    return NextResponse.json({ ok: true, dryRun, regions, evidence, cards, purged });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
