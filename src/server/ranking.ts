import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { generateOrderNumber, randomToken } from "@/lib/crypto";
import { formatNumber } from "@/lib/money";
import { DEFAULT_TOPUP_REGION } from "@/domain/topup-regions";
import { compareRank, isSeason, maskPlayer, parseMinCop, parsePeriodKey, parsePrizes, periodOf, previousPeriod, type RankingPeriod } from "@/domain/ranking";
import { getSettings } from "./settings";
import { canonicalEmail } from "./order-limits";
import { activeTopUpProvider } from "./integrations/topup";
import { checkPlayerRegion, supplierRegionName } from "./supplier";
import { fulfillOrder } from "./orders";
import { notifyOrder, notifyStaffSystemAlert } from "./notifications";

/** Pasarela de los pedidos de premio: no cobran nada y no cuentan como compras del ranking. */
export const PRIZE_PROVIDER = "premio";

export type RankingConfig = { enabled: boolean; minCop: number; prizes: number[] };

export async function rankingConfig(): Promise<RankingConfig> {
  const s = await getSettings();
  return { enabled: s.rankingMode !== "off", minCop: parseMinCop(s.rankingMinCop), prizes: parsePrizes(s.rankingPrizes) };
}

export type RankRow = {
  /** Correo normalizado (agrupa variantes del mismo Gmail). */
  key: string;
  /** Correo con el que compró la última vez. */
  email: string;
  /** ID de Free Fire de su última recarga entregada del mes (para mandarle el premio). */
  playerId: string | null;
  total: number;
  orders: number;
  lastPaidAt: Date;
  /** Aceptó recibir ofertas por correo. */
  optIn: boolean;
  /** Participa por el premio: aceptó ofertas y llegó al gasto mínimo. */
  qualifies: boolean;
};

/**
 * Compradores del mes, de mayor a menor gasto. Solo compras reales PAGADAS y ENTREGADAS dentro del mes (por la fecha de
 * pago), sin pedidos de prueba ni premios. Se agrupa por correo normalizado. `total` es lo pagado en pesos.
 */
export async function computeRanking(period: RankingPeriod, minCop?: number): Promise<RankRow[]> {
  const min = minCop ?? (await rankingConfig()).minCop;
  const orders = await db.order.findMany({
    where: { status: "DELIVERED", isTest: false, paymentProvider: { not: PRIZE_PROVIDER }, total: { gt: 0 }, paidAt: { gte: period.start, lt: period.end } },
    select: { customerEmail: true, total: true, paidAt: true, playerId: true, type: true },
    orderBy: { paidAt: "asc" },
  });
  const byKey = new Map<string, Omit<RankRow, "optIn" | "qualifies">>();
  for (const o of orders) {
    const key = canonicalEmail(o.customerEmail);
    const row = byKey.get(key) ?? { key, email: o.customerEmail, playerId: null, total: 0, orders: 0, lastPaidAt: o.paidAt! };
    row.total += o.total;
    row.orders += 1;
    row.lastPaidAt = o.paidAt!;
    row.email = o.customerEmail;
    if (o.type === "TOPUP" && o.playerId) row.playerId = o.playerId;
    byKey.set(key, row);
  }
  const rows = [...byKey.values()];
  if (!rows.length) return [];

  // Permiso de ofertas: cuenta con «Quiero ofertas» activo, o contacto (comprador sin cuenta) que aceptó y no se dio de baja.
  // Se busca por el correo tal cual y por su forma normalizada (p. ej. aceptó con «ana@gmail.com» y compró con «a.na@gmail.com»).
  const emails = [...new Set([...orders.map((o) => o.customerEmail.toLowerCase()), ...rows.map((r) => r.key)])];
  const [users, contacts] = await Promise.all([
    db.user.findMany({ where: { email: { in: emails }, marketingOptIn: true }, select: { email: true } }),
    db.emailContact.findMany({ where: { email: { in: emails }, optIn: true }, select: { email: true } }),
  ]);
  const optedIn = new Set([...users, ...contacts].map((u) => canonicalEmail(u.email)));
  return rows
    .map((r) => ({ ...r, optIn: optedIn.has(r.key), qualifies: optedIn.has(r.key) && r.total >= min }))
    .sort(compareRank);
}

/** Solo quienes participan por el premio, en orden. */
export async function rankingQualifiers(period: RankingPeriod, minCop?: number) {
  return (await computeRanking(period, minCop)).filter((r) => r.qualifies);
}

// ---------------------------------------------------------------------------
// Vista pública (inicio): solo puestos e IDs enmascarados. Nunca correos ni montos.
// ---------------------------------------------------------------------------

export type PublicRanking = {
  month: string;
  endsAt: string;
  minCop: number;
  podium: Array<{ pos: number; player: string | null; taken: boolean; prize: number }>;
  chasers: Array<{ pos: number; player: string }>;
};

