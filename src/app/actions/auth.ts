"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { createSession, destroySession, getCurrentUser, isStaff } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";
import { safeNext } from "@/lib/safe-next";
import { emailSchema, firstError, loginSchema, passwordSchema, registerSchema } from "@/lib/validation";
import { randomToken } from "@/lib/crypto";
import { env, isProduction } from "@/lib/env";
import { RESET_TTL_MS, resetHash } from "@/server/password-reset";
import { CODE_TTL_MIN, issueEmailCode, linkGuestOrders, verifyEmailCode } from "@/server/email-codes";
import { passwordResetEmail, welcomeEmail } from "@/server/email-templates";
import { getBrand, sendEmail, notifyPasswordChanged } from "@/server/notifications";
import { caughtByHoneypot } from "@/lib/honeypot";

type FormState = { error?: string; ok?: string } | null;
export type CodeState = { error?: string; ok?: string; email?: string } | null;

// Hash ficticio para igualar tiempos cuando el usuario no existe.
const DUMMY_HASH = "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$" + "A".repeat(86) + "==";

const userAgent = async () => (await headers()).get("user-agent");

async function sendWelcome(email: string, name: string | null) {
  await sendEmail(email, "welcome", welcomeEmail(await getBrand(), { name }));
}

// ---------------------------------------------------------------------
// Contraseña
// ---------------------------------------------------------------------

export async function loginAction(_: FormState, form: FormData): Promise<FormState> {
  const ip = await clientIp();
  const parsed = loginSchema.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const byIp = rateLimit(`login-ip:${ip}`, 20, 15 * 60_000);
  const byEmail = rateLimit(`login-email:${parsed.data.email}`, 8, 15 * 60_000);
  if (!byIp.ok || !byEmail.ok) return { error: "Demasiados intentos. Espera unos minutos antes de volver a intentar." };

  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  const valid = await verifyPassword(parsed.data.password, user?.passwordHash ?? DUMMY_HASH);
  // El equipo ingresa solo por la dirección secreta del panel (con 2FA). Aquí se ve como un error común.
  if (!user || !valid || user.disabled || !user.hasPassword || isStaff(user.role)) {
    if (user) await audit({ actorId: user.id, action: "auth.login_failed", entity: "User", entityId: user.id });
    return { error: "Correo o contraseña incorrectos." };
  }
  await createSession(user.id, await userAgent());
  if (user.emailVerifiedAt) await linkGuestOrders(user.id, user.email);
  await audit({ actorId: user.id, action: "auth.login", entity: "User", entityId: user.id });
  redirect(safeNext(form.get("next"), "/cuenta"));
}

export async function registerAction(_: FormState, form: FormData): Promise<FormState> {
  if (caughtByHoneypot(form)) return { error: "No pudimos crear la cuenta. Intenta de nuevo." };
  const ip = await clientIp();
  if (!rateLimit(`register:${ip}`, 5, 60 * 60_000).ok) return { error: "Demasiados registros desde esta conexión. Intenta más tarde." };
  const parsed = registerSchema.safeParse({ name: form.get("name"), email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: firstError(parsed.error) };
  if (form.get("accept") !== "on") return { error: "Debes aceptar la política de privacidad." };

  const exists = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (exists) return { error: "Ya existe una cuenta con ese correo. Inicia sesión o entra con un código." };

  const user = await db.user.create({
    data: { name: parsed.data.name, email: parsed.data.email, passwordHash: await hashPassword(parsed.data.password), role: "CUSTOMER" },
  });
  await createSession(user.id, await userAgent());
  await audit({ actorId: user.id, action: "auth.register", entity: "User", entityId: user.id });
  // Las compras previas como invitado se vinculan cuando se verifique el correo.
  await issueEmailCode(user.email, "VERIFY");
  redirect(safeNext(form.get("next"), "/cuenta"));
}

export async function logoutAction() {
  await destroySession();
  redirect("/");
}

/** Cambia la contraseña; si la cuenta entró con Google o código y no tiene, la crea sin pedir la actual. */
export async function changePasswordAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sesión expirada." };
  if (!rateLimit(`pwchange:${user.id}`, 5, 15 * 60_000).ok) return { error: "Demasiados intentos." };
  const next = passwordSchema.safeParse(form.get("next"));
  if (!next.success) return { error: firstError(next.error) };
  const row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  if (row.hasPassword && !(await verifyPassword(String(form.get("current") ?? ""), row.passwordHash))) return { error: "La contraseña actual no es correcta." };
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next.data), hasPassword: true } });
  void notifyPasswordChanged(user.id, "perfil").catch(() => {});
  // Cierra las demás sesiones.
  await db.session.deleteMany({ where: { userId: user.id } });
  await createSession(user.id, await userAgent());
  await audit({ actorId: user.id, action: row.hasPassword ? "auth.password_changed" : "auth.password_created", entity: "User", entityId: user.id });
  revalidatePath("/cuenta");
  return { ok: row.hasPassword ? "Contraseña actualizada. Se cerraron las otras sesiones." : "Contraseña creada. Ya puedes ingresar también con ella." };
}

