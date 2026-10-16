import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma, type Order } from "@prisma/client";
import { db } from "@/lib/db";
import { generateOrderNumber, randomToken } from "@/lib/crypto";
import { env, isProduction } from "@/lib/env";
import { formatNumber } from "@/lib/money";
import { accountOrderSchema, firstError, topUpOrderSchema } from "@/lib/validation";
import { canTransitionManually, ORDER_STATUS_META, type OrderStatusValue } from "@/domain/order-status";
import { quotePrice } from "@/domain/pricing";
import { costInCop, isFreeFireProductKey, parseRegionList, regionLabel } from "@/domain/topup-regions";
import { getPaymentProvider } from "./integrations/payments";
import type { VerifiedPayment } from "./integrations/payments/types";
import { gatewayConfirms } from "./integrations/payments/confirm";
import { activeTopUpProvider, getTopUpProvider } from "./integrations/topup";
import type { TopUpProvider, TopUpRequest, TopUpResult } from "./integrations/topup/types";
import { confirmRedemption, releaseRedemption, reservePromo, undoPromoReservation } from "./promo";
import { postSystemMessage } from "./chat";
import { notifyOrder, notifyStaffAccountSold, notifyStaffDeliveryIssue } from "./notifications";
import { getSettings } from "./settings";
import { SupplierError } from "./integrations/topup/rechargegame";
import { checkPlayerRegion, supplierRate, supplierRegionName } from "./supplier";

const TOPUP_PAYMENT_WINDOW_MIN = 60;
const ACCOUNT_RESERVATION_MIN = 20;

export type CreateOrderResult = { ok: true; number: string; redirectUrl: string } | { ok: false; error: string };

// ---------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------

export async function addEvent(
  orderId: string,
  type: string,
  message: string,
  actor: string,
  opts: { public?: boolean; data?: Prisma.InputJsonValue } = {},
) {
  await db.orderEvent.create({
    data: { orderId, type, message, actor, public: opts.public ?? false, data: opts.data },
  });
}

