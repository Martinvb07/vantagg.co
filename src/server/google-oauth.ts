import "server-only";
import { createHash } from "node:crypto";
import { hmacSha256Hex, randomToken, safeEqual } from "@/lib/crypto";
import { env, getAuthSecret } from "@/lib/env";

/**
 * Inicio de sesión con Google (OAuth 2.0 + OpenID Connect, flujo "authorization code" con PKCE).
 *  - `state` contra CSRF, `nonce` contra repetición del token, PKCE contra robo del código.
 *  - El token de identidad llega directo de Google por TLS (servidor a servidor) y además
 *    se validan emisor, audiencia, vencimiento, nonce y correo verificado.
 */
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
export const OAUTH_COOKIE = "vx_oauth";
const TTL_MS = 10 * 60_000;

export const googleEnabled = () => !!env.google.clientId && !!env.google.clientSecret;
export const googleMissingConfig = () => [!env.google.clientId && "GOOGLE_CLIENT_ID", !env.google.clientSecret && "GOOGLE_CLIENT_SECRET"].filter(Boolean) as string[];
export const googleRedirectUri = () => `${env.appUrl}/api/auth/google/callback`;

type Flow = { state: string; verifier: string; nonce: string; next: string; exp: number };

const sign = (payload: string) => hmacSha256Hex(getAuthSecret(), `oauth:${payload}`);

/** Cookie firmada con los datos del intento en curso (no se puede alterar desde el navegador). */
export function sealFlow(f: Flow): string {
  const payload = Buffer.from(JSON.stringify(f)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function openFlow(value: string | undefined): Flow | null {
  if (!value) return null;
  const [payload, mac] = value.split(".");
  if (!payload || !mac || !safeEqual(mac, sign(payload))) return null;
  try {
    const f = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Flow;
    return f.exp > Date.now() ? f : null;
  } catch {
    return null;
  }
}

export function startFlow(next: string): { url: string; cookie: string } {
  const flow: Flow = { state: randomToken(24), verifier: randomToken(48), nonce: randomToken(24), next, exp: Date.now() + TTL_MS };
  const challenge = createHash("sha256").update(flow.verifier).digest("base64url");
  const params = new URLSearchParams({
    client_id: env.google.clientId!,
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state: flow.state,
    nonce: flow.nonce,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
    access_type: "online",
  });
  return { url: `${AUTH_URL}?${params}`, cookie: sealFlow(flow) };
}

export type GoogleProfile = { sub: string; email: string; name: string | null };

/** Valida los datos del token de identidad. Exportada para pruebas. */
export function checkIdClaims(claims: Record<string, unknown>, nonce: string, now = Date.now()): GoogleProfile {
  if (!ISSUERS.includes(String(claims.iss))) throw new Error("Emisor inválido");
  const aud = claims.aud;
  if (!(aud === env.google.clientId || (Array.isArray(aud) && aud.includes(env.google.clientId)))) throw new Error("Audiencia inválida");
  if (typeof claims.exp !== "number" || claims.exp * 1000 < now - 60_000) throw new Error("Token vencido");
  if (typeof claims.nonce !== "string" || !safeEqual(claims.nonce, nonce)) throw new Error("Nonce inválido");
  if (claims.email_verified !== true || typeof claims.email !== "string") throw new Error("Correo no verificado en Google");
  if (typeof claims.sub !== "string" || !claims.sub) throw new Error("Usuario inválido");
  return { sub: claims.sub, email: claims.email.trim().toLowerCase(), name: typeof claims.name === "string" ? claims.name.slice(0, 80) : null };
}

export async function finishFlow(code: string, flow: Flow): Promise<GoogleProfile> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.google.clientId!,
      client_secret: env.google.clientSecret!,
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code",
      code_verifier: flow.verifier,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Google respondió HTTP ${res.status}`);
  const tokens = (await res.json()) as { id_token?: string };
  const parts = tokens.id_token?.split(".");
  if (!parts || parts.length !== 3) throw new Error("Respuesta de Google sin token de identidad");
  const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as Record<string, unknown>;
  return checkIdClaims(claims, flow.nonce);
}
