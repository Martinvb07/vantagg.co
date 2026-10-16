"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { createSession, getCurrentUser, isStaff, STAFF_SESSION_TTL_MS } from "@/lib/auth";
import { hmacSha256Hex } from "@/lib/crypto";
import { getAuthSecret } from "@/lib/env";
import { hashPassword, verifyPassword } from "@/lib/password";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";
import { safeNext } from "@/lib/safe-next";
import { openText, sealText } from "@/lib/secure-box";
import { generateRecoveryCodes, generateTotpSecret, normalizeRecovery, otpauthUri, verifyTotp } from "@/lib/totp";
import { loginSchema, passwordSchema } from "@/lib/validation";
import { clearMfaTicket, readMfaTicket, setMfaTicket } from "@/server/admin-gate";
import { getSettings } from "@/server/settings";
import { notifyStaffSecurity } from "@/server/notifications";

export type StaffAuthState =
  | { step: "password"; error?: string }
  | { step: "totp"; error?: string }
  | { step: "enroll"; qr: string; secret: string; error?: string }
  | { step: "codes"; codes: string[]; next: string }
  | null;

const DUMMY_HASH = "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$" + "A".repeat(86) + "==";
const GENERIC = "Correo, contraseña o código incorrectos.";
const recoveryHash = (code: string) => hmacSha256Hex(getAuthSecret(), `recovery:${normalizeRecovery(code)}`);
const nextOf = (form: FormData) => {
  const n = safeNext(form.get("next"), "/admin");
  return n.startsWith("/admin") ? n : "/admin";
};

/** QR para activar el 2FA. Reusa el secreto pendiente si ya existe: si alguien ya lo escaneó, sus códigos siguen sirviendo. */
async function enrollmentPayload(userId: string, email: string, pendingSealed?: string | null) {
  let secret = pendingSealed ? openText(pendingSealed, "totp:v1") : null;
  if (!secret) {
    secret = generateTotpSecret();
    await db.user.update({ where: { id: userId }, data: { totpPendingSecret: sealText(secret, "totp:v1") } });
  }
  const issuer = `${(await getSettings()).storeName} Panel`;
  const qr = await QRCode.toDataURL(otpauthUri(issuer, email, secret), { margin: 1, width: 220, color: { dark: "#0f1116", light: "#ffffff" } });
  return { step: "enroll" as const, qr, secret: secret.replace(/(.{4})/g, "$1 ").trim() };
}

/** Paso 1: correo y contraseña. No abre sesión: deja un ticket de 10 min para el código. */
export async function staffPasswordAction(_: StaffAuthState, form: FormData): Promise<StaffAuthState> {
  const ip = await clientIp();
  const parsed = loginSchema.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { step: "password", error: GENERIC };
  if (!rateLimit(`staff-ip:${ip}`, 10, 15 * 60_000).ok || !rateLimit(`staff-email:${parsed.data.email}`, 6, 15 * 60_000).ok) {
    return { step: "password", error: "Demasiados intentos. Espera 15 minutos." };
  }
  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  const valid = await verifyPassword(parsed.data.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid || user.disabled || !isStaff(user.role) || !user.hasPassword) {
    if (user && isStaff(user.role)) await audit({ actorId: user.id, action: "auth.staff_login_failed", entity: "User", entityId: user.id });
    return { step: "password", error: GENERIC };
  }
  await setMfaTicket(user.id);
  return user.totpEnabledAt && user.totpSecret ? { step: "totp" } : await enrollmentPayload(user.id, user.email, user.totpPendingSecret);
}