// ---------------------------------------------------------------------
// Código por correo (ingresar sin contraseña; crea la cuenta si no existe)
// ---------------------------------------------------------------------

export async function sendLoginCodeAction(_: CodeState, form: FormData): Promise<CodeState> {
  if (caughtByHoneypot(form)) return { error: "No pudimos enviar el código. Intenta de nuevo." };
  const ip = await clientIp();
  const parsed = emailSchema.safeParse(form.get("email"));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const email = parsed.data;
  if (!rateLimit(`code-ip:${ip}`, 10, 60 * 60_000).ok || !rateLimit(`code-email:${email}`, 5, 60 * 60_000).ok) {
    return { error: "Demasiados códigos solicitados. Intenta de nuevo en una hora.", email };
  }
  const user = await db.user.findUnique({ where: { email }, select: { role: true, disabled: true } });
  // El equipo ingresa solo con contraseña; a cuentas deshabilitadas no se envía nada. La respuesta es la misma.
  if (!user || (!user.disabled && !isStaff(user.role))) {
    const r = await issueEmailCode(email, "LOGIN");
    if (!r.ok) return { error: `Espera ${r.retryInSec} s para pedir otro código.`, email };
  }
  return { ok: `Te enviamos un código de 6 dígitos a ${email}. Vence en ${CODE_TTL_MIN} minutos; revisa también spam.`, email };
}

export async function verifyLoginCodeAction(_: CodeState, form: FormData): Promise<CodeState> {
  const ip = await clientIp();
  const parsed = emailSchema.safeParse(form.get("email"));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const email = parsed.data;
  if (!rateLimit(`code-verify:${ip}`, 25, 15 * 60_000).ok) return { error: "Demasiados intentos. Espera unos minutos.", email };

  const user = await db.user.findUnique({ where: { email } });
  if (user && (user.disabled || isStaff(user.role))) return { error: user.disabled ? "Esta cuenta está deshabilitada." : "Las cuentas del equipo ingresan con contraseña.", email };

  const check = await verifyEmailCode(email, "LOGIN", String(form.get("code") ?? "").replace(/\D/g, ""));
  if (!check.ok) return { error: check.error, email };

  let userId: string;
  if (user) {
    userId = user.id;
    if (!user.emailVerifiedAt) await db.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
    await audit({ actorId: user.id, action: "auth.login_code", entity: "User", entityId: user.id });
  } else {
    const created = await db.user.create({
      data: { email, passwordHash: await hashPassword(randomToken(32)), hasPassword: false, emailVerifiedAt: new Date(), role: "CUSTOMER" },
    });
    userId = created.id;
    await audit({ actorId: created.id, action: "auth.register_code", entity: "User", entityId: created.id });
    void sendWelcome(email, null);
  }
  await linkGuestOrders(userId, email);
  await createSession(userId, await userAgent());
  redirect(safeNext(form.get("next"), "/cuenta"));
}

// ---------------------------------------------------------------------
// Verificación del correo (cuentas creadas con contraseña)
// ---------------------------------------------------------------------

export async function resendVerifyCodeAction(_: FormState): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sesión expirada." };
  if (!rateLimit(`verify-send:${user.id}`, 5, 60 * 60_000).ok) return { error: "Demasiados envíos. Intenta en una hora." };
  const r = await issueEmailCode(user.email, "VERIFY");
  return r.ok ? { ok: `Enviamos un código nuevo a ${user.email}.` } : { error: `Espera ${r.retryInSec} s para pedir otro código.` };
}

