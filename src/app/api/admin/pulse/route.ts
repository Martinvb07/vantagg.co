import { NextResponse } from "next/server";
import { getCurrentUser, isStaff } from "@/lib/auth";
import { getAdminCounts } from "@/server/admin-counts";

export const dynamic = "force-dynamic";

/** Contadores del menú del panel (se consultan cada pocos segundos). */
export async function GET() {
  const user = await getCurrentUser().catch(() => null);
  if (!user || !isStaff(user.role) || !user.totpEnabledAt) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  return NextResponse.json(await getAdminCounts(), { headers: { "Cache-Control": "no-store" } });
}
