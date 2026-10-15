import "server-only";
import { randomInt, timingSafeEqual } from "node:crypto";
import type { EmailCodePurpose } from "@prisma/client";
import { db } from "@/lib/db";
import { hmacSha256Hex } from "@/lib/crypto";
import { getAuthSecret, isProduction } from "@/lib/env";
import { codeEmail } from "./email-templates";
import { getBrand, sendEmail } from "./notifications";

/**
 * Códigos de 6 dígitos por correo para ingresar sin contraseña o verificar el correo.
 * Seguridad: solo se guarda el HMAC, vencen en 10 min, máximo 5 intentos por código,
 * un código vigente a la vez y un minuto de espera entre envíos.
 */
export const CODE_TTL_MIN = 10;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60_000;

const hashCode = (email: string, purpose: EmailCodePurpose, code: string) => hmacSha256Hex(getAuthSecret(), `code:${purpose}:${email}:${code}`);

export type IssueResult = { ok: true } | { ok: false; reason: "cooldown"; retryInSec: number };

export async function issueEmailCode(email: string, purpose: EmailCodePurpose): Promise<IssueResult> {
  const last = await db.emailCode.findFirst({ where: { email, purpose }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
  if (last && Date.now() - last.createdAt.getTime() < RESEND_COOLDOWN_MS) {
    return { ok: false, reason: "cooldown", retryInSec: Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - last.createdAt.getTime())) / 1000) };
  }
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await db.$transaction([
    db.emailCode.deleteMany({ where: { email, purpose, consumedAt: null } }),
    db.emailCode.create({ data: { email, purpose, codeHash: hashCode(email, purpose, code), expiresAt: new Date(Date.now() + CODE_TTL_MIN * 60_000) } }),
  ]);
  const r = await sendEmail(email, purpose === "LOGIN" ? "login_code" : "verify_code", codeEmail(await getBrand(), { code, purpose, minutes: CODE_TTL_MIN }));
  // Solo en desarrollo y sin correo configurado: el código queda en la consola para poder probar.
  if (r.status !== "SENT" && !isProduction) console.info(`[dev] Código ${purpose} para ${email}: ${code}`);
  return { ok: true };
}

export type VerifyResult = { ok: true } | { ok: false; error: string };

export async function verifyEmailCode(email: string, purpose: EmailCodePurpose, code: string): Promise<VerifyResult> {
  if (!/^\d{6}$/.test(code)) return { ok: false, error: "El código tiene 6 números." };
  const row = await db.emailCode.findFirst({ where: { email, purpose, consumedAt: null }, orderBy: { createdAt: "desc" } });
  if (!row || row.expiresAt < new Date()) return { ok: false, error: "El código venció. Pide uno nuevo." };
  if (row.attempts >= MAX_ATTEMPTS) return { ok: false, error: "Demasiados intentos con este código. Pide uno nuevo." };

  const expected = Buffer.from(row.codeHash, "utf8");
  const given = Buffer.from(hashCode(email, purpose, code), "utf8");
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    await db.emailCode.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
    const left = MAX_ATTEMPTS - row.attempts - 1;
    return { ok: false, error: left > 0 ? `Código incorrecto. Te quedan ${left} intento(s).` : "Código incorrecto. Pide uno nuevo." };
  }
  // Uso único y atómico.
  const used = await db.emailCode.updateMany({ where: { id: row.id, consumedAt: null }, data: { consumedAt: new Date() } });
  return used.count === 1 ? { ok: true } : { ok: false, error: "Este código ya se usó. Pide uno nuevo." };
}

/**
 * Con el correo ya verificado, las compras hechas como invitado con ese correo
 * pasan a la cuenta. (Sin verificación no se vincula: cualquiera podría registrar un correo ajeno.)
 */
export async function linkGuestOrders(userId: string, email: string) {
  const r = await db.order.updateMany({ where: { customerEmail: email, userId: null }, data: { userId } });
  return r.count;
}
