import { NextResponse } from "next/server";
import { safeEqual } from "@/lib/crypto";
import { env } from "@/lib/env";
import { runMaintenance } from "@/server/maintenance";

export const dynamic = "force-dynamic";

/**
 * Mantenimiento periódico (cada 2 min desde la tarea programada del servidor; ver src/server/maintenance.ts).
 * Si la tarea programada se detiene, el vigilante de la tienda hace lo mismo por su cuenta y avisa al equipo.
 * Requiere: Authorization: Bearer <CRON_SECRET>
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  if (!env.cronSecret || !safeEqual(auth, `Bearer ${env.cronSecret}`)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await runMaintenance("cron"));
}