/** Paso 2: código de la app (6 dígitos) o código de recuperación (ABCD-EFGH, de un solo uso). */
export async function staffTotpAction(_: StaffAuthState, form: FormData): Promise<StaffAuthState> {
  const userId = await readMfaTicket();
  if (!userId) return { step: "password", error: "La verificación venció. Ingresa de nuevo." };
  if (!rateLimit(`staff-2fa:${userId}`, 6, 10 * 60_000).ok) return { step: "totp", error: "Demasiados códigos incorrectos. Espera 10 minutos." };
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || user.disabled || !isStaff(user.role) || !user.totpSecret) return { step: "password", error: GENERIC };

  const raw = String(form.get("code") ?? "").trim();
  const digits = raw.replace(/\s/g, "");
  let method: "totp" | "recovery" | null = null;

  if (/^\d{6}$/.test(digits)) {
    const secret = openText(user.totpSecret, "totp:v1");
    const r = secret ? verifyTotp(secret, digits, user.totpLastStep) : { ok: false as const };
    if (r.ok) {
      // Guardar el paso usado evita que el mismo código sirva dos veces.
      const claimed = await db.user.updateMany({ where: { id: user.id, OR: [{ totpLastStep: null }, { totpLastStep: { lt: r.step } }] }, data: { totpLastStep: r.step } });
      if (claimed.count === 1) method = "totp";
    }
  } else if (normalizeRecovery(raw).length === 8) {
    const hashes = (Array.isArray(user.recoveryCodes) ? user.recoveryCodes : []) as string[];
    const h = recoveryHash(raw);
    if (hashes.includes(h)) {
      await db.user.update({ where: { id: user.id }, data: { recoveryCodes: hashes.filter((x) => x !== h) } });
      method = "recovery";
    }
  }

  if (!method) {
    await audit({ actorId: user.id, action: "auth.staff_2fa_failed", entity: "User", entityId: user.id });
    return { step: "totp", error: "Código incorrecto o ya usado." };
  }
  await clearMfaTicket();
  const ua = (await headers()).get("user-agent");
  await createSession(user.id, ua, STAFF_SESSION_TTL_MS);
  await audit({ actorId: user.id, action: method === "recovery" ? "auth.staff_login_recovery" : "auth.staff_login", entity: "User", entityId: user.id });
  void notifyStaffSecurity(user.id, "login", { userAgent: ua, method: method === "recovery" ? "Código de recuperación" : "App de autenticación" }).catch(() => {});
  redirect(nextOf(form));
}

/** Primera vez: confirma el código de la app recién escaneada, activa el 2FA y entrega los códigos de recuperación. */
export async function staffEnrollAction(_: StaffAuthState, form: FormData): Promise<StaffAuthState> {
  const userId = await readMfaTicket();
  if (!userId) return { step: "password", error: "La verificación venció. Ingresa de nuevo." };
  if (!rateLimit(`staff-enroll:${userId}`, 8, 10 * 60_000).ok) return { step: "password", error: "Demasiados intentos. Espera 10 minutos." };
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || user.disabled || !isStaff(user.role) || user.totpEnabledAt || !user.totpPendingSecret) return { step: "password", error: GENERIC };
  const secret = openText(user.totpPendingSecret, "totp:v1");
  const code = String(form.get("code") ?? "").replace(/\s/g, "");
  const r = secret ? verifyTotp(secret, code, null) : { ok: false as const };
  if (!r.ok || !secret) {
    const again = await enrollmentPayload(user.id, user.email, user.totpPendingSecret);
    return { ...again, error: "El código no coincide. Revisa que la hora del celular sea automática e inténtalo con el código actual." };
  }
  const codes = generateRecoveryCodes();
  await db.user.update({
    where: { id: user.id },
    data: { totpSecret: user.totpPendingSecret, totpPendingSecret: null, totpEnabledAt: new Date(), totpLastStep: r.step, recoveryCodes: codes.map(recoveryHash) },
  });
  // La sesión se abre al confirmar que guardó los códigos (si no, la página saltaría al panel y no los vería).
  await setMfaTicket(user.id, "enrolled");
  await audit({ actorId: user.id, action: "auth.staff_2fa_enabled", entity: "User", entityId: user.id });
  return { step: "codes", codes, next: nextOf(form) };
}

/** Tras ver los códigos de recuperación: abre la sesión del panel. */
export async function staffFinishEnrollAction(form: FormData) {
  const userId = await readMfaTicket("enrolled");
  if (!userId) redirect("/admin");
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, role: true, disabled: true, totpEnabledAt: true } });
  if (!user || user.disabled || !isStaff(user.role) || !user.totpEnabledAt) redirect("/admin");
  await clearMfaTicket();
  const ua = (await headers()).get("user-agent");
  await createSession(user.id, ua, STAFF_SESSION_TTL_MS);
  await audit({ actorId: user.id, action: "auth.staff_login", entity: "User", entityId: user.id });
  void notifyStaffSecurity(user.id, "2fa_enabled", { userAgent: ua }).catch(() => {});
  redirect(nextOf(form));
}