let cache: { at: number; key: string; data: PublicRanking | null } | null = null;
const CACHE_MS = 60_000;

export async function getPublicRanking(now = new Date()): Promise<PublicRanking | null> {
  const cfg = await rankingConfig();
  if (!cfg.enabled) return null;
  const period = periodOf(now);
  const cacheKey = `${period.key}:${cfg.minCop}:${cfg.prizes.join(",")}`;
  if (cache && cache.key === cacheKey && now.getTime() - cache.at < CACHE_MS) return cache.data;
  const q = await rankingQualifiers(period, cfg.minCop);
  const data: PublicRanking = {
    month: period.month,
    endsAt: period.end.toISOString(),
    minCop: cfg.minCop,
    podium: [0, 1, 2].map((i) => ({ pos: i + 1, player: q[i] ? (maskPlayer(q[i].playerId) ?? "Jugador VANTAGG") : null, taken: !!q[i], prize: cfg.prizes[i] })),
    chasers: q.slice(3, 6).map((r, i) => ({ pos: i + 4, player: maskPlayer(r.playerId) ?? "Jugador VANTAGG" })),
  };
  cache = { at: now.getTime(), key: cacheKey, data };
  return data;
}

// ---------------------------------------------------------------------------
// Premios
// ---------------------------------------------------------------------------

/** Clave única del pedido de premio: la base de datos no deja crear dos para el mismo mes y puesto. */
export const prizeKey = (periodKey: string, pos: number) => `premio-${periodKey}-${pos}`;

/** Paquete de diamantes que se entrega como premio (Latinoamérica, por cantidad de diamantes). */
export async function prizePackage(diamonds: number) {
  return db.diamondPackage.findFirst({
    where: { region: DEFAULT_TOPUP_REGION, diamonds, active: true, providerSku: { not: null } },
    orderBy: { updatedAt: "desc" },
  });
}

/** Pedidos de premio ya creados de un mes (por puesto). */
export async function prizeOrders(periodKey: string) {
  const rows = await db.order.findMany({
    where: { idempotencyKey: { in: [1, 2, 3].map((p) => prizeKey(periodKey, p)) } },
    select: { id: true, number: true, status: true, idempotencyKey: true, playerId: true, customerEmail: true, createdAt: true, deliveredAt: true },
  });
  return new Map(rows.map((r) => [Number(r.idempotencyKey.split("-").pop()), r]));
}

export type AwardResult = { ok: true; number: string; message: string } | { ok: false; error: string };

/**
 * Entrega el premio de un puesto de un mes ya cerrado: crea un pedido sin cobro (pasarela «premio») con el paquete del
 * premio y lo manda por el proveedor como cualquier recarga (reintentos y avisos incluidos). Un solo premio por mes y
 * puesto: la clave única del pedido lo garantiza aunque se pulse dos veces.
 */