function isUniqueViolation(err: unknown) {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

async function existingByIdempotency(key: string): Promise<CreateOrderResult | null> {
  const existing = await db.order.findUnique({ where: { idempotencyKey: key } });
  if (!existing) return null;
  if (existing.status !== "PENDING_PAYMENT") return { ok: false, error: "Este pedido ya fue procesado. Revisa su estado en Seguimiento." };
  return startCheckout(existing);
}

async function startCheckout(order: Order): Promise<CreateOrderResult> {
  const provider = getPaymentProvider(order.paymentProvider);
  if (!provider?.isEnabled()) return { ok: false, error: "El medio de pago seleccionado no está disponible." };
  const snapshot = order.itemSnapshot as { name: string };
  try {
    const { redirectUrl, checkoutRef } = await provider.createCheckout({
      number: order.number,
      total: order.total,
      currency: order.currency,
      description: snapshot.name,
      customerEmail: order.customerEmail,
      trackingToken: order.trackingToken,
      expiresAt: order.expiresAt,
    });
    // Se guarda el cobro creado (p. ej. link de Bold) para conciliarlo si el webhook no llega.
    if (checkoutRef) await addEvent(order.id, "CHECKOUT_STARTED", `Cobro iniciado en ${provider.displayName}.`, "SYSTEM", { data: { provider: provider.id, checkoutRef } });
    return { ok: true, number: order.number, redirectUrl };
  } catch (err) {
    console.error(`[orders] checkout ${order.number} falló:`, (err as Error).message);
    await addEvent(order.id, "CHECKOUT_ERROR", "La pasarela no pudo iniciar el cobro.", "SYSTEM");
    return { ok: false, error: "No pudimos conectar con la pasarela de pago. Intenta de nuevo en unos minutos." };
  }
}

// ---------------------------------------------------------------------
// Creación de órdenes
// ---------------------------------------------------------------------

export async function createTopUpOrder(input: unknown, userId: string | null): Promise<CreateOrderResult> {
  const parsed = topUpOrderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const data = parsed.data;

  const replay = await existingByIdempotency(data.idempotencyKey);
  if (replay) return replay;

  const topup = activeTopUpProvider();
  if (!topup) return { ok: false, error: "Las recargas automáticas no están habilitadas en este momento." };

  const payment = getPaymentProvider(data.paymentProvider);
  if (!payment?.isEnabled()) return { ok: false, error: "El medio de pago seleccionado no está disponible." };

  const pkg = await db.diamondPackage.findUnique({ where: { id: data.packageId } });
  if (!pkg || !pkg.active || !pkg.available) return { ok: false, error: "Este paquete ya no está disponible." };
  if (isProduction && pkg.isDemo) return { ok: false, error: "Este paquete tiene un precio de demostración y no se puede comprar." };
  if (pkg.supplierOutOfStock) return { ok: false, error: "Este paquete está agotado por ahora. Elige otra cantidad." };

  const settings = await getSettings();
  if (!parseRegionList(settings.topupRegions).includes(pkg.region)) return { ok: false, error: "Las recargas para esta región no están disponibles." };
  const supplier = topup.id === "rechargegame";
  if (supplier && !isFreeFireProductKey(pkg.providerSku)) return { ok: false, error: "Este paquete no está disponible en este momento." };
  const regionName = supplier ? await supplierRegionName(pkg.region) : null;
  const regionText = regionLabel(pkg.region, regionName);

  // Mismo control que la página: la cuenta debe ser de una región activa confirmada y coincidir con el paquete.
  let nickname: string | null;
  if (supplier) {
    const c = await checkPlayerRegion(topup, data.playerId);
    if (!c.ok) return { ok: false, error: c.error };
    if (c.regionSlug !== pkg.region) {
      const accountRegion = regionLabel(c.regionSlug, c.region);
      return { ok: false, error: `Esta cuenta es de ${accountRegion} y el paquete es de ${regionText}. Elige un paquete de ${accountRegion}.` };
    }
    nickname = null; // el verificador del proveedor devuelve apodos desactualizados: no se guarda
  } else {
    const player = await topup.validatePlayer(data.playerId);
    if (player.verifiable && !player.valid) return { ok: false, error: player.message ?? "El ID de jugador no existe." };
    nickname = player.nickname ?? null;
  }

  const quote = quotePrice(pkg.price, pkg.compareAtPrice);
  const isTest = payment.mode() !== "production" || topup.simulated || pkg.isDemo;

  // Código promocional: validado y reservado en el servidor.
  const promo = data.promoCode ? await reservePromo({ code: data.promoCode, kind: "TOPUP", subtotal: quote.price, email: data.email }) : null;
  if (promo && "error" in promo) return { ok: false, error: promo.error };
  const promoDiscountValue = promo?.discount ?? 0;

  try {
    const order = await db.order.create({
      data: {
        id: randomUUID(),
        number: generateOrderNumber(settings.orderPrefix || "VX"),
        type: "TOPUP",
        idempotencyKey: data.idempotencyKey,
        trackingToken: randomToken(24),
        isTest,
        userId,
        customerEmail: data.email,
        packageId: pkg.id,
        playerId: data.playerId,
        playerNickname: nickname,
        itemSnapshot: {
          kind: "TOPUP",
          name: `${formatNumber(pkg.diamonds + pkg.bonusDiamonds)} diamantes Free Fire`,
          diamonds: pkg.diamonds,
          bonusDiamonds: pkg.bonusDiamonds,
          sku: pkg.providerSku,
          isDemo: pkg.isDemo,
          region: pkg.region,
          regionName,
          costCents: pkg.costCents,
        },
        subtotal: quote.price,
        discount: promoDiscountValue,
        total: quote.price - promoDiscountValue,
        currency: pkg.currency,
        promoCode: promo?.code ?? null,
        redemption: promo ? { create: { promoCodeId: promo.promoCodeId, email: data.email, discount: promoDiscountValue } } : undefined,
        paymentProvider: payment.id,
        expiresAt: new Date(Date.now() + TOPUP_PAYMENT_WINDOW_MIN * 60_000),
        events: {
          create: {
            type: "ORDER_CREATED",
            message: "Pedido creado. Esperando confirmación de la pasarela de pago.",
            actor: userId ? `CUSTOMER:${userId}` : "CUSTOMER",
            public: true,
          },
        },
      },
    });
    void notifyOrder(order.id, "order_created").catch(() => {});
    return startCheckout(order);
  } catch (err) {
    if (promo) await undoPromoReservation(promo.promoCodeId);
    if (isUniqueViolation(err)) {
      const again = await existingByIdempotency(data.idempotencyKey);
      if (again) return again;
    }
    throw err;
  }
}

export async function createAccountOrder(input: unknown, userId: string | null): Promise<CreateOrderResult> {
  const parsed = accountOrderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const data = parsed.data;

  const replay = await existingByIdempotency(data.idempotencyKey);
  if (replay) return replay;

  const payment = getPaymentProvider(data.paymentProvider);
  if (!payment?.isEnabled()) return { ok: false, error: "El medio de pago seleccionado no está disponible." };

  const listing = await db.accountListing.findUnique({ where: { id: data.accountId } });
  if (!listing) return { ok: false, error: "Esta cuenta ya no está disponible." };
  if (isProduction && listing.isDemo) return { ok: false, error: "Esta publicación es de demostración y no se puede comprar." };

  const quote = quotePrice(listing.price, listing.compareAtPrice);
  const settings = await getSettings();
  const now = new Date();
  const reservedUntil = new Date(now.getTime() + ACCOUNT_RESERVATION_MIN * 60_000);

  // 1) Reserva atómica con una sola sentencia UPDATE condicional: solo una
  //    solicitud puede ganar la unidad, sin transacciones largas que en MySQL
  //    provocan bloqueos mutuos bajo concurrencia.
  const orderId = randomUUID();
  const reserved = await db.accountListing.updateMany({
    where: {
      id: listing.id,
      OR: [{ status: "PUBLISHED" }, { status: "RESERVED", reservedUntil: { lt: now } }],
    },
    data: { status: "RESERVED", reservedUntil, reservedOrderId: orderId },
  });
  if (reserved.count !== 1) {
    // Doble envío del mismo formulario: devuelve la orden ya creada.
    const replayed = await existingByIdempotency(data.idempotencyKey);
    if (replayed) return replayed;
    return { ok: false, error: "Otra persona está comprando esta cuenta en este momento o ya fue vendida." };
  }

  // 2) Código promocional (si falla, se libera la cuenta).
  const promo = data.promoCode ? await reservePromo({ code: data.promoCode, kind: "ACCOUNT", subtotal: quote.price, email: data.email }) : null;
  if (promo && "error" in promo) {
    await releaseReservation(orderId);
    return { ok: false, error: promo.error };
  }
  const promoDiscountValue = promo?.discount ?? 0;

  // 3) Si se tomó una reserva vencida, la orden anterior queda cancelada.
  if (listing.reservedOrderId) {
    await db.order.updateMany({
      where: { id: listing.reservedOrderId, status: "PENDING_PAYMENT" },
      data: { status: "CANCELLED", cancelledAt: now },
    });
  }

  // 4) Creación de la orden. Si falla, se libera la reserva (compensación).
  try {
    const order = await db.order.create({
      data: {
        id: orderId,
        number: generateOrderNumber(settings.orderPrefix || "VX"),
        type: "ACCOUNT",
        idempotencyKey: data.idempotencyKey,
        trackingToken: randomToken(24),
        isTest: payment.mode() !== "production" || listing.isDemo,
        userId,
        customerEmail: data.email,
        customerName: data.name,
        customerPhone: data.phone ?? null,
        accountId: listing.id,
        itemSnapshot: {
          kind: "ACCOUNT",
          name: listing.title,
          slug: listing.slug,
          level: listing.level,
          skinsCount: listing.skinsCount,
          chestsCount: listing.chestsCount,
          rank: listing.rank,
          region: listing.region,
          isDemo: listing.isDemo,
        },
        subtotal: quote.price,
        discount: promoDiscountValue,
        total: quote.price - promoDiscountValue,
        currency: listing.currency,
        promoCode: promo?.code ?? null,
        redemption: promo ? { create: { promoCodeId: promo.promoCodeId, email: data.email, discount: promoDiscountValue } } : undefined,
        paymentProvider: payment.id,
        expiresAt: reservedUntil,
        events: {
          create: {
            type: "ORDER_CREATED",
            message: `Pedido creado. La cuenta queda reservada para ti durante ${ACCOUNT_RESERVATION_MIN} minutos mientras completas el pago.`,
            actor: userId ? `CUSTOMER:${userId}` : "CUSTOMER",
            public: true,
          },
        },
      },
    });
    void notifyOrder(order.id, "order_created").catch(() => {});
    return startCheckout(order);
  } catch (err) {
    await releaseReservation(orderId);
    if (promo) await undoPromoReservation(promo.promoCodeId);
    if (isUniqueViolation(err)) {
      const again = await existingByIdempotency(data.idempotencyKey);
      if (again) return again;
    }
    throw err;
  }
}


/** Reabre el checkout de una orden pendiente (por ejemplo, si el cliente cerró la pasarela). */
export async function resumeCheckout(orderId: string): Promise<CreateOrderResult> {
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order || order.status !== "PENDING_PAYMENT") return { ok: false, error: "Este pedido ya no admite pagos." };
  if (order.expiresAt < new Date()) return { ok: false, error: "El tiempo para pagar este pedido terminó. Crea uno nuevo." };
  return startCheckout(order);
}

