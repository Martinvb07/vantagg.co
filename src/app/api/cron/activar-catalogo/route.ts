import { NextResponse } from "next/server";
import { safeEqual } from "@/lib/crypto";
import { env } from "@/lib/env";
import { activeTopUpProvider } from "@/server/integrations/topup";
import { activateAllFreeFire } from "@/server/supplier";

export const dynamic = "force-dynamic";

/**
 * Activa todo el catálogo de Free Fire del proveedor (lo mismo que Panel → Proveedor → «Activar todo»),
 * con la ganancia mínima que llega en el cuerpo: { "general": 30, "small": 40 } (% del precio de venta).
 * Lo usa el flujo manual «Activar catálogo Free Fire» desde el mismo servidor.
 * Requiere: Authorization: Bearer <CRON_SECRET>. La respuesta no incluye costos ni saldo.
 */
export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  if (!env.cronSecret || !safeEqual(auth, `Bearer ${env.cronSecret}`)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!activeTopUpProvider()?.wholesale) return NextResponse.json({ error: "No hay un proveedor mayorista configurado." }, { status: 409 });
  const body = (await req.json().catch(() => ({}))) as { general?: unknown; small?: unknown };
  const pct = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 80 ? Math.round(v * 10) / 10 : null);
  const general = pct(body.general);
  const small = pct(body.small ?? 0);
  if (general == null || small == null) return NextResponse.json({ error: "general y small deben ser números entre 0 y 80." }, { status: 400 });
  try {
    const r = await activateAllFreeFire({ general, small });
    // Precios de venta (son públicos en la tienda); la tasa sí se informa, los costos no.
    return NextResponse.json({ ok: true, ...r, repriced: r.repriced.map(({ name, region, from, to }) => ({ name, region, from, to })) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
