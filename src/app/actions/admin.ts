"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma, type ListingStatus, type Role } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { requireAdmin, requireStaff } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { slugify } from "@/lib/utils";
import { emailSchema, firstError, passwordSchema } from "@/lib/validation";
import { ORDER_STATUSES } from "@/domain/order-status";
import { normalizePromoCode, PROMO_CODE_PATTERN } from "@/domain/pricing";
import { FF_RANKS, FF_REGIONS, type RankId, type RegionCode } from "@/domain/freefire";
import { parsePaymentMethods } from "@/domain/payment-methods";
import { toBannerSlot } from "@/domain/banner-slots";
import { publishBlockers } from "@/domain/labels";
import { markAccountDelivered, reconcilePayment, retryDelivery, transitionOrder } from "@/server/orders";
import { getSettings, MANAGED_SETTING_KEYS, saveSettings, SETTING_DEFAULTS, type SettingKey } from "@/server/settings";
import { saveImage, UploadError } from "@/server/storage";
import { runHealthCheck } from "@/server/integrations/status";
import { getBrand, notifyStaffSecurity, sendEmail } from "@/server/notifications";
import { supportReplyEmail, testEmail } from "@/server/email-templates";
import { env } from "@/lib/env";

export type ActionResult = { ok: boolean; message: string } | null;

const ok = (message: string): ActionResult => ({ ok: true, message });
const fail = (message: string): ActionResult => ({ ok: false, message });

// --- helpers de formulario ---------------------------------------------
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const bool = (f: FormData, k: string) => f.get(k) === "on" || f.get(k) === "true";
const optInt = z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().min(0).max(1_000_000_000).nullable());
const reqInt = (min: number) => z.preprocess((v) => Number(v), z.number().int("Debe ser un número entero.").min(min));
const LABELS = ["NONE", "BEST_SELLER", "OFFER", "BONUS", "RECOMMENDED"] as const;

/** "2026-10-03T10:00" (hora de Colombia) → Date */
function bogota(v: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return null;
  const d = new Date(`${v}:00-05:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

// =====================================================================
// Pedidos
// =====================================================================

export async function orderAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const user = await requireStaff();
  const orderId = str(form, "orderId");
  const op = str(form, "op");
  const actor = `ADMIN:${user.email}`;
  let result: { ok: boolean; message: string };

  switch (op) {
    case "reconcile":
      result = await reconcilePayment(orderId, actor);
      break;
    case "retry":
      result = await retryDelivery(orderId, actor);
      break;
    case "delivered": {
      const note = str(form, "note").slice(0, 500);
      if (note.length < 5) return fail("Describe cómo se realizó la entrega (mínimo 5 caracteres).");
      result = await markAccountDelivered(orderId, actor, note);
      break;
    }
    case "transition": {
      const to = z.enum(ORDER_STATUSES).safeParse(str(form, "to"));
      if (!to.success) return fail("Estado inválido.");
      const reason = str(form, "reason").slice(0, 500);
      if (reason.length < 5) return fail("Indica el motivo del cambio (mínimo 5 caracteres).");
      result = await transitionOrder(orderId, to.data, actor, reason);
      break;
    }
    case "note": {
      const body = str(form, "body").slice(0, 2000);
      if (body.length < 2) return fail("La nota está vacía.");
      await db.adminNote.create({ data: { orderId, authorId: user.id, body } });
      result = { ok: true, message: "Nota registrada." };
      break;
    }
    default:
      return fail("Operación no soportada.");
  }
  await audit({ actorId: user.id, action: `order.${op}`, entity: "Order", entityId: orderId, data: { ok: result.ok, message: result.message } });
  revalidatePath(`/admin/pedidos/${orderId}`);
  revalidatePath("/admin/chats");
  return result;
}

// =====================================================================
// Paquetes de diamantes
// =====================================================================

const packageSchema = z.object({
  diamonds: reqInt(1),
  bonusDiamonds: reqInt(0),
  price: reqInt(100),
  compareAtPrice: optInt,
  label: z.enum(LABELS),
  sortOrder: reqInt(0),
  providerSku: z.string().max(191).optional(),
  region: z.string().regex(/^[a-z0-9-]{2,60}$/, "Región inválida."),
});

export async function savePackageAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = packageSchema.safeParse({
    diamonds: str(form, "diamonds"),
    bonusDiamonds: str(form, "bonusDiamonds") || "0",
    price: str(form, "price"),
    compareAtPrice: str(form, "compareAtPrice"),
    label: str(form, "label") || "NONE",
    sortOrder: str(form, "sortOrder") || "0",
    providerSku: str(form, "providerSku") || undefined,
    region: str(form, "region") || "latam",
  });
  if (!parsed.success) return fail(firstError(parsed.error));
  const d = parsed.data;
  if (d.compareAtPrice != null && d.compareAtPrice <= d.price) return fail("El precio anterior debe ser mayor que el precio actual (o déjalo vacío).");
  // Producto del proveedor: si existe en el catálogo, se toman su región y su costo.
  const product = d.providerSku ? await db.supplierProduct.findUnique({ where: { productKey: d.providerSku } }) : null;
  if (d.providerSku?.startsWith("topup/") && !product) return fail("Ese producto no está en el catálogo del proveedor. Sincroniza en Proveedor o revisa la clave.");
  if (product?.amount && product.amount !== d.diamonds + d.bonusDiamonds) {
    return fail(`El producto del proveedor entrega ${product.amount} diamantes y el paquete suma ${d.diamonds + d.bonusDiamonds}. Ajusta diamantes + bonificación para que coincidan.`);
  }
  if (product && product.regionSlug !== d.region) return fail(`El producto del proveedor es de la región «${product.regionName}». Cambia la región del paquete.`);

  const data = {
    name: `${d.diamonds} diamantes`,
    diamonds: d.diamonds,
    bonusDiamonds: d.bonusDiamonds,
    price: d.price,
    compareAtPrice: d.compareAtPrice,
    label: d.label,
    sortOrder: d.sortOrder,
    providerSku: d.providerSku ?? null,
    region: d.region,
    costCents: product?.priceCents ?? null,
    supplierOutOfStock: product?.outOfStock ?? false,
    available: bool(form, "available"),
    active: bool(form, "active"),
    featured: bool(form, "featured"),
    isDemo: bool(form, "isDemo"),
  };
  const id = str(form, "id");
  if (id) {
    await db.diamondPackage.update({ where: { id }, data });
    await audit({ actorId: user.id, action: "package.update", entity: "DiamondPackage", entityId: id, data });
  } else {
    let slug = d.region === "latam" ? `diamantes-${d.diamonds}` : `diamantes-${d.region}-${d.diamonds + d.bonusDiamonds}`;
    if (await db.diamondPackage.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString(36)}`;
    const created = await db.diamondPackage.create({ data: { ...data, slug } });
    await audit({ actorId: user.id, action: "package.create", entity: "DiamondPackage", entityId: created.id, data });
  }
  revalidatePath("/admin/paquetes");
  revalidatePath("/");
  return ok("Paquete guardado.");
}

