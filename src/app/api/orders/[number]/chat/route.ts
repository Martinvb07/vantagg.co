import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { clientIpHash, isSameOrigin } from "@/lib/request";
import { chatState, cleanBody, findCustomerChatOrder, listMessages, markRead, peerPresence, peerReadAt, postMessage, touchPresence } from "@/server/chat";
import { readChatUpload } from "@/server/chat-upload";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
const notFound = () => NextResponse.json({ error: "Pedido no encontrado." }, { status: 404, headers: NO_STORE });

async function resolve(req: Request, params: Promise<{ number: string }>) {
  const { number } = await params;
  const token = req.headers.get("x-order-token");
  const user = await getCurrentUser().catch(() => null);
  return findCustomerChatOrder(decodeURIComponent(number).toUpperCase().slice(0, 32), token, user);
}

/**
 * Mensajes del chat del pedido (comprador). `after` = ISO del último mensaje recibido.
 * `seen=1` solo cuando la página está a la vista: marca «visto» y «en línea».
 */
export async function GET(req: Request, { params }: { params: Promise<{ number: string }> }) {
  // El chat consulta cada 3 s; el límite deja margen para varias pestañas y frena el abuso.
  if (!rateLimit(`chat:poll:${await clientIpHash()}`, 150, 60_000).ok) return NextResponse.json({ error: "Demasiadas consultas." }, { status: 429 });
  const found = await resolve(req, params);
  if (!found) return notFound();
  const { order, staffViewer } = found;
  const state = chatState(order);
  if (state === "hidden") return NextResponse.json({ state, status: order.status, messages: [] }, { headers: NO_STORE });

  const url = new URL(req.url);
  const afterRaw = url.searchParams.get("after");
  const after = afterRaw && !Number.isNaN(Date.parse(afterRaw)) ? new Date(afterRaw) : undefined;
  if (!staffViewer && url.searchParams.get("seen") === "1") {
    touchPresence(order.id, "customer", false);
    await markRead(order.id, "customer");
  }
  const [messages, readAt] = await Promise.all([listMessages(order.id, after), peerReadAt(order.id, "customer")]);
  return NextResponse.json({ state, status: order.status, messages, staffViewer, peer: { ...peerPresence(order.id, "customer"), readAt } }, { headers: NO_STORE });
}

/** Mensaje de texto (JSON) o imagen con texto opcional (multipart). */
export async function POST(req: Request, { params }: { params: Promise<{ number: string }> }) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
  const found = await resolve(req, params);
  if (!found) return notFound();
  const { order, staffViewer } = found;
  if (staffViewer) return NextResponse.json({ error: "Responde desde el panel de chats." }, { status: 403 });
  if (chatState(order) !== "open") return NextResponse.json({ error: "Este chat está cerrado." }, { status: 409 });

  const ip = await clientIpHash();
  const limit = rateLimit(`chat:c:${order.id}:${ip}`, 15, 60_000);
  if (!limit.ok) return NextResponse.json({ error: "Estás enviando mensajes muy rápido. Espera un momento." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } });

  if ((req.headers.get("content-type") ?? "").startsWith("multipart/form-data")) {
    if (!rateLimit(`chat:c:img:${order.id}:${ip}`, 10, 10 * 60_000).ok) return NextResponse.json({ error: "Enviaste muchas imágenes seguidas. Espera unos minutos." }, { status: 429 });
    const up = await readChatUpload(req);
    if (!up.ok) return NextResponse.json({ error: up.error }, { status: 400 });
    const message = await postMessage(order.id, "CUSTOMER", up.caption, undefined, up.file);
    return NextResponse.json({ message }, { status: 201, headers: NO_STORE });
  }

  const json = (await req.json().catch(() => null)) as { body?: unknown } | null;
  const body = cleanBody(json?.body);
  if (!body) return NextResponse.json({ error: "Escribe un mensaje (máximo 2000 caracteres)." }, { status: 400 });

  const message = await postMessage(order.id, "CUSTOMER", body);
  return NextResponse.json({ message }, { status: 201, headers: NO_STORE });
}

/** «Escribiendo…»: el navegador avisa mientras el comprador teclea (máx. una vez cada 2,5 s). */
export async function PATCH(req: Request, { params }: { params: Promise<{ number: string }> }) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
  if (!rateLimit(`chat:typing:${await clientIpHash()}`, 40, 60_000).ok) return new NextResponse(null, { status: 204 });
  const found = await resolve(req, params);
  if (!found || found.staffViewer || chatState(found.order) !== "open") return new NextResponse(null, { status: 204 });
  touchPresence(found.order.id, "customer", true);
  return new NextResponse(null, { status: 204 });
}
