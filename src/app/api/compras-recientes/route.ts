import { NextResponse } from "next/server";
import { getLiveDeliveries } from "@/server/catalog";

export const dynamic = "force-dynamic";

type Live = Awaited<ReturnType<typeof getLiveDeliveries>>;
// Todas las visitas comparten la misma consulta durante 10 s: la lista se refresca seguido sin cargar la base.
let memo: { at: number; data: Live } | null = null;

/** Últimas 10 entregas completadas y cifras para «Entregas en vivo» (datos públicos, sin información personal). */
export async function GET() {
  try {
    if (!memo || Date.now() - memo.at > 10_000) memo = { at: Date.now(), data: await getLiveDeliveries(10) };
    return NextResponse.json(memo.data, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json(memo?.data ?? { items: [], stats: { today: 0, diamonds30d: 0 } }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
