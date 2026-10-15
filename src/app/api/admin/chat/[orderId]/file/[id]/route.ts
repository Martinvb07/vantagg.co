import { NextResponse } from "next/server";
import { getCurrentUser, isStaff } from "@/lib/auth";
import { readAttachment } from "@/server/chat";
import { imageResponse } from "@/server/chat-upload";

export const dynamic = "force-dynamic";

/** Imagen del chat para el equipo (sesión con 2FA). */
export async function GET(_req: Request, { params }: { params: Promise<{ orderId: string; id: string }> }) {
  const user = await getCurrentUser().catch(() => null);
  if (!user || !isStaff(user.role) || !user.totpEnabledAt) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { orderId, id } = await params;
  const file = await readAttachment(orderId.slice(0, 40), id.slice(0, 40));
  if (!file) return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  return imageResponse(file);
}