// ---------------------------------------------------------------------
// Confirmación de pagos (solo desde webhooks verificados o consulta a la pasarela)
// ---------------------------------------------------------------------

export async function applyVerifiedPayment(providerId: string, p: VerifiedPayment, actor: string) {
  const order = await db.order.findUnique({ where: { number: p.reference } });
  if (!order) return { handled: false, reason: "Orden no encontrada" };
  if (order.paymentProvider !== providerId) {
    await addEvent(order.id, "PAYMENT_PROVIDER_MISMATCH", `Se ignoró un evento de ${providerId}: la orden usa ${order.paymentProvider}.`, actor);
    return { handled: false, reason: "Proveedor no corresponde" };
  }

  await db.payment.upsert({
    where: { provider_providerRef: { provider: providerId, providerRef: p.providerRef } },
    create: { orderId: order.id, provider: providerId, providerRef: p.providerRef, status: p.status, amount: p.amount, currency: p.currency, method: p.method ?? null },
    update: { status: p.status, method: p.method ?? undefined },
  });

  if (p.status !== "APPROVED") {
    if (p.status === "DECLINED" || p.status === "ERROR" || p.status === "VOIDED") {
      await addEvent(order.id, "PAYMENT_NOT_APPROVED", "La pasarela informó que el pago no fue aprobado. Puedes intentarlo de nuevo.", actor, {
        public: true,
        data: { status: p.status, providerRef: p.providerRef },
      });
    }
    return { handled: true };
  }

  if (p.amount !== order.total || p.currency !== order.currency) {
    await addEvent(order.id, "PAYMENT_AMOUNT_MISMATCH", `Monto aprobado (${p.amount} ${p.currency}) distinto al de la orden. Requiere revisión manual.`, actor, {
      data: { expected: order.total, received: p.amount },
    });
    return { handled: false, reason: "Monto no coincide" };
  }

  // Transición atómica: solo el primer evento marca como pagado (idempotente).
  const now = new Date();
  const won = await db.order.updateMany({
    where: { id: order.id, status: { in: ["PENDING_PAYMENT", "CANCELLED"] } },
    data: { status: "PAID", paidAt: now, cancelledAt: null },
  });
  if (won.count === 0) return { handled: true, duplicate: true };
  await confirmRedemption(order.id);

  await addEvent(order.id, "PAYMENT_CONFIRMED", "La pasarela confirmó el pago.", actor, {
    public: true,
    data: { providerRef: p.providerRef, method: p.method ?? null },
  });
  void notifyOrder(order.id, "payment_confirmed").catch(() => {});
  await fulfillOrder(order.id);
  return { handled: true };
}