/** Aplica un % de bonificación a todos los paquetes (bonus = diamantes × % redondeado). */
export async function applyBonusAllAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const pct = z.preprocess((v) => Number(v), z.number().int("Usa un número entero.").min(0).max(100)).safeParse(str(form, "pct"));
  if (!pct.success) return fail("El porcentaje debe estar entre 0 y 100.");
  // Los paquetes vinculados al proveedor muestran exactamente lo que este entrega: no se tocan.
  const packages = await db.diamondPackage.findMany({ where: { OR: [{ providerSku: null }, { NOT: { providerSku: { startsWith: "topup/" } } }] }, select: { id: true, diamonds: true } });
  if (packages.length === 0) return fail("Todos los paquetes están vinculados al proveedor: su bonificación es la que entrega el proveedor y no se cambia aquí.");
  await db.$transaction(
    packages.map((p) => db.diamondPackage.update({ where: { id: p.id }, data: { bonusDiamonds: Math.round((p.diamonds * pct.data) / 100) } })),
  );
  await audit({ actorId: user.id, action: "package.bonus_all", entity: "DiamondPackage", data: { pct: pct.data, count: packages.length } });
  revalidatePath("/admin/paquetes");
  revalidatePath("/");
  revalidatePath("/recargas");
  return ok(pct.data === 0 ? `Bonificación eliminada de ${packages.length} paquete(s) sin vincular.` : `Bonificación del ${pct.data}% aplicada a ${packages.length} paquete(s) sin vincular al proveedor.`);
}

export async function deletePackageAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const id = str(form, "id");
  const used = await db.order.count({ where: { packageId: id } });
  if (used > 0) {
    await db.diamondPackage.update({ where: { id }, data: { active: false } });
    await audit({ actorId: user.id, action: "package.deactivate", entity: "DiamondPackage", entityId: id });
    revalidatePath("/admin/paquetes");
    return ok("El paquete tiene pedidos asociados: se desactivó en lugar de eliminarse.");
  }
  await db.diamondPackage.delete({ where: { id } });
  await audit({ actorId: user.id, action: "package.delete", entity: "DiamondPackage", entityId: id });
  revalidatePath("/admin/paquetes");
  return ok("Paquete eliminado.");
}

// =====================================================================
// Cuentas
// =====================================================================

const accountSchema = z.object({
  title: z.string().min(8, "El título debe tener al menos 8 caracteres.").max(140),
  description: z.string().min(30, "La descripción debe tener al menos 30 caracteres.").max(5000),
  price: reqInt(1000),
  compareAtPrice: optInt,
  level: optInt,
  skinsCount: optInt,
  chestsCount: optInt,
  emailStatus: z.enum(["CONFIRMED", "PENDING"]).optional(),
  rank: z.enum(FF_RANKS.map((r) => r.id) as [RankId, ...RankId[]]).optional(),
  region: z.enum(FF_REGIONS.map((r) => r.code) as [RegionCode, ...RegionCode[]], { error: "Selecciona un servidor válido." }),
  label: z.enum(LABELS),
  provenanceSource: z.string().max(255).optional(),
  provenanceNotes: z.string().max(3000).optional(),
  tags: z.array(z.string().min(2).max(40)).max(12),
});

