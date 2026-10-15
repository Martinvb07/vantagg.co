import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { clientIpHash } from "@/lib/request";
import { smartSearch } from "@/server/search";

export const dynamic = "force-dynamic";

/** Sugerencias en vivo del buscador. Solo lectura de datos públicos. */
export async function GET(req: Request) {
  const limit = rateLimit(`search:${await clientIpHash()}`, 120, 60_000);
  if (!limit.ok) return NextResponse.json({ error: "Demasiadas búsquedas, espera un momento." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } });

  const q = new URL(req.url).searchParams.get("q") ?? "";
  const result = await smartSearch(q);
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
