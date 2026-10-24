"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { safeEqual } from "@/lib/crypto";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";
import { claimSchema, emailSchema, firstError, playerIdSchema, ticketSchema, trackingSchema } from "@/lib/validation";
import { previewPromo } from "@/server/promo";
import { quotePrice } from "@/domain/pricing";
import { createAccountOrder, createTopUpOrder, resumeCheckout, type CreateOrderResult } from "@/server/orders";
import { activeTopUpProvider } from "@/server/integrations/topup";
import { checkPlayerRegion } from "@/server/supplier";
import { regionLabel } from "@/domain/topup-regions";
import { accountsVisible, listingAvailability } from "@/server/catalog";
import { notifyClaim, notifyStaffTicket, notifyTicketReceived } from "@/server/notifications";
import { caughtByHoneypot } from "@/lib/honeypot";

async function limited(bucket: string, limit: number, windowMs: number) {
  const r = rateLimit(`${bucket}:${await clientIp()}`, limit, windowMs);
  return r.ok ? null : `Demasiados intentos. Espera ${r.retryAfterSec} s e intenta de nuevo.`;
}

// ---------------------------------------------------------------------
// Recargas
// ---------------------------------------------------------------------

export type PlayerCheck =
  | {
      ok: true;
      /** ID verificado (la página descarta respuestas de un ID anterior). */
      playerId: string;
      verifiable: boolean;
      nickname: string | null;
      /** Región real de la cuenta según el proveedor (texto) y su slug si la tienda la conoce. */
      region: string | null;
      regionSlug: string | null;
      regionLabel: string | null;
      /** La región elegida coincide con la de la cuenta: "ok" | "wrong" | "unknown". */
      regionMatch: "ok" | "wrong" | "unknown";
      message?: string;
    }
  | { ok: false; error: string };

export async function validatePlayerAction(playerId: string, regionSlug?: string): Promise<PlayerCheck> {
  const tooMany = await limited("player", 20, 60_000);
  if (tooMany) return { ok: false, error: tooMany };
  const parsed = playerIdSchema.safeParse(playerId);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const provider = activeTopUpProvider();
  if (!provider) return { ok: false, error: "Las recargas automáticas no están habilitadas en este momento." };
  const supplier = provider.id === "rechargegame";
  const slug = typeof regionSlug === "string" && /^[a-z0-9-]{2,60}$/.test(regionSlug) ? regionSlug : null;
  try {
    if (supplier) {
      // Solo pasan cuentas de una región activa confirmada por el proveedor; la página cambia sola a esa región.
      const c = await checkPlayerRegion(provider, parsed.data);
      if (!c.ok) return { ok: false, error: c.error };
      return {
        ok: true,
        playerId: parsed.data,
        verifiable: true,
        // El nombre que devuelve el verificador del proveedor está desactualizado (probado: muestra apodos viejos)
        // y el proveedor no ofrece otra consulta; Garena no permite consultarlo. No se muestra.
        nickname: null,
        region: c.region,
        regionSlug: c.regionSlug,
        regionLabel: regionLabel(c.regionSlug, c.region),
        regionMatch: slug && slug !== c.regionSlug ? "wrong" : "ok",
      };
    }
    // Otros proveedores (simulado / API genérica): solo apodo y región informativa.
    const r = await provider.validatePlayer(parsed.data);
    if (r.verifiable && !r.valid) return { ok: false, error: r.message ?? "No encontramos ese ID de jugador. Revísalo e intenta de nuevo." };
    return {
      ok: true,
      playerId: parsed.data,
      verifiable: r.verifiable,
      nickname: r.nickname ?? null,
      region: r.region ?? null,
      regionSlug: null,
      regionLabel: r.region ?? null,
      regionMatch: r.regionMatch ?? "unknown",
      message: r.message,
    };
  } catch {
    return { ok: false, error: "No pudimos verificar el ID en este momento. Intenta de nuevo." };
  }
}

export async function createTopUpOrderAction(input: unknown): Promise<CreateOrderResult> {
  const tooMany = await limited("order", 8, 10 * 60_000);
  if (tooMany) return { ok: false, error: tooMany };
  const user = await getCurrentUser();
  try {
    return await createTopUpOrder(input, user?.id ?? null);
  } catch (err) {
    console.error("[checkout] error creando orden de recarga:", (err as Error).message);
    return { ok: false, error: "No pudimos crear el pedido. Intenta de nuevo en unos segundos." };
  }
}