// ---------------------------------------------------------------------
// Entrega
// ---------------------------------------------------------------------

/** Pedidos de prueba: no cobran saldo del proveedor ni entregan diamantes reales. */
const supplierTest = (order: Order) => order.isTest || env.topup.forceTest;

async function blockDelivery(order: Order, internal: string) {
  await db.order.updateMany({ where: { id: order.id, status: "PAID" }, data: { status: "DELIVERY_FAILED" } });
  void notifyStaffDeliveryIssue(order.id, internal).catch(() => {});
  await addEvent(order.id, "DELIVERY_BLOCKED", internal, "SYSTEM");
  await addEvent(order.id, "DELIVERY_DELAYED", "La entrega está demorada. Nuestro equipo ya fue notificado.", "SYSTEM", { public: true });
}

export async function fulfillOrder(orderId: string, opts: { force?: boolean } = {}) {
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order || order.status !== "PAID") return;
  if (order.type === "ACCOUNT") return fulfillAccount(order);

  const provider = activeTopUpProvider();
  if (!provider) return blockDelivery(order, "No hay proveedor de recargas configurado. La entrega quedó pendiente.");

  // Protección: si el costo del proveedor supera lo que pagó el cliente, no se compra solo.
  const snap = order.itemSnapshot as { costCents?: number | null };
  if (!opts.force && provider.id === "rechargegame" && !supplierTest(order) && snap.costCents != null) {
    const { usdtCop } = await supplierRate();
    const cost = costInCop(snap.costCents, usdtCop);
    if (cost > order.total) {
      return blockDelivery(order, `Entrega detenida: el costo del proveedor (≈ ${cost.toLocaleString("es-CO")}) supera lo pagado (${order.total.toLocaleString("es-CO")}). Revisa el precio; «Reintentar entrega» la envía de todas formas.`);
    }
  }

  let delivery;
  try {
    // orderId es único: si dos procesos llegan aquí a la vez, solo uno crea la entrega.
    delivery = await db.delivery.create({
      data: {
        orderId: order.id,
        provider: provider.id,
        idempotencyKey: `topup-${order.id}`,
        status: "PROCESSING",
        simulated: provider.simulated || (provider.id === "rechargegame" && supplierTest(order)),
        attempts: 1,
        lockedAt: new Date(),
      },
    });
  } catch (err) {
    if (isUniqueViolation(err)) return;
    throw err;
  }

  await db.order.updateMany({ where: { id: order.id, status: "PAID" }, data: { status: "PROCESSING" } });
  await addEvent(order.id, "DELIVERY_STARTED", "Enviando la recarga a través del proveedor.", "SYSTEM", { public: true });
  await runDelivery(delivery.id, provider, delivery.idempotencyKey);
}

function topUpRequest(order: Order, idempotencyKey: string): TopUpRequest {
  const snap = order.itemSnapshot as { diamonds: number; bonusDiamonds?: number; sku?: string | null; regionName?: string | null };
  return { idempotencyKey, orderNumber: order.number, playerId: order.playerId!, sku: snap.sku ?? null, diamonds: snap.diamonds, region: snap.regionName ?? null, test: supplierTest(order) };
}

/** Mensaje interno claro para los errores del proveedor (el cliente nunca lo ve). */
function supplierErrorMessage(err: unknown): string {
  if (err instanceof SupplierError) {
    const hints: Record<string, string> = {
      insufficient_balance: "Saldo insuficiente en el proveedor. Recarga saldo (USDT) y la entrega se reintenta sola en unos minutos, o usa «Reintentar entrega».",
      out_of_stock: "El proveedor tiene este paquete agotado. Se reintenta solo; si sigue agotado, reembolsa o cambia el paquete.",
      unknown_product: "El proveedor no reconoce el producto. Sincroniza el catálogo en Panel → Proveedor y saldo.",
      rate_limited: "El proveedor limitó las solicitudes. Se reintenta sola en unos minutos.",
      invalid_api_key: "La clave de la API del proveedor es inválida o fue desactivada.",
    };
    return `[${err.code}] ${hints[err.code] ?? err.message}`;
  }
  return `Error de comunicación con el proveedor: ${(err as Error).message}. Reintentar es seguro (idempotente).`;
}

