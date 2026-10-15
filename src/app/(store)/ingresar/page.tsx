import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthDivider, GoogleButton } from "@/components/auth/google-button";
import { Alert, Container } from "@/components/ui/primitives";
import { getCurrentUser } from "@/lib/auth";
import { googleEnabled } from "@/server/google-oauth";
import { LoginPanel } from "./login-panel";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ingresar", robots: { index: false, follow: false } };

const ERRORS: Record<string, string> = {
  google_off: "El ingreso con Google no está disponible por ahora. Usa un código por correo.",
  google_cancelado: "Cancelaste el ingreso con Google.",
  google_vencido: "El intento de ingreso venció o no es válido. Inténtalo de nuevo.",
  google_error: "No pudimos confirmar tu cuenta de Google. Inténtalo de nuevo o usa un código por correo.",
  google_equipo: "Las cuentas del equipo ingresan con contraseña.",
  deshabilitada: "Esta cuenta está deshabilitada. Escríbenos desde el Centro de ayuda.",
  demasiados: "Demasiados intentos. Espera unos minutos.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; restablecida?: string; error?: string }> }) {
  const { next, restablecida, error } = await searchParams;
  if (await getCurrentUser()) redirect("/cuenta");
  const google = googleEnabled();
  return (
    <Container className="grid min-h-[70vh] place-items-center py-12">
      <div className="w-full max-w-[420px]">
        <h1 className="font-display text-3xl font-semibold">Ingresar</h1>
        <p className="mt-2 text-sm text-fg-muted">
          Ve tus compras y entregas en un solo lugar. ¿Solo quieres comprar? No necesitas cuenta:{" "}
          <Link href="/recargas" className="text-volt-300 underline underline-offset-4">
            compra como invitado
          </Link>
          .
        </p>
        {restablecida && (
          <Alert tone="success" className="mt-6">
            Contraseña actualizada. Ingresa con la nueva.
          </Alert>
        )}
        {error && ERRORS[error] && (
          <Alert tone="warning" className="mt-6">
            {ERRORS[error]}
          </Alert>
        )}
        <div className="surface mt-6 p-6">
          {google && (
            <>
              <GoogleButton next={next} />
              <AuthDivider />
            </>
          )}
          <LoginPanel next={next} />
          <p className="mt-4 text-center text-[13px]">
            <Link href="/recuperar" className="text-fg-muted underline-offset-4 hover:text-fg hover:underline">
              ¿Olvidaste tu contraseña?
            </Link>
          </p>
        </div>
        <p className="mt-5 text-center text-sm text-fg-muted">
          ¿No tienes cuenta?{" "}
          <Link href={`/registro${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="text-fg underline underline-offset-4">
            Crear una
          </Link>
        </p>
      </div>
    </Container>
  );
}