// ---------------------------------------------------------------------
// Cuentas
// ---------------------------------------------------------------------

export async function createAccountOrderAction(input: unknown): Promise<CreateOrderResult> {
  const tooMany = await limited("order", 8, 10 * 60_000);
  if (tooMany) return { ok: false, error: tooMany };
  if (!(await accountsVisible())) return { ok: false, error: "Por ahora no estamos vendiendo cuentas." };
  const user = await getCurrentUser();
  try {
    return await createAccountOrder(input, user?.id ?? null);
  } catch (err) {
    console.error("[checkout] error creando orden de cuenta:", (err as Error).message);
    return { ok: false, error: "No pudimos crear el pedido. Intenta de nuevo en unos segundos." };
  }
}

export async function submitClaimAction(_: unknown, form: FormData): Promise<{ ok: boolean; message: string }> {
  if (caughtByHoneypot(form)) return { ok: true, message: "Recibimos tu reclamo." };
  const tooMany = await limited("claim", 3, 60 * 60_000);
  if (tooMany) return { ok: false, message: tooMany };
  const parsed = claimSchema.safeParse({ accountId: form.get("accountId"), email: form.get("email"), reason: form.get("reason") });
  if (!parsed.success) return { ok: false, message: firstError(parsed.error) };
  const listing = await db.accountListing.findUnique({ where: { id: parsed.data.accountId } });
  if (!listing) return { ok: false, message: "Publicación no encontrada." };
  const claim = await db.listingClaim.create({ data: parsed.data });
  void notifyClaim(claim.id).catch(() => {});
  return { ok: true, message: "Recibimos tu reclamación. El equipo la revisará y, si corresponde, suspenderá la publicación mientras se resuelve." };
}

/** Vista previa de un código promocional. El precio se toma de la BD, nunca del navegador. */
export async function previewPromoAction(input: {
  code: string;
  kind: "TOPUP" | "ACCOUNT";
  itemId: string;
  email?: string;
}): Promise<{ ok: true; code: string; discount: number; total: number } | { ok: false; error: string }> {
  // Cada cambio de paquete con un código puesto también valida: margen para comparar paquetes sin bloquear al cliente.
  const tooMany = await limited("promo", 40, 10 * 60_000);
  if (tooMany) return { ok: false, error: tooMany };
  if (typeof input?.code !== "string" || typeof input.itemId !== "string" || input.code.length > 40 || input.itemId.length > 40) {
    return { ok: false, error: "El código no es válido o ya no está vigente." };
  }
  const email = input.email && emailSchema.safeParse(input.email).success ? input.email.trim().toLowerCase() : undefined;
  let base: number | null = null;
  if (input.kind === "TOPUP") {
    const p = await db.diamondPackage.findUnique({ where: { id: input.itemId }, select: { price: true, active: true } });
    if (p?.active) base = p.price;
  } else if (input.kind === "ACCOUNT") {
    const a = await db.accountListing.findUnique({ where: { id: input.itemId }, select: { price: true } });
    base = a?.price ?? null;
  }
  if (base == null) return { ok: false, error: "Producto no disponible." };
  const r = await previewPromo({ code: input.code, kind: input.kind, subtotal: base, email });
  if (!r.ok) return { ok: false, error: r.message };
  return { ok: true, code: r.code, discount: r.discount, total: base - r.discount };
}

export async function resumePaymentAction(number: string, token: string): Promise<CreateOrderResult> {
  const tooMany = await limited("resume", 10, 10 * 60_000);
  if (tooMany) return { ok: false, error: tooMany };
  const order = await db.order.findUnique({ where: { number } });
  if (!order || !safeEqual(order.trackingToken, token)) return { ok: false, error: "Pedido no encontrado." };
  return resumeCheckout(order.id);
}

// ---------------------------------------------------------------------
// Seguimiento y soporte
// ---------------------------------------------------------------------

