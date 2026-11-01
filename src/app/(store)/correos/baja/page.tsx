import type { Metadata } from "next";
import { MailX } from "lucide-react";
import { Container } from "@/components/ui/primitives";
import { db } from "@/lib/db";
import { validUnsubscribe } from "@/server/marketing";
import { UnsubscribeForm } from "./unsubscribe-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Darte de baja de las ofertas", robots: { index: false, follow: false } };

/** Correo con la mitad oculta: «ju***@gmail.com». */
const mask = (email: string) => email.replace(/^(.{2})[^@]*(@.*)$/, "$1***$2");

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ u?: string; c?: string; t?: string }> }) {
  const { u = "", c = "", t = "" } = await searchParams;
  // Cuenta registrada (?u=) o contacto sin cuenta que aceptó al pagar (?c=).
  const who = c ? "c" : "u";
  const id = c || u;
  const user = !validUnsubscribe(id, t, who)
    ? null
    : who === "u"
      ? await db.user.findUnique({ where: { id }, select: { email: true, marketingOptIn: true } })
      : await db.emailContact.findUnique({ where: { id }, select: { email: true, optIn: true } }).then((x) => x && { email: x.email, marketingOptIn: x.optIn });
  return (
    <Container className="max-w-[560px] py-12 sm:py-16">
      <div className="rounded-[20px] bg-ink-850 p-6 ring-1 ring-white/[0.08] sm:p-8">
        <span className="grid size-12 place-items-center rounded-2xl bg-white/[0.06] text-fg-muted">
          <MailX className="size-6" />
        </span>
        <h1 className="mt-4 text-[24px] font-bold tracking-tight">Ofertas por correo</h1>
        {user ? (
          <>
            <p className="mt-2 text-[15px] text-fg-muted">
              {user.marketingOptIn ? (
                <>
                  Te enviamos ofertas a <span className="text-fg">{mask(user.email)}</span>. Si no quieres recibirlas más, confirma aquí. Los correos de tus pedidos te seguirán llegando.
                </>
              ) : (
                <>
                  <span className="text-fg">{mask(user.email)}</span> no recibe ofertas. Si cambiaste de opinión, puedes volver a recibirlas.
                </>
              )}
            </p>
            <UnsubscribeForm id={id} who={who} t={t} optedIn={user.marketingOptIn} />
          </>
        ) : (
          <p className="mt-2 text-[15px] text-fg-muted">
            El enlace no es válido o está incompleto. También puedes cambiar esta opción en <a href="/cuenta?seccion=perfil" className="text-volt-300 underline underline-offset-2">Mi cuenta → Perfil</a>.
          </p>
        )}
      </div>
    </Container>
  );
}
