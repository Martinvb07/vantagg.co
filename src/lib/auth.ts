import "server-only";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import type { Role, User } from "@prisma/client";
import { db } from "./db";
import { hmacSha256Hex, randomToken } from "./crypto";
import { getAuthSecret, isProduction } from "./env";
import { clientIpHash } from "./request";

export const SESSION_COOKIE = "vx_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14; // clientes: 14 días
export const STAFF_SESSION_TTL_MS = 1000 * 60 * 60 * 12; // equipo: 12 horas

function tokenHash(token: string) {
  return hmacSha256Hex(getAuthSecret(), token);
}

export async function createSession(userId: string, userAgent?: string | null, ttlMs = SESSION_TTL_MS) {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + ttlMs);
  // Limpieza de sesiones vencidas del usuario.
  await db.session.deleteMany({ where: { userId, expiresAt: { lt: new Date() } } });
  await db.session.create({
    data: {
      tokenHash: tokenHash(token),
      userId,
      expiresAt,
      ipHash: await clientIpHash(),
      userAgent: userAgent?.slice(0, 255) ?? null,
    },
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: tokenHash(token) } });
  jar.delete(SESSION_COOKIE);
}

export type SessionUser = Pick<User, "id" | "email" | "name" | "role" | "avatarUrl" | "avatarPreset" | "totpEnabledAt">;

export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: tokenHash(token) },
    include: { user: { select: { id: true, email: true, name: true, role: true, disabled: true, avatarUrl: true, avatarPreset: true, totpEnabledAt: true } } },
  });
  if (!session || session.expiresAt < new Date() || session.user.disabled) return null;
  const { disabled: _d, ...user } = session.user;
  return user;
});

export function isStaff(role: Role) {
  return role === "ADMIN" || role === "SUPPORT";
}

export async function requireUser(next = "/cuenta"): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/ingresar?next=${encodeURIComponent(next)}`);
  return user;
}

/**
 * Para páginas y acciones del panel. SUPPORT puede ver y operar pedidos; ADMIN todo.
 * Exige sesión del equipo con 2FA. A quien no entró por la dirección secreta se le
 * responde «no encontrado» para no revelar que el panel existe.
 */
export async function requireStaff(roles: Role[] = ["ADMIN", "SUPPORT"]): Promise<SessionUser> {
  const { hasGate } = await import("@/server/admin-gate");
  // Sin la cookie de la entrada secreta el panel no existe, aunque haya sesión del equipo.
  if (!(await hasGate())) notFound();
  const user = await getCurrentUser();
  if (!user || !isStaff(user.role) || !user.totpEnabledAt) redirect("/acceso-equipo?next=%2Fadmin");
  if (!roles.includes(user.role)) redirect("/admin");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  return requireStaff(["ADMIN"]);
}