export async function trackOrderAction(_: unknown, form: FormData): Promise<{ error: string } | never> {
  const tooMany = await limited("track", 15, 10 * 60_000);
  if (tooMany) return { error: tooMany };
  const parsed = trackingSchema.safeParse({ number: form.get("number"), email: form.get("email") });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const order = await db.order.findUnique({ where: { number: parsed.data.number } });
  // Mismo mensaje si no existe o si el correo no coincide (no revela pedidos ajenos).
  if (!order || order.customerEmail !== parsed.data.email) {
    return { error: "No encontramos un pedido con ese número y correo." };
  }
  redirect(`/pedido/${order.number}?t=${order.trackingToken}`);
}

export async function createTicketAction(_: unknown, form: FormData): Promise<{ ok: boolean; message: string }> {
  if (caughtByHoneypot(form)) return { ok: true, message: "Solicitud registrada. Te responderemos al correo indicado." };
  const tooMany = await limited("ticket", 4, 30 * 60_000);
  if (tooMany) return { ok: false, message: tooMany };
  const parsed = ticketSchema.safeParse({
    email: form.get("email"),
    orderNumber: form.get("orderNumber") ?? "",
    topic: form.get("topic"),
    message: form.get("message"),
  });
  if (!parsed.success) return { ok: false, message: firstError(parsed.error) };
  let orderId: string | null = null;
  if (parsed.data.orderNumber) {
    const order = await db.order.findUnique({ where: { number: parsed.data.orderNumber } });
    if (order && order.customerEmail === parsed.data.email) orderId = order.id;
  }
  // Con sesión iniciada y el mismo correo, la solicitud también aparece en Mi cuenta → Soporte.
  const user = await getCurrentUser().catch(() => null);
  const userId = user && user.email === parsed.data.email ? user.id : null;
  const t = await db.supportTicket.create({
    data: { email: parsed.data.email, topic: parsed.data.topic, message: parsed.data.message, orderId, userId },
  });
  void notifyStaffTicket(t.id).catch(() => {});
  void notifyTicketReceived(t.id).catch(() => {});
  return { ok: true, message: `Solicitud registrada con el código ${t.id.slice(-8).toUpperCase()}. Te responderemos al correo indicado.` };
}

// ---------------------------------------------------------------------
// Carrito: siempre devuelve precios y disponibilidad actuales del servidor
// ---------------------------------------------------------------------

export type CartLine = {
  kind: "account" | "package";
  id: string;
  title: string;
  href: string;
  checkoutHref: string;
  image: string | null;
  available: boolean;
  isDemo: boolean;
  price: number;
  original: number | null;
  currency: string;
};

export async function getCartLinesAction(refs: Array<{ kind: string; id: string }>): Promise<CartLine[]> {
  const safe = refs.slice(0, 30).filter((r) => typeof r.id === "string" && r.id.length < 40);
  const pkgIds = safe.filter((r) => r.kind === "package").map((r) => r.id);
  const accIds = safe.filter((r) => r.kind === "account").map((r) => r.id);
  const [pkgs, accs] = await Promise.all([
    db.diamondPackage.findMany({ where: { id: { in: pkgIds }, active: true } }),
    db.accountListing.findMany({
      where: { id: { in: accIds }, status: { in: ["PUBLISHED", "RESERVED", "SOLD"] } },
      include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } },
    }),
  ]);
  const lines: CartLine[] = [];
  for (const p of pkgs) {
    const q = quotePrice(p.price, p.compareAtPrice);
    lines.push({
      kind: "package",
      id: p.id,
      title: `${p.diamonds + p.bonusDiamonds} diamantes Free Fire`,
      href: `/recargas?paquete=${p.slug}`,
      checkoutHref: `/recargas?paquete=${p.slug}`,
      image: null,
      available: p.available,
      isDemo: p.isDemo,
      price: q.price,
      original: q.original,
      currency: p.currency,
    });
  }
  for (const a of accs) {
    const q = quotePrice(a.price, a.compareAtPrice);
    lines.push({
      kind: "account",
      id: a.id,
      title: a.title,
      href: `/cuentas/${a.slug}`,
      checkoutHref: `/cuentas/${a.slug}/comprar`,
      image: a.images[0]?.url ?? null,
      available: listingAvailability(a).available,
      isDemo: a.isDemo,
      price: q.price,
      original: q.original,
      currency: a.currency,
    });
  }
  return lines;
}
