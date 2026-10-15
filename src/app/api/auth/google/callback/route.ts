import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { audit } from "@/lib/audit";
import { createSession, isStaff } from "@/lib/auth";
import { safeEqual, randomToken } from "@/lib/crypto";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { linkGuestOrders } from "@/server/email-codes";
import { welcomeEmail } from "@/server/email-templates";
import { finishFlow, OAUTH_COOKIE, openFlow, type GoogleProfile } from "@/server/google-oauth";
import { getBrand, sendEmail } from "@/server/notifications";

export const dynamic = "force-dynamic";

/** Regreso desde Google: valida el intento, identifica o crea la cuenta e inicia sesión. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const jar = await cookies();
  const flow = openFlow(jar.get(OAUTH_COOKIE)?.value);
  jar.set(OAUTH_COOKIE, "", { path: "/api/auth/google", maxAge: 0 });

  if (url.searchParams.get("error")) redirect("/ingresar?error=google_cancelado");
  const state = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code") ?? "";
  if (!flow || !state || !code || !safeEqual(state, flow.state)) redirect("/ingresar?error=google_vencido");

  let profile: GoogleProfile;
  try {
    profile = await finishFlow(code, flow);
  } catch (err) {
    console.warn("[google] inicio de sesión rechazado:", (err as Error).message);
    redirect("/ingresar?error=google_error");
  }

  const bySub = await db.user.findUnique({ where: { googleSub: profile.sub } });
  const user = bySub ?? (await db.user.findUnique({ where: { email: profile.email } }));
  if (user && isStaff(user.role)) redirect("/ingresar?error=google_equipo");
  if (user?.disabled) redirect("/ingresar?error=deshabilitada");

  let userId: string;
  if (user) {
    userId = user.id;
    // Google confirmó que el correo es de esta persona: se vincula y queda verificado.
    await db.user.update({
      where: { id: user.id },
      data: { googleSub: profile.sub, emailVerifiedAt: user.emailVerifiedAt ?? new Date(), ...(user.name ? {} : { name: profile.name }) },
    });
    await audit({ actorId: user.id, action: bySub ? "auth.login_google" : "auth.google_linked", entity: "User", entityId: user.id });
  } else {
    const created = await db.user.create({
      data: { email: profile.email, name: profile.name, googleSub: profile.sub, emailVerifiedAt: new Date(), hasPassword: false, passwordHash: await hashPassword(randomToken(32)), role: "CUSTOMER" },
    });
    userId = created.id;
    await audit({ actorId: created.id, action: "auth.register_google", entity: "User", entityId: created.id });
    void (async () => sendEmail(profile.email, "welcome", welcomeEmail(await getBrand(), { name: profile.name })))();
  }

  await linkGuestOrders(userId, profile.email);
  await createSession(userId, (await headers()).get("user-agent"));
  redirect(flow.next);
}
