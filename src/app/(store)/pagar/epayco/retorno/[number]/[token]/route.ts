import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { ipFromHeaders } from "@/lib/request";
import { applyGatewayReturn } from "@/server/orders";

export const dynamic = "force-dynamic";

/**
 * Regreso desde ePayco: llega con ?ref_payco=… (o por POST). Se consulta ese cobro a ePayco (nunca se confía en lo
 * que trae el navegador) y se lleva al cliente a su pedido. Ruta sin «?» propio para que ePayco agregue el suyo.
 */
async function handle(req: Request, params: Promise<{ number: string; token: string }>) {
  const { number, token } = await params;
  const orderNumber = decodeURIComponent(number).toUpperCase().slice(0, 40);
  const tracking = decodeURIComponent(token).slice(0, 100);
  const url = new URL(req.url);
  let ref = url.searchParams.get("ref_payco") ?? url.searchParams.get("x_ref_payco");
  if (!ref && req.method === "POST") {
    const body = await req.text().catch(() => "");
    const form = new URLSearchParams(body.slice(0, 20_000));
    ref = form.get("ref_payco") ?? form.get("x_ref_payco");
  }
  ref = ref && /^[A-Za-z0-9-]{1,40}$/.test(ref.trim()) ? ref.trim() : null;

  const limited = !rateLimit(`epayco-return:${ipFromHeaders(req.headers)}`, 20, 60_000).ok;
  const order = await applyGatewayReturn(orderNumber, tracking, limited ? null : ref).catch(() => null);
  const target = order ? `/pedido/${order.number}?t=${encodeURIComponent(tracking)}&from=pago` : "/";
  return NextResponse.redirect(new URL(target, env.appUrl), 303);
}

export async function GET(req: Request, { params }: { params: Promise<{ number: string; token: string }> }) {
  return handle(req, params);
}

export async function POST(req: Request, { params }: { params: Promise<{ number: string; token: string }> }) {
  return handle(req, params);
}