async function runDelivery(deliveryId: string, provider: TopUpProvider, idempotencyKey: string) {
  const delivery = await db.delivery.findUniqueOrThrow({ where: { id: deliveryId }, include: { order: true } });
  const req = topUpRequest(delivery.order, idempotencyKey);
  let result: TopUpResult;
  try {
    result = await provider.createTopUp(req);
    if (result.providerRef) {
      await db.delivery.update({ where: { id: deliveryId }, data: { providerRef: result.providerRef, idempotencyKey } });
    }
    if (result.status === "PENDING" && result.providerRef) {
      result = await provider.processDelivery(result.providerRef, req);
    }
  } catch (err) {
    result = { status: "FAILED", providerRef: delivery.providerRef, simulated: delivery.simulated, message: supplierErrorMessage(err) };
  }
  await applyDeliveryResult(deliveryId, result, `PROVIDER:${provider.id}`);
}

export async function applyDeliveryResult(deliveryId: string, r: TopUpResult, actor: string) {
  const delivery = await db.delivery.findUnique({ where: { id: deliveryId }, include: { order: true } });
  if (!delivery) return;
  const order = delivery.order;

  if (r.status === "SUCCESS") {
    const updated = await db.delivery.updateMany({
      where: { id: deliveryId, status: { not: "SUCCESS" } },
      data: { status: "SUCCESS", providerRef: r.providerRef ?? undefined, lastError: null, lockedAt: null },
    });
    if (updated.count === 0) return;
    await db.order.updateMany({
      where: { id: order.id, status: { in: ["PAID", "PROCESSING", "DELIVERY_FAILED"] } },
      data: { status: "DELIVERED", deliveredAt: new Date() },
    });
    const snap = order.itemSnapshot as { diamonds: number; bonusDiamonds?: number };
    const total = snap.diamonds + (snap.bonusDiamonds ?? 0);
    const message = r.simulated
      ? `Entrega SIMULADA (DEMO): el proveedor de prueba no envía diamantes reales.`
      : `El proveedor confirmó la entrega de ${formatNumber(total)} diamantes al ID ${order.playerId}.`;
    await addEvent(order.id, "DELIVERED", message, actor, { public: true, data: { providerRef: r.providerRef, simulated: r.simulated } });
    void notifyOrder(order.id, "delivered").catch(() => {});
    return;
  }

  if (r.status === "FAILED") {
    await db.delivery.update({ where: { id: deliveryId }, data: { status: "FAILED", lastError: r.message ?? "Error desconocido", lockedAt: null } });
    await db.order.updateMany({ where: { id: order.id, status: { in: ["PAID", "PROCESSING"] } }, data: { status: "DELIVERY_FAILED" } });
    await addEvent(order.id, "DELIVERY_FAILED", r.message ?? "El proveedor no pudo completar la entrega.", actor, { data: { providerRef: r.providerRef } });
    await addEvent(order.id, "DELIVERY_ISSUE", "Hubo un inconveniente con la entrega. Nuestro equipo lo revisará y te contactará.", "SYSTEM", { public: true });
    void notifyOrder(order.id, "delivery_failed").catch(() => {});
    void notifyStaffDeliveryIssue(order.id, r.message ?? "El proveedor no pudo completar la entrega.").catch(() => {});
    return;
  }

  await db.delivery.update({ where: { id: deliveryId }, data: { providerRef: r.providerRef ?? undefined } });
  await addEvent(order.id, "DELIVERY_PENDING", "El proveedor recibió la solicitud y está procesando la entrega.", actor, { public: true });
}

async function fulfillAccount(order: Order) {
  const now = new Date();
  const sold = await db.accountListing.updateMany({
    where: {
      id: order.accountId!,
      OR: [{ status: "RESERVED", reservedOrderId: order.id }, { status: "PUBLISHED" }],
    },
    data: { status: "SOLD", soldAt: now, reservedOrderId: order.id, reservedUntil: null },
  });

  if (sold.count !== 1) {
    await db.order.updateMany({ where: { id: order.id, status: "PAID" }, data: { status: "REFUND_REQUESTED" } });
    await addEvent(order.id, "ITEM_UNAVAILABLE", "La cuenta dejó de estar disponible antes de confirmarse el pago. Se gestionará el reembolso.", "SYSTEM", { public: true });
    return;
  }

  await db.order.updateMany({ where: { id: order.id, status: "PAID" }, data: { status: "PROCESSING" } });
  await addEvent(order.id, "ACCOUNT_HANDOVER_PENDING", "Cuenta asignada a tu pedido. Te entregamos los datos de acceso por el chat de este pedido.", "SYSTEM", { public: true });
  await postSystemMessage(order.id, "Pago confirmado. La cuenta ya es tuya: en breve te escribimos aquí con los datos de acceso.", { alertStaff: true });
  void notifyStaffAccountSold(order.id).catch(() => {});
}

