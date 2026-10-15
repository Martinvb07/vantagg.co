import "server-only";
import { createHmac } from "node:crypto";
import { cookies } from "next/headers";
import { hmacSha256Hex, safeEqual } from "@/lib/crypto";
import { env, getAuthSecret } from "@/lib/env";

/**
 * Panel oculto + 2FA del equipo.
 *  - La cookie «vx_gate» la deja el middleware al entrar por la dirección secreta (ADMIN_PATH).
 *  - El «ticket» de 2FA es una cookie firmada de 10 min entre la contraseña y el código.
 */
export const GATE_COOKIE = "vx_gate";
export const MFA_COOKIE = "vx_mfa";
const MFA_TTL_MS = 10 * 60_000;

/** Dirección de entrada al panel (con destino opcional dentro de /admin). */
export function adminEntry(next?: string) {
  const path = `/${env.adminPath}`;
  return next && next.startsWith("/admin") ? `${path}?next=${encodeURIComponent(next)}` : path;
}

export const adminEntryUrl = (next?: string) => `${env.appUrl}${adminEntry(next)}`;

/** Misma firma que el middleware (HMAC-SHA256 en base64url). */
function gateSig(exp: string) {
  return createHmac("sha256", getAuthSecret()).update(`gate:${exp}`).digest("base64url");
}

export async function hasGate() {
  const v = (await cookies()).get(GATE_COOKIE)?.value;
  if (!v || !env.adminPath) return false;
  const [exp, sig] = v.split(".");
  return !!exp && !!sig && Number(exp) > Date.now() / 1000 && safeEqual(sig, gateSig(exp));
}

// --- Ticket entre contraseña y código 2FA ---------------------------------
/** "pending": contraseña correcta, falta el código. "enrolled": 2FA recién activado, falta ver los códigos de recuperación. */
export type MfaStage = "pending" | "enrolled";
const ticketSig = (payload: string) => hmacSha256Hex(getAuthSecret(), `mfa:${payload}`);

export async function setMfaTicket(userId: string, stage: MfaStage = "pending") {
  const payload = `${userId}.${Date.now() + MFA_TTL_MS}.${stage}`;
  (await cookies()).set(MFA_COOKIE, `${payload}.${ticketSig(payload)}`, { httpOnly: true, secure: env.appUrl.startsWith("https://"), sameSite: "strict", path: "/", maxAge: MFA_TTL_MS / 1000 });
}

export async function readMfaTicket(stage: MfaStage = "pending"): Promise<string | null> {
  const v = (await cookies()).get(MFA_COOKIE)?.value;
  if (!v) return null;
  const [userId, exp, st, sig] = v.split(".");
  if (!userId || !exp || st !== stage || !sig || Number(exp) < Date.now() || !safeEqual(sig, ticketSig(`${userId}.${exp}.${st}`))) return null;
  return userId;
}

export async function clearMfaTicket() {
  (await cookies()).set(MFA_COOKIE, "", { path: "/", maxAge: 0 });
}