export async function verifyEmailAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sesión expirada." };
  if (!rateLimit(`verify-try:${user.id}`, 15, 15 * 60_000).ok) return { error: "Demasiados intentos. Espera unos minutos." };
  const check = await verifyEmailCode(user.email, "VERIFY", String(form.get("code") ?? "").replace(/\D/g, ""));
  if (!check.ok) return { error: check.error };
  await db.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
  const linked = await linkGuestOrders(user.id, user.email);
  await audit({ actorId: user.id, action: "auth.email_verified", entity: "User", entityId: user.id, data: { linkedOrders: linked } });
  void sendWelcome(user.email, user.name);
  revalidatePath("/cuenta");
  return { ok: linked ? `Correo verificado. Agregamos ${linked} compra(s) anterior(es) a tu cuenta.` : "Correo verificado." };
}

// ---------------------------------------------------------------------
// Recuperación de contraseña
// ---------------------------------------------------------------------

const RESET_SENT = "Si ese correo tiene una cuenta, te enviamos un enlace para crear una nueva contraseña. Vence en 30 minutos; revisa también spam.";

/** Pide el enlace. La respuesta es siempre la misma para no revelar qué correos tienen cuenta. */
export async function requestPasswordResetAction(_: FormState, form: FormData): Promise<FormState> {
  if (caughtByHoneypot(form)) return { error: "No pudimos procesar la solicitud. Intenta de nuevo." };
  const ip = await clientIp();
  const parsed = emailSchema.safeParse(form.get("email"));
  if (!parsed.success) return { error: firstError(parsed.error) };
  if (!rateLimit(`reset-ip:${ip}`, 6, 60 * 60_000).ok || !rateLimit(`reset-email:${parsed.data}`, 3, 60 * 60_000).ok) {
    return { error: "Demasiadas solicitudes. Intenta de nuevo en una hora." };
  }

  const user = await db.user.findUnique({ where: { email: parsed.data }, select: { id: true, email: true, disabled: true } });
  if (user && !user.disabled) {
    const token = randomToken(32);
    await db.$transaction([
      db.passwordReset.deleteMany({ where: { userId: user.id, usedAt: null } }),
      db.passwordReset.create({ data: { userId: user.id, tokenHash: resetHash(token), expiresAt: new Date(Date.now() + RESET_TTL_MS) } }),
    ]);
    const link = `${env.appUrl}/recuperar/nueva?t=${token}`;
    void (async () => {
      const r = await sendEmail(user.email, "password_reset", passwordResetEmail(await getBrand(), { link, minutes: RESET_TTL_MS / 60_000 }));
      // Solo en desarrollo, sin correo configurado: el enlace queda en la consola para poder probar.
      if (r.status !== "SENT" && !isProduction) console.info(`[dev] Enlace de recuperación: ${link}`);
    })();
    await audit({ actorId: user.id, action: "auth.reset_requested", entity: "User", entityId: user.id });
  }
  return { ok: RESET_SENT };
}

export async function resetPasswordAction(_: FormState, form: FormData): Promise<FormState> {
  const ip = await clientIp();
  if (!rateLimit(`reset-use:${ip}`, 10, 15 * 60_000).ok) return { error: "Demasiados intentos. Espera unos minutos." };
  const token = String(form.get("token") ?? "").slice(0, 100);
  const password = passwordSchema.safeParse(form.get("password"));
  if (!password.success) return { error: firstError(password.error) };
  if (form.get("password") !== form.get("confirm")) return { error: "Las contraseñas no coinciden." };

  const row = await db.passwordReset.findUnique({ where: { tokenHash: resetHash(token) }, include: { user: { select: { email: true, emailVerifiedAt: true } } } });
  if (!row) return { error: "El enlace no es válido. Pide uno nuevo." };
  // Uso único y atómico: dos envíos simultáneos no pueden usar el mismo enlace.
  const claimed = await db.passwordReset.updateMany({ where: { id: row.id, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
  if (claimed.count !== 1) return { error: "El enlace venció o ya se usó. Pide uno nuevo." };

  // El enlace llegó al correo: también prueba que el correo es suyo.
  await db.$transaction([
    db.user.update({ where: { id: row.userId }, data: { passwordHash: await hashPassword(password.data), hasPassword: true, emailVerifiedAt: row.user.emailVerifiedAt ?? new Date() } }),
    db.session.deleteMany({ where: { userId: row.userId } }),
    db.passwordReset.deleteMany({ where: { userId: row.userId, usedAt: null } }),
  ]);
  await linkGuestOrders(row.userId, row.user.email);
  await audit({ actorId: row.userId, action: "auth.password_reset", entity: "User", entityId: row.userId });
  void notifyPasswordChanged(row.userId, "reset").catch(() => {});
  redirect("/ingresar?restablecida=1");
}