// ---------------------------------------------------------------------
// Operaciones del panel (seguras)
// ---------------------------------------------------------------------

export async function retryDelivery(orderId: string, actor: string): Promise<{ ok: boolean; message: string }> {
  const order = await db.order.findUnique({ where: { id: orderId }, include: { delivery: true } });
  if (!order || order.type !== "TOPUP") return { ok: false, message: "Solo aplica a recargas." };
  if (order.status === "PAID" && !order.delivery) {
    await fulfillOrder(order.id, { force: true });
    return { ok: true, message: "Entrega iniciada." };
  }
  if (order.status !== "DELIVERY_FAILED") return { ok: false, message: "La orden no está en error de entrega." };

  const provider = activeTopUpProvider();
  if (!provider) return { ok: false, message: "No hay proveedor de recargas configurado." };

  if (!order.delivery) {
    await db.order.update({ where: { id: order.id }, data: { status: "PAID" } });
    await addEvent(order.id, "DELIVERY_RETRY", "Reintento de entrega solicitado.", actor);
    await fulfillOrder(order.id, { force: true });
    return { ok: true, message: "Entrega iniciada." };
  }

  const d = order.delivery;
  // Bloqueo optimista: solo un reintento a la vez.
  const locked = await db.delivery.updateMany({
    where: { id: d.id, status: "FAILED" },
    data: { status: "PROCESSING", attempts: { increment: 1 }, lockedAt: new Date() },
  });
  if (locked.count !== 1) return { ok: false, message: "Ya hay un reintento en curso." };
  await db.order.updateMany({ where: { id: order.id, status: "DELIVERY_FAILED" }, data: { status: "PROCESSING" } });
  await addEvent(order.id, "DELIVERY_RETRY", `Reintento de entrega #${d.attempts + 1}.`, actor);

  // Antes de reintentar, se confirma con el proveedor el estado de la transacción anterior.
  const providerForDelivery = getTopUpProvider(d.provider) ?? provider;
  if (d.providerRef) {
    try {
      const current = await providerForDelivery.getTransactionStatus(d.providerRef);
      if (current.status !== "FAILED") {
        await applyDeliveryResult(d.id, current, actor);
        return { ok: true, message: current.status === "SUCCESS" ? "El proveedor ya había completado la entrega." : "La entrega sigue en proceso con el proveedor." };
      }
    } catch {
      // Si no se puede consultar, no se arriesga una segunda entrega.
      await db.delivery.update({ where: { id: d.id }, data: { status: "FAILED", lockedAt: null } });
      await db.order.updateMany({ where: { id: order.id, status: "PROCESSING" }, data: { status: "DELIVERY_FAILED" } });
      return { ok: false, message: "No se pudo verificar la transacción anterior con el proveedor. No se reintentó." };
    }
  }

  // Con transacción anterior fallida (confirmado): clave nueva. Sin transacción registrada: misma clave,
  // así un pedido que sí llegó al proveedor (p. ej. tras un corte de red) no se cobra ni entrega dos veces.
  await runDelivery(d.id, providerForDelivery, d.providerRef ? `topup-${order.id}-r${d.attempts + 1}` : d.idempotencyKey);
  const after = await db.order.findUnique({ where: { id: order.id } });
  return { ok: after?.status === "DELIVERED", message: after ? ORDER_STATUS_META[after.status].label : "—" };
}

/** Estado de los cobros iniciados para una orden (links de pago guardados en CHECKOUT_STARTED). */
async function checkoutsOf(orderId: string, provider: NonNullable<ReturnType<typeof getPaymentProvider>>): Promise<VerifiedPayment[]> {
  if (!provider.getCheckout) return [];
  const events = await db.orderEvent.findMany({ where: { orderId, type: "CHECKOUT_STARTED" }, orderBy: { createdAt: "desc" }, take: 5, select: { data: true } });
  const out: VerifiedPayment[] = [];
  for (const e of events) {
    const d = e.data as { provider?: string; checkoutRef?: string } | null;
    if (d?.provider !== provider.id || !d.checkoutRef) continue;
    const v = await provider.getCheckout(d.checkoutRef).catch(() => null);
    if (v) out.push(v);
  }
  return out;
}

/**
 * Webhook de pago aprobado: además de la firma, se confirma con la pasarela el estado real de los cobros
 * iniciados para esa orden (no se puede falsificar con la llave secreta). Las pasarelas sin consulta de
 * cobros (getCheckout) quedan solo con la verificación por firma.
 */
