import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { ipFromHeaders } from "@/lib/request";
import { getPaymentProvider } from "@/server/integrations/payments";
import { activeTopUpProvider } from "@/server/integrations/topup";
import { applyDeliveryResult, applyVerifiedPayment, confirmApprovedWebhook } from "@/server/orders";

export const dynamic = "force-dynamic";

/**
 * Receptor único de webhooks: /api/webhooks/{bold|topup}
 * (topup = proveedor de recargas activo, p. ej. RechargeGame con firma Standard Webhooks)
 *  1. Verifica la firma con el secreto del proveedor (nunca confía en el cuerpo).
 *  2. Registra el evento con clave única (proveedor, id) → reintentos idempotentes.
 *  3. Aplica el resultado confirmado contra la API del proveedor.
 * Las respuestas nunca incluyen secretos ni detalles internos.
 */
export async function POST(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: providerId } = await params;
  const ip = ipFromHeaders(req.headers);
  if (!rateLimit(`webhook:${providerId}:${ip}`, 120, 60_000).ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const rawBody = await req.text();
  if (rawBody.length > 256_000) return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  const url = new URL(req.url);

  if (providerId === "topup") return handleTopUp(rawBody, req.headers);

  const provider = getPaymentProvider(providerId);
  if (!provider || !provider.isEnabled()) return NextResponse.json({ error: "not_found" }, { status: 404 });

  let result;
  try {
    result = await provider.handleWebhook({ rawBody, headers: req.headers, url });
  } catch (err) {
    console.error(`[webhook:${providerId}] error verificando evento:`, (err as Error).message);
    return NextResponse.json({ error: "temporary_error" }, { status: 500 }); // la pasarela reintentará
  }

  if (!result.ok) {
    console.warn(`[webhook:${providerId}] rechazado: ${result.reason}`);
    return NextResponse.json({ error: "rejected" }, { status: result.status });
  }

  // Un «aprobado» solo cuenta si la pasarela lo confirma al consultarla directamente (la firma sola no basta).
  // Si aún no lo confirma, la pasarela reintenta más tarde y el mantenimiento lo consulta mientras tanto.
  if (result.payment && !(await confirmApprovedWebhook(provider.id, result.payment).catch(() => false))) {
    console.warn(`[webhook:${providerId}] pago aprobado sin confirmar con la pasarela (${result.payment.reference}); no se aplica`);
    return NextResponse.json({ error: "not_confirmed" }, { status: 503 });
  }

  const event = await recordEvent(providerId, result.eventId, result.eventType, result.payload);
  if (!event) return NextResponse.json({ ok: true, duplicate: true });

  try {
    if (result.payment) {
      await applyVerifiedPayment(provider.id, result.payment, `WEBHOOK:${provider.id}`);
    }
    await db.webhookEvent.update({ where: { id: event.id }, data: { processedAt: new Date() } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = (err as Error).message.slice(0, 500);
    console.error(`[webhook:${providerId}] error procesando:`, message);
    // Se elimina el registro para que el reintento de la pasarela vuelva a procesarlo.
    await db.webhookEvent.delete({ where: { id: event.id } }).catch(() => {});
    return NextResponse.json({ error: "processing_error" }, { status: 500 });
  }
}

async function recordEvent(provider: string, externalId: string, type: string, payload: unknown) {
  try {
    return await db.webhookEvent.create({
      data: {
        provider,
        externalId: externalId.slice(0, 190),
        type,
        signatureValid: true,
        payload: sanitize(payload) as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return null;
    throw err;
  }
}

/** Elimina campos potencialmente sensibles antes de guardar el payload. */
function sanitize(payload: unknown): unknown {
  const SENSITIVE = /(token|secret|password|card|cvc|cvv|pan|document|phone|email|name|address)/i;
  if (Array.isArray(payload)) return payload.map(sanitize);
  if (payload && typeof payload === "object") {
    return Object.fromEntries(
      Object.entries(payload as Record<string, unknown>).map(([k, v]) => [k, SENSITIVE.test(k) && typeof v !== "object" ? "[redactado]" : sanitize(v)]),
    );
  }
  return payload;
}

async function handleTopUp(rawBody: string, headers: Headers) {
  // Proveedor de recargas activo (RechargeGame o API HTTP genérica); el simulado no recibe webhooks.
  const provider = activeTopUpProvider();
  if (!provider || provider.simulated) return NextResponse.json({ error: "not_found" }, { status: 404 });
  let result;
  try {
    result = await provider.handleWebhook({ rawBody, headers });
  } catch (err) {
    console.error("[webhook:topup] error verificando evento:", (err as Error).message);
    return NextResponse.json({ error: "temporary_error" }, { status: 500 }); // el proveedor reintentará
  }
  if (!result.ok) return NextResponse.json({ error: "rejected" }, { status: result.status });
  if (result.ignored) return NextResponse.json({ ok: true });

  const event = await recordEvent("topup", result.eventId, "delivery.updated", result.payload);
  if (!event) return NextResponse.json({ ok: true, duplicate: true });

  const delivery = await db.delivery.findFirst({ where: { idempotencyKey: result.idempotencyKey } });
  if (!delivery) {
    await db.webhookEvent.update({ where: { id: event.id }, data: { error: "Entrega no encontrada", processedAt: new Date() } });
    return NextResponse.json({ ok: true });
  }
  await applyDeliveryResult(delivery.id, result.result, `WEBHOOK:${provider.id}`);
  await db.webhookEvent.update({ where: { id: event.id }, data: { processedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
