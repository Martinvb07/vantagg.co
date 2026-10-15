import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { getCurrentUser, isStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { isSameOrigin } from "@/lib/request";
import { chatState, cleanBody, listMessages, markRead, peerPresence, peerReadAt, postMessage, touchPresence } from "@/server/chat";
import { readChatUpload } from "@/server/chat-upload";
import { notifyChatMessage } from "@/server/notifications";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

async function resolve(params: Promise<{ orderId: string }>) {
  const user = await getCurrentUser().catch(() => null);
  if (!user || !isStaff(user.role) || !user.totpEnabledAt) return { error: NextResponse.json({ error: "No autorizado." }, { status: 401 }) } as const;
  const { orderId } = await params;
  const order = await db.order.findUnique({ where: { id: orderId }, select: { id: true, type: true, status: true, deliveredAt: true } });
  if (!order) return { error: NextResponse.json({ error: "Pedido no encontrado." }, { status: 404 }) } as const;
  return { user, order } as const;
}

/** Mensajes del chat (equipo). Con `seen=1` (pantalla a la vista) deja de contar como pendiente y marca «visto». */
export async function GET(req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const r = await resolve(params);
  if ("error" in r) return r.error;
  const url = new URL(req.url);
  const afterRaw = url.searchParams.get("after");
  const after = afterRaw && !Number.isNaN(Date.parse(afterRaw)) ? new Date(afterRaw) : undefined;
  if (url.searchParams.get("seen") === "1") {
    touchPresence(r.order.id, "staff", false);
    await markRead(r.order.id, "staff");
  }
  const [messages, readAt] = await Promise.all([listMessages(r.order.id, after), peerReadAt(r.order.id, "staff")]);
  return NextResponse.json({ state: chatState(r.order), status: r.order.status, messages, peer: { ...peerPresence(r.order.id, "staff"), readAt } }, { headers: NO_STORE });
}

/** Mensaje de texto (JSON) o imagen con texto opcional (multipart). */
export async function POST(req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
  const r = await resolve(params);
  if ("error" in r) return r.error;
  if (chatState(r.order) === "hidden") return NextResponse.json({ error: "El chat se abre cuando se confirma el pago." }, { status: 409 });

  const limit = rateLimit(`chat:s:${r.user.id}`, 60, 60_000);
  if (!limit.ok) return NextResponse.json({ error: "Demasiados mensajes seguidos." }, { status: 429 });

  let message;
  if ((req.headers.get("content-type") ?? "").startsWith("multipart/form-data")) {
    const up = await readChatUpload(req);
    if (!up.ok) return NextResponse.json({ error: up.error }, { status: 400 });
    message = await postMessage(r.order.id, "STAFF", up.caption, r.user.id, up.file);
  } else {
    const json = (await req.json().catch(() => null)) as { body?: unknown } | null;
    const body = cleanBody(json?.body);
    if (!body) return NextResponse.json({ error: "Escribe un mensaje (máximo 2000 caracteres)." }, { status: 400 });
    message = await postMessage(r.order.id, "STAFF", body, r.user.id);
  }
  // Aviso por correo al comprador (sin el contenido del mensaje; máximo uno cada 15 min).
  void notifyChatMessage(r.order.id).catch(() => {});
  await markRead(r.order.id, "staff");
  // El contenido no va a la auditoría: puede incluir datos de acceso.
  await audit({ actorId: r.user.id, action: message.attachment ? "chat.image" : "chat.message", entity: "Order", entityId: r.order.id });
  return NextResponse.json({ message }, { status: 201, headers: NO_STORE });
}

/** «Escribiendo…» del equipo. */
export async function PATCH(req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
  const r = await resolve(params);
  if ("error" in r) return r.error;
  touchPresence(r.order.id, "staff", true);
  return new NextResponse(null, { status: 204 });
}