export async function confirmApprovedWebhook(providerId: string, p: VerifiedPayment): Promise<boolean> {
  if (p.status !== "APPROVED") return true;
  const provider = getPaymentProvider(providerId);
  if (!provider?.getCheckout) return true;
  const order = await db.order.findUnique({ where: { number: p.reference }, select: { id: true } });
  if (!order) return false;
  return gatewayConfirms(p, await checkoutsOf(order.id, provider));
}

const pendingChecks = new Map<string, number>();

/**
 * Pago pendiente: pregunta a la pasarela por los cobros iniciados y aplica solo los aprobados
 * (los rechazos los informa el webhook; así no se repiten avisos en cada consulta).
 * Se limita a una consulta cada 15 s por orden.
 */
export async function checkPendingPayment(orderId: string): Promise<boolean> {
  const last = pendingChecks.get(orderId) ?? 0;
  if (Date.now() - last < 15_000) return false;
  pendingChecks.set(orderId, Date.now());
  if (pendingChecks.size > 5000) pendingChecks.clear();

  const order = await db.order.findUnique({ where: { id: orderId }, select: { id: true, status: true, paymentProvider: true } });
  if (!order || order.status !== "PENDING_PAYMENT") return false;
  const provider = getPaymentProvider(order.paymentProvider);
  if (!provider?.isEnabled() || !provider.getCheckout) return false;
  let applied = false;
  for (const v of await checkoutsOf(order.id, provider)) {
    if (v.status !== "APPROVED") continue;
    await applyVerifiedPayment(provider.id, v, `POLL:${provider.id}`);
    applied = true;
  }
  return applied;
}

/** Mantenimiento: revisa pagos pendientes recientes por si el webhook de la pasarela se demora. */
export async function pollPendingPayments(): Promise<number> {
  const since = new Date(Date.now() - 3 * 3600_000);
  const orders = await db.order.findMany({
    where: { status: "PENDING_PAYMENT", createdAt: { gte: since }, events: { some: { type: "CHECKOUT_STARTED" } } },
    orderBy: { createdAt: "desc" },
    take: 25,
    select: { id: true },
  });
  let applied = 0;
  for (const o of orders) if (await checkPendingPayment(o.id).catch(() => false)) applied++;
  return applied;
}

export async function reconcilePayment(orderId: string, actor: string): Promise<{ ok: boolean; message: string }> {
  const order = await db.order.findUnique({ where: { id: orderId }, include: { payments: true } });
  if (!order) return { ok: false, message: "Orden no encontrada." };
  const provider = getPaymentProvider(order.paymentProvider);
  if (!provider || provider.missingConfig().length) return { ok: false, message: "La pasarela de esta orden no está configurada." };

  const found: VerifiedPayment[] = [];
  for (const p of order.payments) {
    const v = await provider.getPayment(p.providerRef);
    if (v) found.push(v);
  }
  if (provider.findByReference) {
    for (const v of await provider.findByReference(order.number)) {
      if (!found.some((f) => f.providerRef === v.providerRef)) found.push(v);
    }
  }
  for (const v of await checkoutsOf(order.id, provider)) {
    if (!found.some((f) => f.providerRef === v.providerRef)) found.push(v);
  }
  await addEvent(order.id, "RECONCILE", `Conciliación consultada a ${provider.displayName}: ${found.length} transacción(es).`, actor);
  if (found.length === 0) return { ok: true, message: "La pasarela no reporta transacciones para esta orden." };
  for (const v of found) await applyVerifiedPayment(provider.id, v, `RECONCILE:${actor}`);
  return { ok: true, message: `Se aplicaron ${found.length} transacción(es) informadas por la pasarela.` };
}

export async function transitionOrder(orderId: string, to: OrderStatusValue, actor: string, reason: string) {
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order) return { ok: false, message: "Orden no encontrada." };
  if (!canTransitionManually(order.status, to)) {
    return { ok: false, message: `No se permite pasar de "${ORDER_STATUS_META[order.status].label}" a "${ORDER_STATUS_META[to].label}".` };
  }
  const now = new Date();
  const res = await db.order.updateMany({
    where: { id: order.id, status: order.status },
    data: { status: to, ...(to === "CANCELLED" ? { cancelledAt: now } : {}) },
  });
  if (res.count !== 1) return { ok: false, message: "La orden cambió mientras tanto. Recarga la página." };
  if (to === "CANCELLED") {
    if (order.type === "ACCOUNT") await releaseReservation(order.id);
    await releaseRedemption(order.id);
  }
  await addEvent(order.id, "STATUS_CHANGED", `${ORDER_STATUS_META[order.status].label} → ${ORDER_STATUS_META[to].label}. ${reason}`.trim(), actor);
  await addEvent(order.id, "STATUS_PUBLIC", ORDER_STATUS_META[to].customer, "SYSTEM", { public: true });
  if (to === "REFUNDED") void notifyOrder(order.id, "refunded").catch(() => {});
  if (to === "CANCELLED") void notifyOrder(order.id, "cancelled").catch(() => {});
  return { ok: true, message: "Estado actualizado." };
}

