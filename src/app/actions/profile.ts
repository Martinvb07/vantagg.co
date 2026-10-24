"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { destroySession, getCurrentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { firstError, phoneSchema } from "@/lib/validation";
import { isAvatarPreset } from "@/domain/avatars";
import { isProfileTheme } from "@/domain/player";
import { deleteLocalAvatar, saveImage, UploadError } from "@/server/storage";

type State = { ok?: string; error?: string } | null;

const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

const profileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Tu nombre debe tener al menos 2 letras.")
    .max(60, "Nombre demasiado largo.")
    .regex(/^[\p{L}\p{M}0-9 .'-]+$/u, "Usa solo letras, números y espacios en el nombre."),
  phone: phoneSchema,
  ffPlayerId: z
    .string()
    .trim()
    .regex(/^\d{6,12}$/, "Tu ID de Free Fire tiene entre 6 y 12 números.")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

async function me() {
  const user = await getCurrentUser();
  if (!user) redirect("/ingresar?next=/cuenta");
  return user;
}

const refresh = () => {
  revalidatePath("/cuenta");
  revalidatePath("/", "layout"); // el avatar del encabezado
};

/** Datos superficiales del perfil: nombre, WhatsApp e ID de Free Fire. El correo no se cambia aquí. */
export async function updateProfileAction(_: State, form: FormData): Promise<State> {
  const user = await me();
  if (!rateLimit(`profile:${user.id}`, 20, 10 * 60_000).ok) return { error: "Demasiados cambios seguidos. Espera unos minutos." };
  const parsed = profileSchema.safeParse({ name: form.get("name"), phone: form.get("phone") ?? "", ffPlayerId: form.get("ffPlayerId") ?? "" });
  if (!parsed.success) return { error: firstError(parsed.error) };
  await db.user.update({
    where: { id: user.id },
    data: { name: parsed.data.name, phone: parsed.data.phone ?? null, ffPlayerId: parsed.data.ffPlayerId ?? null },
  });
  await audit({ actorId: user.id, action: "profile.update", entity: "User", entityId: user.id });
  refresh();
  return { ok: "Perfil actualizado." };
}

export async function chooseAvatarAction(preset: string): Promise<State> {
  const user = await me();
  if (!isAvatarPreset(preset)) return { error: "Avatar no válido." };
  if (!rateLimit(`avatar:${user.id}`, 30, 10 * 60_000).ok) return { error: "Demasiados cambios seguidos." };
  await db.user.update({ where: { id: user.id }, data: { avatarPreset: preset, avatarUrl: null } });
  refresh();
  return { ok: "Avatar actualizado." };
}

/** Foto de perfil: JPG, PNG, WebP o AVIF hasta 2 MB; se valida el contenido real del archivo. */
export async function uploadAvatarAction(_: State, form: FormData): Promise<State> {
  const user = await me();
  if (!rateLimit(`avatar-upload:${user.id}`, 6, 60 * 60_000).ok) return { error: "Subiste varias fotos seguidas. Intenta en un rato." };
  const file = form.get("photo");
  if (!(file instanceof File) || file.size === 0) return { error: "Elige una foto." };
  let url: string;
  try {
    url = await saveImage(file, { folder: "avatars", maxBytes: AVATAR_MAX_BYTES });
  } catch (err) {
    return { error: err instanceof UploadError ? err.message : "No se pudo guardar la foto." };
  }
  await db.user.update({ where: { id: user.id }, data: { avatarUrl: url, avatarPreset: null } });
  await audit({ actorId: user.id, action: "profile.avatar_upload", entity: "User", entityId: user.id });
  refresh();
  return { ok: "Foto de perfil actualizada." };
}

export async function removeAvatarAction(): Promise<State> {
  const user = await me();
  await db.user.update({ where: { id: user.id }, data: { avatarUrl: null, avatarPreset: null } });
  refresh();
  return { ok: "Volviste a tus iniciales." };
}

/** Cierra todas las sesiones (por ejemplo, si iniciaste sesión en un equipo ajeno). */
export async function logoutEverywhereAction() {
  const user = await me();
  await db.session.deleteMany({ where: { userId: user.id } });
  await destroySession();
  await audit({ actorId: user.id, action: "auth.logout_all", entity: "User", entityId: user.id });
  redirect("/ingresar");
}

/** Portada del perfil (tema de colores). */
export async function setProfileThemeAction(theme: string): Promise<State> {
  const user = await me();
  if (!isProfileTheme(theme)) return { error: "Portada no válida." };
  await db.user.update({ where: { id: user.id }, data: { profileTheme: theme } });
  revalidatePath("/cuenta");
  return { ok: "Portada actualizada." };
}

/**
 * Supresión de datos (Ley 1581 de 2012): el cliente elimina su cuenta. Se borran perfil, sesiones, foto,
 * ID de Free Fire guardado y vínculo con Google. Los pedidos y solicitudes quedan sin cuenta asociada y se
 * conservan solo por obligación legal y contable (Código de Comercio, art. 60), como explica la política.
 */
export async function deleteMyAccountAction(_: State, form: FormData): Promise<State> {
  const user = await me();
  if (user.role !== "CUSTOMER") return { error: "Las cuentas del equipo no se eliminan desde aquí." };
  if (String(form.get("confirm") ?? "").trim().toUpperCase() !== "ELIMINAR") return { error: "Escribe ELIMINAR para confirmar." };
  if (!rateLimit(`delete-account:${user.id}`, 3, 10 * 60_000).ok) return { error: "Demasiados intentos. Espera unos minutos." };
  const account = await db.user.findUnique({ where: { id: user.id }, select: { avatarUrl: true } });
  // Al borrar el usuario: sesiones y recuperaciones se eliminan en cascada; pedidos, solicitudes y
  // registros de auditoría quedan sin usuario (SetNull).
  await db.user.delete({ where: { id: user.id } });
  await deleteLocalAvatar(account?.avatarUrl);
  await audit({ actorId: null, action: "user.self_delete", entity: "User", entityId: user.id });
  await destroySession();
  redirect("/ingresar?eliminada=1");
}
