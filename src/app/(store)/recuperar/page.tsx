import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/primitives";
import { RequestResetForm } from "./reset-forms";

export const metadata: Metadata = { title: "Recuperar contraseña", robots: { index: false, follow: false } };

export default function RecoverPage() {
  return (
    <Container className="grid min-h-[70vh] place-items-center py-12">
      <div className="w-full max-w-[400px]">
        <h1 className="font-display text-3xl font-semibold">Recuperar contraseña</h1>
        <p className="mt-2 text-sm text-fg-muted">Escribe el correo de tu cuenta y te enviamos un enlace para crear una nueva contraseña.</p>
        <div className="surface mt-6 p-6">
          <RequestResetForm />
        </div>
        <p className="mt-5 text-center text-sm text-fg-muted">
          ¿La recordaste?{" "}
          <Link href="/ingresar" className="text-fg underline underline-offset-4">
            Ingresar
          </Link>
        </p>
      </div>
    </Container>
  );
}