export async function saveAccountAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = accountSchema.safeParse({
    title: str(form, "title"),
    description: str(form, "description"),
    price: str(form, "price"),
    compareAtPrice: str(form, "compareAtPrice"),
    level: str(form, "level"),
    skinsCount: str(form, "skinsCount"),
    chestsCount: str(form, "chestsCount"),
    emailStatus: str(form, "emailStatus") || undefined,
    rank: str(form, "rank") || undefined,
    region: str(form, "region") || "LATAM",
    label: str(form, "label") || "NONE",
    provenanceSource: str(form, "provenanceSource") || undefined,
    provenanceNotes: str(form, "provenanceNotes") || undefined,
    tags: [...new Set(str(form, "tags").split(",").map((t) => t.trim()).filter(Boolean))],
  });
  if (!parsed.success) return fail(firstError(parsed.error));
  const d = parsed.data;
  if (d.compareAtPrice != null && d.compareAtPrice <= d.price) return fail("El precio anterior debe ser mayor que el precio actual.");

  const id = str(form, "id");
  const existing = id ? await db.accountListing.findUnique({ where: { id } }) : null;
  const verified = bool(form, "inventoryVerified");
  const now = new Date();

  const data: Prisma.AccountListingUncheckedUpdateInput = {
    title: d.title,
    description: d.description,
    price: d.price,
    compareAtPrice: d.compareAtPrice,
    level: d.level,
    skinsCount: d.skinsCount,
    chestsCount: d.chestsCount,
    emailStatus: d.emailStatus ?? null,
    rank: d.rank ?? null,
    region: d.region,
    label: d.label,
    featured: bool(form, "featured"),
    isDemo: bool(form, "isDemo"),
    provenanceSource: d.provenanceSource ?? null,
    provenanceNotes: d.provenanceNotes ?? null,
    inventoryVerified: verified,
    inventoryVerifiedAt: verified ? (existing?.inventoryVerifiedAt ?? now) : null,
  };

  let accountId = id;
  if (existing) {
    await db.$transaction([
      db.accountListing.update({ where: { id }, data }),
      db.accountTag.deleteMany({ where: { accountId: id } }),
      db.accountTag.createMany({ data: d.tags.map((tag) => ({ accountId: id, tag })) }),
    ]);
    await audit({ actorId: user.id, action: "account.update", entity: "AccountListing", entityId: id, data: { price: d.price, verified } });
  } else {
    let slug = slugify(d.title) || "cuenta";
    if (await db.accountListing.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString(36)}`;
    const created = await db.accountListing.create({
      // Inventario, condiciones e información adicional ya no se piden: se crean vacíos.
      data: { ...(data as Prisma.AccountListingUncheckedCreateInput), inventoryItems: "", deliveryConditions: "", slug, status: "DRAFT", tags: { create: d.tags.map((tag) => ({ tag })) } },
    });
    accountId = created.id;
    await audit({ actorId: user.id, action: "account.create", entity: "AccountListing", entityId: created.id });
  }
  // Fotos elegidas en el mismo formulario (ya optimizadas en el navegador).
  const files = form.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
  let photoError: string | null = null;
  if (files.length) {
    const r = await saveListingImages(accountId, d.title, files);
    if (!r.ok) photoError = r.error;
    else await audit({ actorId: user.id, action: "account.images_upload", entity: "AccountListing", entityId: accountId, data: { count: files.length } });
  }

  // «Crear y publicar»: se publica si ya cumple los requisitos (al menos una foto).
  let published = false;
  if (!existing && str(form, "publish") === "1" && !photoError) {
    const images = await db.accountImage.count({ where: { accountId } });
    if (!publishBlockers({ imagesCount: images, openClaims: 0 }).length) {
      await db.accountListing.update({ where: { id: accountId }, data: { status: "PUBLISHED" } });
      await audit({ actorId: user.id, action: "account.status", entity: "AccountListing", entityId: accountId, data: { from: "DRAFT", to: "PUBLISHED" } });
      published = true;
    }
  }

  revalidatePath("/admin/cuentas");
  revalidatePath(`/admin/cuentas/${accountId}`);
  revalidatePath("/cuentas");
  if (!existing) redirect(published ? `/admin/cuentas?publicada=${encodeURIComponent(d.title.slice(0, 80))}` : `/admin/cuentas/${accountId}?creada=1`);
  if (photoError) return fail(`Cambios guardados, pero las fotos no se subieron: ${photoError}`);
  return ok(files.length ? `Cambios guardados y ${files.length} foto(s) agregada(s).` : "Cambios guardados.");
}

/** Guarda fotos de una cuenta (máximo 15 en total). */
async function saveListingImages(accountId: string, title: string, files: File[]): Promise<{ ok: true } | { ok: false; error: string }> {
  const current = await db.accountImage.count({ where: { accountId } });
  if (current + files.length > 15) return { ok: false, error: "Cada cuenta admite hasta 15 imágenes." };
  try {
    for (const [i, file] of files.entries()) {
      const url = await saveImage(file);
      await db.accountImage.create({ data: { accountId, url, alt: `${title} — imagen ${current + i + 1}`, sortOrder: current + i + 1 } });
    }
    return { ok: true };
  } catch (err) {
    if (err instanceof UploadError) return { ok: false, error: err.message };
    console.error("[upload]", (err as Error).message);
    return { ok: false, error: "No se pudo guardar la imagen. Revisa la configuración de almacenamiento." };
  }
}

const STATUS_FROM: Partial<Record<ListingStatus, ListingStatus[]>> = {
  PENDING_REVIEW: ["DRAFT", "PAUSED"],
  PUBLISHED: ["DRAFT", "PENDING_REVIEW", "PAUSED", "SUSPENDED"],
  PAUSED: ["PUBLISHED"],
  SUSPENDED: ["PUBLISHED", "PAUSED", "PENDING_REVIEW", "RESERVED", "DRAFT"],
  RETIRED: ["DRAFT", "PENDING_REVIEW", "PUBLISHED", "PAUSED", "SUSPENDED"],
  DRAFT: ["PENDING_REVIEW", "PAUSED"],
};

export async function setListingStatusAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const id = str(form, "id");
  const to = str(form, "to") as ListingStatus;
  const allowedFrom = STATUS_FROM[to];
  if (!allowedFrom) return fail("Estado no permitido.");

  const listing = await db.accountListing.findUnique({
    where: { id },
    include: { _count: { select: { images: true, claims: { where: { status: { in: ["OPEN", "REVIEWING"] } } } } } },
  });
  if (!listing) return fail("Publicación no encontrada.");

  if (to === "PUBLISHED") {
    const blockers = publishBlockers({
      imagesCount: listing._count.images,
      openClaims: listing._count.claims,
    });
    if (blockers.length) return fail(`No se puede publicar: ${blockers.join(" ")}`);
  }

  const res = await db.accountListing.updateMany({ where: { id, status: { in: allowedFrom } }, data: { status: to } });
  if (res.count !== 1) {
    return fail(listing.status === "RESERVED" ? "La cuenta está reservada en un checkout activo. Espera a que termine o suspéndela." : "La publicación cambió de estado. Recarga la página.");
  }
  await audit({ actorId: user.id, action: "account.status", entity: "AccountListing", entityId: id, data: { from: listing.status, to } });
  revalidatePath(`/admin/cuentas/${id}`);
  revalidatePath("/cuentas");
  return ok("Estado actualizado.");
}

/**
 * Elimina una cuenta en venta con sus fotos, etiquetas y reclamaciones. Los pedidos conservan su copia
 * (itemSnapshot) y quedan sin enlace. No se permite si está reservada o tiene un pedido en curso.
 */
export async function deleteAccountAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const id = str(form, "id");
  const listing = await db.accountListing.findUnique({ where: { id }, select: { id: true, title: true, status: true, reservedUntil: true } });
  if (!listing) return fail("La cuenta ya no existe.");
  if (listing.status === "RESERVED" && listing.reservedUntil && listing.reservedUntil > new Date()) {
    return fail("Está reservada por un cliente que está pagando. Espera a que termine o suspéndela.");
  }
  const active = await db.order.count({ where: { accountId: id, status: { in: ["PENDING_PAYMENT", "PAID", "PROCESSING", "DELIVERY_FAILED", "REFUND_REQUESTED"] } } });
  if (active > 0) return fail("Tiene un pedido en curso. Termina la entrega o el reembolso antes de eliminarla.");
  await db.accountListing.delete({ where: { id } });
  await audit({ actorId: user.id, action: "account.delete", entity: "AccountListing", entityId: id, data: { title: listing.title } });
  revalidatePath("/admin/cuentas");
  revalidatePath("/cuentas");
  redirect(`/admin/cuentas?eliminada=${encodeURIComponent(listing.title.slice(0, 80))}`);
}

export async function uploadAccountImagesAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const id = str(form, "id");
  const files = form.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return fail("Selecciona al menos una imagen.");
  if (files.length > 8) return fail("Máximo 8 imágenes por carga.");
  const current = await db.accountImage.count({ where: { accountId: id } });
  if (current + files.length > 15) return fail("Cada publicación admite hasta 15 imágenes.");
  const listing = await db.accountListing.findUnique({ where: { id }, select: { title: true } });
  if (!listing) return fail("Publicación no encontrada.");
  try {
    for (const [i, file] of files.entries()) {
      const url = await saveImage(file);
      await db.accountImage.create({ data: { accountId: id, url, alt: `${listing.title} — imagen ${current + i + 1}`, sortOrder: current + i + 1 } });
    }
  } catch (err) {
    if (err instanceof UploadError) return fail(err.message);
    console.error("[upload]", (err as Error).message);
    return fail("No se pudo guardar la imagen. Revisa la configuración de almacenamiento.");
  }
  await audit({ actorId: user.id, action: "account.images_upload", entity: "AccountListing", entityId: id, data: { count: files.length } });
  revalidatePath(`/admin/cuentas/${id}`);
  return ok(`${files.length} imagen(es) subida(s).`);
}

export async function imageAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const imageId = str(form, "imageId");
  const op = str(form, "op");
  const img = await db.accountImage.findUnique({ where: { id: imageId } });
  if (!img) return fail("Imagen no encontrada.");
  if (op === "delete") {
    await db.accountImage.delete({ where: { id: imageId } });
  } else if (op === "first") {
    const min = await db.accountImage.aggregate({ where: { accountId: img.accountId }, _min: { sortOrder: true } });
    await db.accountImage.update({ where: { id: imageId }, data: { sortOrder: (min._min.sortOrder ?? 0) - 1 } });
  } else return fail("Operación no soportada.");
  await audit({ actorId: user.id, action: `account.image_${op}`, entity: "AccountListing", entityId: img.accountId });
  revalidatePath(`/admin/cuentas/${img.accountId}`);
  return ok(op === "delete" ? "Imagen eliminada." : "Imagen principal actualizada.");
}

// =====================================================================
// Reclamaciones y soporte
// =====================================================================

export async function claimAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const user = await requireStaff();
  const id = str(form, "id");
  const op = str(form, "op");
  const claim = await db.listingClaim.findUnique({ where: { id }, include: { account: true } });
  if (!claim) return fail("Reclamación no encontrada.");
  const resolution = str(form, "resolution").slice(0, 2000) || null;

  if (op === "review_suspend") {
    await db.listingClaim.update({ where: { id }, data: { status: "REVIEWING" } });
    await db.accountListing.updateMany({
      where: { id: claim.accountId, status: { in: ["PUBLISHED", "PAUSED", "PENDING_REVIEW", "RESERVED", "DRAFT"] } },
      data: { status: "SUSPENDED" },
    });
  } else if (op === "uphold") {
    await db.listingClaim.update({ where: { id }, data: { status: "UPHELD", resolution } });
    await db.accountListing.updateMany({ where: { id: claim.accountId, status: { not: "SOLD" } }, data: { status: "RETIRED" } });
  } else if (op === "dismiss") {
    await db.listingClaim.update({ where: { id }, data: { status: "DISMISSED", resolution } });
  } else return fail("Operación no soportada.");

  await audit({ actorId: user.id, action: `claim.${op}`, entity: "ListingClaim", entityId: id, data: { accountId: claim.accountId } });
  revalidatePath("/admin/reclamos");
  return ok(
    op === "review_suspend"
      ? "Publicación suspendida mientras se revisa."
      : op === "uphold"
        ? "Reclamación procedente: publicación retirada."
        : "Reclamación descartada. Puedes reactivar la publicación desde su ficha.",
  );
}

export async function ticketAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const user = await requireStaff();
  const id = str(form, "id");
  const status = z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]).safeParse(str(form, "status"));
  if (!status.success) return fail("Estado inválido.");
  await db.supportTicket.update({ where: { id }, data: { status: status.data } });
  await audit({ actorId: user.id, action: "ticket.status", entity: "SupportTicket", entityId: id, data: { status: status.data } });
  revalidatePath("/admin/soporte");
  return ok("Solicitud actualizada.");
}

/** Responde una solicitud de soporte: se envía al correo del cliente (si el correo está configurado) y queda en el historial. */
export async function replyTicketAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const user = await requireStaff();
  const id = str(form, "id");
  const body = str(form, "body").replace(/\r\n?/g, "\n").slice(0, 4000);
  if (body.length < 2) return fail("Escribe la respuesta.");
  const ticket = await db.supportTicket.findUnique({ where: { id }, include: { order: { select: { number: true, trackingToken: true } } } });
  if (!ticket) return fail("Solicitud no encontrada.");

  const brand = await getBrand();
  const ref = ticket.id.slice(-8).toUpperCase();
  const orderLink = ticket.order ? `${env.appUrl}/pedido/${ticket.order.number}?t=${ticket.order.trackingToken}` : undefined;
  const accountLink = ticket.userId ? `${env.appUrl}/cuenta?seccion=soporte` : undefined;
  const result = await sendEmail(ticket.email, "support_reply", supportReplyEmail(brand, { ref, body, orderLink, accountLink }), { replyTo: brand.supportEmail });
  const resolve = bool(form, "resolve");
  await db.$transaction([
    db.ticketReply.create({ data: { ticketId: id, authorEmail: user.email, body, delivery: result.status, error: result.error ?? null } }),
    db.supportTicket.update({ where: { id }, data: { status: resolve ? "RESOLVED" : ticket.status === "OPEN" ? "IN_PROGRESS" : ticket.status } }),
  ]);
  await audit({ actorId: user.id, action: "ticket.reply", entity: "SupportTicket", entityId: id, data: { delivery: result.status } });
  revalidatePath("/admin/soporte");
  if (result.status === "SENT") return ok(resolve ? "Respuesta enviada y solicitud resuelta." : "Respuesta enviada al cliente.");
  if (result.status === "SKIPPED") return ok("Respuesta guardada. El correo no está configurado: envíala también por correo o WhatsApp.");
  return fail(`La respuesta se guardó, pero el correo falló (${result.error}). Inténtalo por otro medio.`);
}

/** Envía un correo de prueba para confirmar que el proveedor de correo funciona. */
export async function sendTestEmailAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const to = emailSchema.safeParse(str(form, "to") || user.email);
  if (!to.success) return fail("Correo inválido.");
  if (!rateLimit(`test-email:${user.id}`, 5, 10 * 60_000).ok) return fail("Espera unos minutos antes de enviar otra prueba.");
  const r = await sendEmail(to.data, "test", testEmail(await getBrand()));
  await audit({ actorId: user.id, action: "email.test", entity: "Email", data: { status: r.status } });
  revalidatePath("/admin/correos");
  if (r.status === "SENT") return ok(`Correo enviado a ${to.data}. Revisa la bandeja de entrada (y spam).`);
  if (r.status === "SKIPPED") return fail("El correo no está configurado. Define NOTIFY_PROVIDER y sus variables (ver Integraciones).");
  return fail(`El proveedor rechazó el envío: ${r.error}`);
}

// =====================================================================
// Códigos promocionales
// =====================================================================

const promoSchema = z.object({
  code: z
    .string()
    .transform((v) => normalizePromoCode(v))
    .refine((v) => PROMO_CODE_PATTERN.test(v), "El código debe tener 4 a 32 caracteres: letras, números o guiones (sin empezar ni terminar en guion)."),
  description: z.string().max(255).optional(),
  discountType: z.enum(["PERCENT", "FIXED"]),
  value: reqInt(1),
  maxDiscount: optInt,
  minSubtotal: optInt,
  scope: z.enum(["ALL", "TOPUP", "ACCOUNT"]),
  maxUses: optInt,
  maxUsesPerEmail: reqInt(1),
});

export async function savePromoCodeAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = promoSchema.safeParse({
    code: str(form, "code"),
    description: str(form, "description") || undefined,
    discountType: str(form, "discountType"),
    value: str(form, "value"),
    maxDiscount: str(form, "maxDiscount"),
    minSubtotal: str(form, "minSubtotal"),
    scope: str(form, "scope") || "ALL",
    maxUses: str(form, "maxUses"),
    maxUsesPerEmail: str(form, "maxUsesPerEmail") || "1",
  });
  if (!parsed.success) return fail(firstError(parsed.error));
  const d = parsed.data;
  if (d.discountType === "PERCENT" && d.value > 90) return fail("El porcentaje máximo es 90%.");
  if (d.maxUses != null && d.maxUses < 1) return fail("El límite total de usos debe ser 1 o más (o vacío para ilimitado).");
  const startsRaw = str(form, "startsAt");
  const endsRaw = str(form, "endsAt");
  const startsAt = startsRaw ? bogota(startsRaw) : null;
  const endsAt = endsRaw ? bogota(endsRaw) : null;
  if ((startsRaw && !startsAt) || (endsRaw && !endsAt)) return fail("Fecha inválida.");
  if (startsAt && endsAt && endsAt <= startsAt) return fail("La fecha de fin debe ser posterior al inicio.");

  const data = {
    code: d.code,
    description: d.description ?? null,
    discountType: d.discountType,
    value: d.value,
    maxDiscount: d.discountType === "PERCENT" ? d.maxDiscount : null,
    minSubtotal: d.minSubtotal,
    scope: d.scope,
    maxUses: d.maxUses,
    maxUsesPerEmail: d.maxUsesPerEmail,
    startsAt,
    endsAt,
    active: bool(form, "active"),
    isDemo: bool(form, "isDemo"),
  };
  const id = str(form, "id");
  const clash = await db.promoCode.findUnique({ where: { code: d.code } });
  if (clash && clash.id !== id) return fail("Ya existe un código con ese nombre.");
  if (id) {
    await db.promoCode.update({ where: { id }, data });
  } else {
    await db.promoCode.create({ data });
  }
  await audit({ actorId: user.id, action: id ? "promo.update" : "promo.create", entity: "PromoCode", entityId: id || null, data: { code: d.code, value: d.value, type: d.discountType } });
  revalidatePath("/admin/codigos");
  return ok(id ? "Código actualizado." : `Código ${d.code} creado.`);
}

export async function promoCodeAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const id = str(form, "id");
  const op = str(form, "op");
  const promo = await db.promoCode.findUnique({ where: { id }, include: { _count: { select: { redemptions: true } } } });
  if (!promo) return fail("Código no encontrado.");
  if (op === "toggle") {
    await db.promoCode.update({ where: { id }, data: { active: !promo.active } });
  } else if (op === "delete") {
    if (promo._count.redemptions > 0) {
      await db.promoCode.update({ where: { id }, data: { active: false } });
      await audit({ actorId: user.id, action: "promo.deactivate", entity: "PromoCode", entityId: id });
      revalidatePath("/admin/codigos");
      return ok("El código tiene usos registrados: se desactivó en lugar de eliminarse.");
    }
    await db.promoCode.delete({ where: { id } });
  } else return fail("Operación no soportada.");
  await audit({ actorId: user.id, action: `promo.${op}`, entity: "PromoCode", entityId: id, data: { code: promo.code } });
  revalidatePath("/admin/codigos");
  return ok(op === "toggle" ? (promo.active ? "Código desactivado." : "Código activado.") : "Código eliminado.");
}

// =====================================================================
// Ajustes, integraciones y usuarios
// =====================================================================

export async function saveSettingsAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const values: Partial<Record<SettingKey, string>> = {};
  for (const key of Object.keys(SETTING_DEFAULTS) as SettingKey[]) {
    if (MANAGED_SETTING_KEYS.has(key)) continue; // se gestionan en Paquetes / Proveedor
    if (key === "showGarenaDisclaimer") values[key] = bool(form, key) ? "true" : "false";
    else if (key === "accountsMode") values[key] = ["auto", "on", "off"].includes(str(form, key)) ? str(form, key) : "auto";
    else if (key === "paymentMethods") values[key] = parsePaymentMethods(form.getAll("paymentMethods").map(String).join(",") || "none").join(",");
    else values[key] = str(form, key).slice(0, 400);
  }
  if (!values.storeName) return fail("El nombre de la tienda es obligatorio.");
  if (values.orderPrefix && !/^[A-Z0-9]{2,6}$/.test(values.orderPrefix)) return fail("El prefijo de pedidos debe tener 2 a 6 letras mayúsculas o números.");
  if (values.whatsapp && !/^\+?\d{8,15}$/.test(values.whatsapp.replace(/[\s-]/g, ""))) return fail("WhatsApp debe incluir el indicativo, ej. 573001234567.");
  if (values.instagram && !/^https:\/\/(www\.)?instagram\.com\//.test(values.instagram)) return fail("Instagram debe ser una URL https://instagram.com/…");
  if (values.supportEmail && !emailSchema.safeParse(values.supportEmail).success) return fail("Correo de soporte inválido.");
  if (values.staffAlertEmail && !emailSchema.safeParse(values.staffAlertEmail).success) return fail("Correo para avisos internos inválido.");
  if (values.logoUrl && !/^(https:\/\/|\/)/.test(values.logoUrl)) return fail("El logo debe ser una URL https o una ruta del sitio.");
  await saveSettings(values);
  await audit({ actorId: user.id, action: "settings.update", entity: "Setting", data: values });
  revalidatePath("/", "layout");
  return ok("Ajustes guardados.");
}

export async function testIntegrationAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const key = str(form, "key");
  const r = await runHealthCheck(key);
  await audit({ actorId: user.id, action: "integration.test", entity: "Integration", entityId: key, data: { ok: r.ok } });
  revalidatePath("/admin/integraciones");
  return r.ok ? ok(r.message) : fail(r.message);
}

export async function createStaffAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = z
    .object({ email: emailSchema, name: z.string().min(2).max(80), password: passwordSchema, role: z.enum(["ADMIN", "SUPPORT", "CUSTOMER"]) })
    .safeParse({ email: str(form, "email"), name: str(form, "name"), password: str(form, "password"), role: str(form, "role") });
  if (!parsed.success) return fail(firstError(parsed.error));
  if (await db.user.findUnique({ where: { email: parsed.data.email } })) return fail("Ya existe un usuario con ese correo.");
  const u = await db.user.create({
    data: { email: parsed.data.email, name: parsed.data.name, role: parsed.data.role, passwordHash: await hashPassword(parsed.data.password) },
  });
  await audit({ actorId: admin.id, action: "user.create", entity: "User", entityId: u.id, data: { role: u.role } });
  revalidatePath("/admin/usuarios");
  return ok("Usuario creado.");
}

export async function userAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const id = str(form, "id");
  if (id === admin.id) return fail("No puedes modificar tu propio rol o acceso.");
  const op = str(form, "op");
  if (op === "role") {
    const role = z.enum(["ADMIN", "SUPPORT", "CUSTOMER"]).safeParse(str(form, "role"));
    if (!role.success) return fail("Rol inválido.");
    await db.user.update({ where: { id }, data: { role: role.data as Role } });
    await db.session.deleteMany({ where: { userId: id } });
  } else if (op === "toggle") {
    const u = await db.user.findUniqueOrThrow({ where: { id } });
    await db.user.update({ where: { id }, data: { disabled: !u.disabled } });
    await db.session.deleteMany({ where: { userId: id } });
  } else if (op === "reset2fa") {
    // Si alguien perdió el celular y los códigos: deberá configurarlo de nuevo al ingresar.
    await db.user.update({ where: { id }, data: { totpSecret: null, totpPendingSecret: null, totpEnabledAt: null, totpLastStep: null, recoveryCodes: Prisma.DbNull } });
    await db.session.deleteMany({ where: { userId: id } });
    void notifyStaffSecurity(id, "2fa_reset").catch(() => {});
  } else return fail("Operación no soportada.");
  await audit({ actorId: admin.id, action: `user.${op}`, entity: "User", entityId: id });
  revalidatePath("/admin/usuarios");
  return ok("Usuario actualizado.");
}

// =====================================================================
// Banners promocionales
// =====================================================================

/** Enlaces permitidos: rutas internas o https. */
const toPlacement = toBannerSlot;

function safeHref(v: string): string | null | false {
  if (!v) return null;
  if (/^\/(?!\/)[\w\-./?=&#%]*$/.test(v)) return v;
  if (/^https:\/\/[^\s]+$/.test(v) && v.length <= 255) return v;
  return false;
}

export async function uploadBannerAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const file = form.get("image");
  if (!(file instanceof File) || file.size === 0) return fail("Selecciona una imagen.");
  const title = str(form, "title").slice(0, 120);
  if (title.length < 4) return fail("Escribe una descripción corta del banner (se usa como texto alternativo).");
  const href = safeHref(str(form, "href"));
  if (href === false) return fail("El enlace debe ser una ruta de la tienda (ej. /recargas) o una URL https.");
  let url: string;
  try {
    url = await saveImage(file);
  } catch (err) {
    if (err instanceof UploadError) return fail(err.message);
    return fail("No se pudo guardar la imagen.");
  }
  // Versión para celular (opcional).
  let mobileUrl: string | null = null;
  const mobileFile = form.get("imageMobile");
  if (mobileFile instanceof File && mobileFile.size > 0) {
    try {
      mobileUrl = await saveImage(mobileFile);
    } catch (err) {
      if (err instanceof UploadError) return fail(`Imagen para celular: ${err.message}`);
      return fail("No se pudo guardar la imagen para celular.");
    }
  }
  const placement = toPlacement(str(form, "placement"));
  const max = await db.promoBanner.aggregate({ where: { placement }, _max: { sortOrder: true } });
  const b = await db.promoBanner.create({ data: { title, imageUrl: url, imageMobileUrl: mobileUrl, href, placement, sortOrder: (max._max.sortOrder ?? 0) + 1 } });
  await audit({ actorId: user.id, action: "banner.create", entity: "PromoBanner", entityId: b.id });
  revalidatePath("/admin/banners");
  revalidatePath("/");
  return ok("Banner publicado.");
}

/** Imagen del producto de recargas: sube una nueva o vuelve al arte por defecto. */
export async function topupCoverAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  let url = "";
  if (str(form, "op") !== "remove") {
    const file = form.get("image");
    if (!(file instanceof File) || file.size === 0) return fail("Selecciona una imagen.");
    try {
      url = await saveImage(file);
    } catch (err) {
      if (err instanceof UploadError) return fail(err.message);
      return fail("No se pudo guardar la imagen.");
    }
  }
  await saveSettings({ topupCoverUrl: url });
  await audit({ actorId: user.id, action: url ? "topup_cover.upload" : "topup_cover.remove", entity: "Setting", entityId: "topupCoverUrl" });
  revalidatePath("/recargas");
  revalidatePath("/admin/paquetes");
  return ok(url ? "Imagen del producto actualizada." : "Se volvió a la imagen por defecto.");
}

export async function bannerAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const id = str(form, "id");
  const op = str(form, "op");
  const b = await db.promoBanner.findUnique({ where: { id } });
  if (!b) return fail("Banner no encontrado.");

  if (op === "toggle") {
    await db.promoBanner.update({ where: { id }, data: { active: !b.active } });
  } else if (op === "up" || op === "down") {
    const all = await db.promoBanner.findMany({ where: { placement: b.placement }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
    const i = all.findIndex((x) => x.id === id);
    const j = op === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= all.length) return ok("Sin cambios.");
    [all[i], all[j]] = [all[j], all[i]];
    await db.$transaction(all.map((x, k) => db.promoBanner.update({ where: { id: x.id }, data: { sortOrder: k + 1 } })));
  } else if (op === "update") {
    const title = str(form, "title").slice(0, 120);
    const href = safeHref(str(form, "href"));
    if (title.length < 4) return fail("La descripción es muy corta.");
    if (href === false) return fail("El enlace debe ser una ruta de la tienda (ej. /recargas) o una URL https.");
    const placement = toPlacement(str(form, "placement") || b.placement);
    const moved = placement !== b.placement;
    const max = moved ? await db.promoBanner.aggregate({ where: { placement }, _max: { sortOrder: true } }) : null;
    await db.promoBanner.update({ where: { id }, data: { title, href, placement, ...(moved ? { sortOrder: (max?._max.sortOrder ?? 0) + 1 } : {}) } });
  } else if (op === "mobile") {
    const file = form.get("imageMobile");
    if (!(file instanceof File) || file.size === 0) return fail("Selecciona la imagen para celular.");
    try {
      await db.promoBanner.update({ where: { id }, data: { imageMobileUrl: await saveImage(file) } });
    } catch (err) {
      if (err instanceof UploadError) return fail(err.message);
      return fail("No se pudo guardar la imagen.");
    }
  } else if (op === "mobile_remove") {
    await db.promoBanner.update({ where: { id }, data: { imageMobileUrl: null } });
  } else if (op === "delete") {
    await db.promoBanner.delete({ where: { id } });
  } else return fail("Operación no soportada.");

  await audit({ actorId: user.id, action: `banner.${op}`, entity: "PromoBanner", entityId: id });
  revalidatePath("/admin/banners");
  revalidatePath("/");
  return ok(op === "delete" ? "Banner eliminado." : "Banner actualizado.");
}
