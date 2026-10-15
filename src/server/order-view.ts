import "server-only";
import { db } from "@/lib/db";
import { safeEqual } from "@/lib/crypto";
import { isStaff, type SessionUser } from "@/lib/auth";
import { regionLabel } from "@/domain/topup-regions";

/**
 * Vista de pedido para el cliente. Acceso permitido con:
 *  - el token de seguimiento (enlace enviado por correo / tras el checkout), o
 *  - sesión del propietario, o sesión del equipo.
 * Solo expone eventos marcados como públicos y datos no sensibles.
 */
export async function getOrderForCustomer(number: string, token: string | undefined, user: SessionUser | null) {
  const order = await db.order.findUnique({
    where: { number },
    include: {
      events: { where: { public: true }, orderBy: { createdAt: "asc" } },
      payments: { orderBy: { createdAt: "desc" }, select: { status: true, method: true, createdAt: true } },
      delivery: { select: { status: true, simulated: true } },
      package: { select: { slug: true } },
      account: { select: { slug: true, images: { take: 1, orderBy: { sortOrder: "asc" }, select: { url: true } } } },
    },
  });
  if (!order) return null;
  const tokenOk = !!token && safeEqual(order.trackingToken, token);
  const ownerOk = !!user && (order.userId === user.id || isStaff(user.role));
  if (!tokenOk && !ownerOk) return null;

  const snap = order.itemSnapshot as { name: string; diamonds?: number; bonusDiamonds?: number; isDemo?: boolean; region?: string; regionName?: string | null };
  // Solo datos públicos: el snapshot también guarda el producto y el costo del proveedor.
  const snapshot = { name: snap.name, diamonds: snap.diamonds, bonusDiamonds: snap.bonusDiamonds, isDemo: snap.isDemo, regionLabel: snap.region ? regionLabel(snap.region, snap.regionName) : null };
  return {
    id: order.id,
    number: order.number,
    viewerIsStaff: !!user && isStaff(user.role) && order.userId !== user.id,
    type: order.type,
    status: order.status,
    isTest: order.isTest,
    trackingToken: order.trackingToken,
    item: snapshot,
    playerId: order.playerId,
    playerNickname: order.playerNickname,
    customerEmail: maskEmail(order.customerEmail),
    subtotal: order.subtotal,
    discount: order.discount,
    promoCode: order.promoCode,
    total: order.total,
    currency: order.currency,
    paymentProvider: order.paymentProvider,
    expiresAt: order.expiresAt,
    paidAt: order.paidAt,
    deliveredAt: order.deliveredAt,
    createdAt: order.createdAt,
    events: order.events.map((e) => ({ id: e.id, type: e.type, message: e.message, createdAt: e.createdAt })),
    lastPayment: order.payments[0] ?? null,
    simulatedDelivery: order.delivery?.simulated ?? false,
    image: order.account?.images[0]?.url ?? null,
    productHref: order.package ? `/recargas?paquete=${order.package.slug}` : order.account ? `/cuentas/${order.account.slug}` : null,
  };
}

export type CustomerOrderView = NonNullable<Awaited<ReturnType<typeof getOrderForCustomer>>>;

function maskEmail(email: string) {
  const [user, domain] = email.split("@");
  if (!domain) return "•••";
  return `${user.slice(0, 2)}${"•".repeat(Math.max(1, Math.min(user.length - 2, 6)))}@${domain}`;
}
