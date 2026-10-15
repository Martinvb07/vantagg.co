import "server-only";
import { db } from "@/lib/db";
import { hmacSha256Hex } from "@/lib/crypto";
import { getAuthSecret } from "@/lib/env";

export const RESET_TTL_MS = 30 * 60_000;

/** Solo se guarda el HMAC del token: con la base de datos no se puede reconstruir el enlace. */
export const resetHash = (token: string) => hmacSha256Hex(getAuthSecret(), `reset:${token}`);

/** ¿El enlace sigue sirviendo? (para mostrar el formulario o el aviso de vencido). */
export async function isResetTokenValid(token: string | undefined) {
  if (!token || token.length > 100) return false;
  const row = await db.passwordReset.findUnique({ where: { tokenHash: resetHash(token) }, select: { usedAt: true, expiresAt: true } });
  return !!row && !row.usedAt && row.expiresAt > new Date();
}
