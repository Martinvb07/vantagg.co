import type { Metadata } from "next";
import Link from "next/link";
import { Alert, Container } from "@/components/ui/primitives";
import { isResetTokenValid } from "@/server/password-reset";
import { NewPasswordForm } from "../reset-forms";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Nueva contraseña", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function NewPasswordPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  const valid = await isResetTokenValid(t);
  return (
    <Container className="grid min-h-[70vh] place-items-center py-12">
      <div className="w-full max-w-[400px]">
        <h1 className="font-display text-3xl font-semibold">Nueva contraseña</h1>
        {valid ? (
          <>
            <p className="mt-2 text-sm text-fg-muted">Al guardarla se cierran todas las sesiones abiertas de tu cuenta.</p>
            <div className="surface mt-6 p-6">
              <NewPasswordForm token={t!} />
            </div>
          </>
        ) : (
          <div className="mt-6 space-y-4">
            <Alert tone="warning" title="Este enlace ya no sirve">
              Venció (dura 30 minutos) o ya se usó.
            </Alert>
            <Link href="/recuperar" className="inline-flex h-11 w-full items-center justify-center rounded-[10px] bg-volt-400 text-[15px] font-semibold text-volt-ink hover:bg-volt-300">
              Pedir un enlace nuevo
            </Link>
          </div>
        )}
      </div>
    </Container>
  );
}