/** Entrega de cuentas: la confirma el equipo tras el traspaso seguro (no implica pagos). */
export async function markAccountDelivered(orderId: string, actor: string, note: string) {
  const res = await db.order.updateMany({
    where: { id: orderId, type: "ACCOUNT", status: "PROCESSING" },
    data: { status: "DELIVERED", deliveredAt: new Date() },
  });
  if (res.count !== 1) return { ok: false, message: "La orden debe estar en procesamiento (pago confirmado)." };
  await addEvent(orderId, "ACCOUNT_DELIVERED", `Entrega confirmada por el equipo. ${note}`.trim(), actor);
  await addEvent(orderId, "DELIVERED", "La entrega de la cuenta fue completada.", "SYSTEM", { public: true });
  await postSystemMessage(orderId, "Entrega completada. Cambia la contraseña y el correo de recuperación si aún no lo hiciste. El chat sigue abierto 7 días por si necesitas algo.");
  void notifyOrder(orderId, "delivered").catch(() => {});
  return { ok: true, message: "Entrega registrada." };
}

async function releaseReservation(orderId: string) {
  await db.accountListing.updateMany({
    where: { reservedOrderId: orderId, status: "RESERVED" },
    data: { status: "PUBLISHED", reservedOrderId: null, reservedUntil: null },
  });
}

// ---------------------------------------------------------------------
// Mantenimiento (cron)
// ---------------------------------------------------------------------

export async function expireStaleOrders() {
  const stale = await db.order.findMany({
    where: { status: "PENDING_PAYMENT", expiresAt: { lt: new Date() } },
    select: { id: true, type: true },
    take: 200,
  });
  let cancelled = 0;
  for (const o of stale) {
    const r = await db.order.updateMany({ where: { id: o.id, status: "PENDING_PAYMENT" }, data: { status: "CANCELLED", cancelledAt: new Date() } });
    if (r.count) {
      cancelled++;
      if (o.type === "ACCOUNT") await releaseReservation(o.id);
      await releaseRedemption(o.id);
      await addEvent(o.id, "EXPIRED", "El tiempo para completar el pago terminó y el pedido se canceló automáticamente.", "SYSTEM", { public: true });
    }
  }
  return cancelled;
}

export async function pollPendingDeliveries() {
  const pending = await db.delivery.findMany({
    where: { status: "PROCESSING", providerRef: { not: null }, updatedAt: { lt: new Date(Date.now() - 60_000) } },
    take: 50,
  });
  let updated = 0;
  for (const d of pending) {
    const provider = getTopUpProvider(d.provider);
    if (!provider?.isEnabled()) continue;
    try {
      const r = await provider.getTransactionStatus(d.providerRef!);
      if (r.status !== "PENDING") {
        await applyDeliveryResult(d.id, r, `POLL:${provider.id}`);
        updated++;
      }
    } catch (err) {
      await db.delivery.update({ where: { id: d.id }, data: { lastError: (err as Error).message.slice(0, 500) } });
    }
  }
  return updated;
}

/** Consulta al proveedor una entrega en curso al abrir el pedido (sin esperar al cron ni al webhook). */
export async function refreshDeliveryIfStale(orderId: string, minAgeMs = 8_000) {
  const d = await db.delivery.findUnique({ where: { orderId } });
  if (!d || d.status !== "PROCESSING" || !d.providerRef || Date.now() - d.updatedAt.getTime() < minAgeMs) return;
  const provider = getTopUpProvider(d.provider);
  if (!provider?.isEnabled()) return;
  // Marca la consulta (updatedAt) para no repetirla en cada recarga de la página.
  const claimed = await db.delivery.updateMany({ where: { id: d.id, updatedAt: d.updatedAt }, data: { lockedAt: new Date() } });
  if (claimed.count !== 1) return;
  try {
    const r = await provider.getTransactionStatus(d.providerRef);
    if (r.status !== "PENDING") await applyDeliveryResult(d.id, r, `POLL:${provider.id}`);
  } catch (err) {
    await db.delivery.update({ where: { id: d.id }, data: { lastError: (err as Error).message.slice(0, 500) } });
  }
}

/** Reintenta solas las entregas que fallaron antes de llegar al proveedor (saldo, agotado, red), hasta 6 intentos. */
export async function retryStuckDeliveries() {
  const stuck = await db.delivery.findMany({
    where: {
      status: "FAILED",
      providerRef: null,
      attempts: { lt: 6 },
      updatedAt: { lt: new Date(Date.now() - 5 * 60_000) },
      order: { status: "DELIVERY_FAILED", type: "TOPUP" },
      OR: [{ lastError: { startsWith: "[insufficient_balance]" } }, { lastError: { startsWith: "[out_of_stock]" } }, { lastError: { startsWith: "[rate_limited]" } }, { lastError: { startsWith: "[network]" } }, { lastError: { startsWith: "[http_5" } }],
    },
    select: { orderId: true },
    take: 20,
  });
  let retried = 0;
  for (const d of stuck) {
    const r = await retryDelivery(d.orderId, "SYSTEM:auto-reintento");
    if (r.ok) retried++;
  }
  return retried;
}
