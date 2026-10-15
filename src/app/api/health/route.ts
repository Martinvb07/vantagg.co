import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Para el monitor de caídas: 200 si la tienda y la base de datos responden, 503 si no. Sin datos internos. */
export async function GET() {
  const started = Date.now();
  let dbOk = false;
  try {
    await db.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {
    dbOk = false;
  }
  return NextResponse.json({ ok: dbOk, db: dbOk ? "ok" : "error", ms: Date.now() - started }, { status: dbOk ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
