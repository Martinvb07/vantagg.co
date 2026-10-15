import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isProduction } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { clientIpHash } from "@/lib/request";
import { safeNext } from "@/lib/safe-next";
import { googleEnabled, OAUTH_COOKIE, startFlow } from "@/server/google-oauth";

export const dynamic = "force-dynamic";

/** Inicia «Continuar con Google»: guarda el intento en una cookie firmada y redirige a Google. */
export async function GET(req: Request) {
  if (!googleEnabled()) redirect("/ingresar?error=google_off");
  if (!rateLimit(`google:${await clientIpHash()}`, 20, 10 * 60_000).ok) redirect("/ingresar?error=demasiados");
  const next = safeNext(new URL(req.url).searchParams.get("next"), "/cuenta");
  const { url, cookie } = startFlow(next);
  (await cookies()).set(OAUTH_COOKIE, cookie, { httpOnly: true, secure: isProduction, sameSite: "lax", path: "/api/auth/google", maxAge: 600 });
  redirect(url);
}