/** Panel → Seguridad: nuevos códigos de recuperación (exige un código actual de la app). */
export async function regenerateRecoveryCodesAction(_: { error?: string; codes?: string[] } | null, form: FormData): Promise<{ error?: string; codes?: string[] } | null> {
  const me = await getCurrentUser();
  if (!me || !isStaff(me.role)) return { error: "Sesión expirada." };
  if (!rateLimit(`staff-regen:${me.id}`, 5, 15 * 60_000).ok) return { error: "Demasiados intentos." };
  const user = await db.user.findUniqueOrThrow({ where: { id: me.id } });
  const secret = user.totpSecret ? openText(user.totpSecret, "totp:v1") : null;
  const r = secret ? verifyTotp(secret, String(form.get("code") ?? "").replace(/\s/g, ""), user.totpLastStep) : { ok: false as const };
  if (!r.ok) return { error: "Código incorrecto o ya usado." };
  const codes = generateRecoveryCodes();
  await db.user.update({ where: { id: me.id }, data: { recoveryCodes: codes.map(recoveryHash), totpLastStep: r.step } });
  await audit({ actorId: me.id, action: "auth.staff_recovery_regenerated", entity: "User", entityId: me.id });
  void notifyStaffSecurity(me.id, "recovery_regenerated", { userAgent: (await headers()).get("user-agent") }).catch(() => {});
  revalidatePath("/admin/seguridad");
  return { codes };
}

/**
 * Panel → Mi seguridad: cambiar la contraseña del equipo. Exige la contraseña actual y un código actual
 * de la app de autenticación; cierra las demás sesiones y avisa por correo.
 */
export async function staffChangePasswordAction(_: { error?: string; ok?: string } | null, form: FormData): Promise<{ error?: string; ok?: string } | null> {
  const me = await getCurrentUser();
  if (!me || !isStaff(me.role) || !me.totpEnabledAt) return { error: "Sesión expirada." };
  if (!rateLimit(`staff-pw:${me.id}`, 5, 15 * 60_000).ok) return { error: "Demasiados intentos. Espera unos minutos." };
  const next = passwordSchema.safeParse(form.get("next"));
  if (!next.success) return { error: next.error.issues[0]?.message ?? "Contraseña no válida." };
  if (form.get("next") !== form.get("confirm")) return { error: "Las contraseñas nuevas no coinciden." };

  const user = await db.user.findUniqueOrThrow({ where: { id: me.id } });
  if (!(await verifyPassword(String(form.get("current") ?? ""), user.passwordHash))) {
    await audit({ actorId: me.id, action: "auth.staff_password_failed", entity: "User", entityId: me.id });
    return { error: "La contraseña actual o el código no son correctos." };
  }
  const secret = user.totpSecret ? openText(user.totpSecret, "totp:v1") : null;
  const r = secret ? verifyTotp(secret, String(form.get("code") ?? "").replace(/\s/g, ""), user.totpLastStep) : { ok: false as const };
  if (!r.ok) return { error: "La contraseña actual o el código no son correctos." };
  if (await verifyPassword(next.data, user.passwordHash)) return { error: "La nueva contraseña debe ser distinta de la actual." };

  await db.user.update({ where: { id: me.id }, data: { passwordHash: await hashPassword(next.data), hasPassword: true, totpLastStep: r.step } });
  const ua = (await headers()).get("user-agent");
  await db.session.deleteMany({ where: { userId: me.id } });
  await createSession(me.id, ua, STAFF_SESSION_TTL_MS);
  await audit({ actorId: me.id, action: "auth.staff_password_changed", entity: "User", entityId: me.id });
  void notifyStaffSecurity(me.id, "password_changed", { userAgent: ua }).catch(() => {});
  revalidatePath("/admin/seguridad");
  return { ok: "Contraseña actualizada. Se cerraron las demás sesiones." };
}