export async function awardPrize(input: { periodKey: string; pos: number; actorId: string; playerId?: string | null }, now = new Date()): Promise<AwardResult> {
  const period = parsePeriodKey(input.periodKey);
  if (!period || ![1, 2, 3].includes(input.pos)) return { ok: false, error: "Mes o puesto inválido." };
  if (!isSeason(period.key)) return { ok: false, error: `En ${period.month} ${period.year} no hubo Top 3 del mes (la primera temporada es noviembre de 2026).` };
  if (now < period.end) return { ok: false, error: `El mes de ${period.month} todavía no ha cerrado.` };

  const existing = (await prizeOrders(period.key)).get(input.pos);
  if (existing) return { ok: false, error: `Este premio ya se creó: pedido ${existing.number}.` };

  const cfg = await rankingConfig();
  const winner = (await rankingQualifiers(period, cfg.minCop))[input.pos - 1];
  if (!winner) return { ok: false, error: `Nadie quedó en el puesto #${input.pos} (o no llegó al mínimo de compras).` };

  const playerId = (input.playerId?.trim() || winner.playerId || "").replace(/\D/g, "");
  if (!/^\d{5,12}$/.test(playerId)) return { ok: false, error: "Falta el ID de Free Fire del ganador (escríbelo para enviarle el premio)." };

  const diamonds = cfg.prizes[input.pos - 1];
  const pkg = await prizePackage(diamonds);
  if (!pkg) return { ok: false, error: `No hay un paquete activo de ${formatNumber(diamonds)} diamantes en Latinoamérica para el premio.` };
  if (pkg.supplierOutOfStock || !pkg.available) return { ok: false, error: `El paquete de ${formatNumber(diamonds)} diamantes está agotado en el proveedor. Intenta más tarde.` };

  const topup = activeTopUpProvider();
  if (!topup) return { ok: false, error: "No hay proveedor de recargas activo." };
  // Si el ID es otro (lo escribió el equipo), se comprueba con el proveedor que exista y sea de la región del paquete.
  if (topup.wholesale && playerId !== winner.playerId) {
    const c = await checkPlayerRegion(topup, playerId, pkg.region);
    if (!c.ok) return { ok: false, error: c.error };
    if (c.regionSlug !== pkg.region) return { ok: false, error: "Ese ID es de otra región: el premio es de Latinoamérica." };
  }
  const regionName = topup.wholesale ? await supplierRegionName(pkg.region) : null;
  const settings = await getSettings();
  const user = await db.user.findFirst({ where: { email: winner.email }, select: { id: true } });
  const label = `Top ${input.pos} de ${period.month} ${period.year}`;

  let order;
  try {
    order = await db.order.create({
      data: {
        id: randomUUID(),
        number: generateOrderNumber(settings.orderPrefix || "VX"),
        type: "TOPUP",
        status: "PAID",
        idempotencyKey: prizeKey(period.key, input.pos),
        trackingToken: randomToken(24),
        isTest: topup.simulated,
        userId: user?.id ?? null,
        customerEmail: winner.email,
        packageId: pkg.id,
        playerId,
        itemSnapshot: {
          kind: "TOPUP",
          name: `${formatNumber(pkg.diamonds + pkg.bonusDiamonds)} diamantes Free Fire (premio ${label})`,
          pass: null,
          diamonds: pkg.diamonds,
          bonusDiamonds: pkg.bonusDiamonds,
          sku: pkg.providerSku,
          isDemo: pkg.isDemo,
          region: pkg.region,
          regionName,
          costCents: pkg.costCents,
          prize: { period: period.key, pos: input.pos },
        },
        subtotal: 0,
        total: 0,
        currency: "COP",
        paymentProvider: PRIZE_PROVIDER,
        expiresAt: now,
        paidAt: now,
        events: {
          create: [
            { type: "ORDER_CREATED", message: `Premio del Top 3 de ${period.month}: quedaste en el puesto #${input.pos}.`, actor: `ADMIN:${input.actorId}`, public: true },
            { type: "PAYMENT_CONFIRMED", message: "Premio sin costo: no requiere pago.", actor: `ADMIN:${input.actorId}`, public: true },
          ],
        },
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const again = (await prizeOrders(period.key)).get(input.pos);
      return { ok: false, error: `Este premio ya se creó${again ? `: pedido ${again.number}` : ""}.` };
    }
    throw err;
  }

  await audit({ actorId: input.actorId, action: "ranking.prize", entity: "Order", entityId: order.id, data: { period: period.key, pos: input.pos, diamonds, number: order.number } });
  void notifyOrder(order.id, "ranking_prize").catch(() => {});
  // Premio: el costo del proveedor siempre supera lo «pagado» (0); se envía igual.
  await fulfillOrder(order.id, { force: true });
  const after = await db.order.findUnique({ where: { id: order.id }, select: { status: true } });
  if (after?.status === "DELIVERED") return { ok: true, number: order.number, message: `Premio entregado: ${formatNumber(pkg.diamonds + pkg.bonusDiamonds)} diamantes al ID ${playerId} (pedido ${order.number}).` };
  if (after?.status === "DELIVERY_FAILED") return { ok: true, number: order.number, message: `Pedido de premio ${order.number} creado, pero la entrega falló por ahora: se reintenta sola. Revisa el pedido.` };
  return { ok: true, number: order.number, message: `Premio en camino: pedido ${order.number}.` };
}

/**
 * Al cerrar una temporada, avisa una sola vez al correo de alertas del equipo que hay premios por entregar (lo llama el
 * mantenimiento). Los meses anteriores al lanzamiento no cuentan.
 */
export async function notifyRankingClosed(now = new Date()): Promise<boolean> {
  const cfg = await rankingConfig();
  const last = previousPeriod(periodOf(now));
  if (!cfg.enabled || !isSeason(last.key)) return false;
  const key = "rankingClosedNotified";
  const done = await db.setting.findUnique({ where: { key } });
  if (done?.value === last.key) return false;
  const winners = (await rankingQualifiers(last, cfg.minCop)).slice(0, 3);
  await db.setting.upsert({ where: { key }, create: { key, value: last.key }, update: { value: last.key } });
  if (!winners.length) return false;
  await notifyStaffSystemAlert(
    `ranking-${last.key}`,
    `Cerró el Top 3 de ${last.month}: ${winners.length} premio(s) por entregar`,
    `Hay ${winners.length} ganador(es) del Top 3 de ${last.month}. Entrega cada premio en Panel → Ranking y premios (botón «Entregar»): sale gratis al ID del ganador y le llega un correo de felicitación.`,
    "Conviene esperar unos días por si hay contracargos en Bold. Cada premio se puede entregar una sola vez.",
  );
  return true;
}
