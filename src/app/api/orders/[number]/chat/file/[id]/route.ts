import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { clientIpHash } from "@/lib/request";
import { findCustomerChatOrder, readAttachment } from "@/server/chat";
import { imageResponse } from "@/server/chat-upload";

export const dynamic = "force-dynamic";

/** Imagen del chat para el comprador (token del pedido en el encabezado o sesión del dueño). */
export async function GET(req: Request, { params }: { params: Promise<{ number: string; id: string }> }) {
  if (!rateLimit(`chat:file:${await clientIpHash()}`, 120, 60_000).ok) return NextResponse.json({ error: "Demasiadas consultas." }, { status: 429 });
  const { number, id } = await params;
  const user = await getCurrentUser().catch(() => null);
  const found = await findCustomerChatOrder(decodeURIComponent(number).toUpperCase().slice(0, 32), req.headers.get("x-order-token"), user);
  if (!found) return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  const file = await readAttachment(found.order.id, id.slice(0, 40));
  if (!file) return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  return imageResponse(file);
}
