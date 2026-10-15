import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Container } from "@/components/ui/primitives";
import { getCurrentUser } from "@/lib/auth";
import { AuthForm } from "../ingresar/auth-form";
import { AuthDivider, GoogleButton } from "@/components/auth/google-button";
import { googleEnabled } from "@/server/google-oauth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Crear cuenta", robots: { index: false, follow: false } };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await getCurrentUser()) redirect("/cuenta");
  return (
    <Container className="grid min-h-[70vh] place-items-center py-12">
      <div className="w-full max-w-[400px]">
        <h1 className="font-display text-3xl font-semibold">Crear cuenta</h1>
        <p className="mt-2 text-sm text-fg-muted">Opcional. Tus compras quedan en tu historial y, al verificar tu correo, también las que hiciste como invitado.</p>
        <div className="surface mt-6 p-6">
          {googleEnabled() && (
            <>
              <GoogleButton next={next} label="Registrarme con Google" />
              <AuthDivider />
            </>
          )}
          <AuthForm mode="register" next={next} />
          <p className="mt-4 text-center text-[12.5px] text-fg-subtle">
            ¿Prefieres sin contraseña?{" "}
            <Link href={`/ingresar${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="text-fg-muted underline underline-offset-4 hover:text-fg">
              Entra con un código por correo
            </Link>
          </p>
        </div>
        <p className="mt-5 text-center text-sm text-fg-muted">
          ¿Ya tienes cuenta?{" "}
          <Link href="/ingresar" className="text-fg underline underline-offset-4">
            Ingresar
          </Link>
        </p>
      </div>
    </Container>
  );
}
