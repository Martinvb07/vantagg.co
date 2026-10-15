"use client";

import { useActionState } from "react";
import { MailWarning } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/primitives";
import { resendVerifyCodeAction, verifyEmailAction } from "@/app/actions/auth";

/** Aviso para verificar el correo con el código de 6 dígitos que enviamos al registrarse. */
export function VerifyEmail({ email }: { email: string }) {
  const [state, verify, verifying] = useActionState(verifyEmailAction, null);
  const [resent, resend, resending] = useActionState(resendVerifyCodeAction, null);
  return (
    <section className="mt-6 rounded-[16px] bg-warn-400/[0.06] p-5 ring-1 ring-warn-400/25" aria-labelledby="verificar">
      <div className="flex gap-3">
        <MailWarning className="mt-0.5 size-5 shrink-0 text-warn-400" />
        <div className="min-w-0 flex-1">
          <h2 id="verificar" className="text-[15px] font-semibold">
            Verifica tu correo
          </h2>
          <p className="mt-1 text-[13px] leading-relaxed text-fg-muted">
            Enviamos un código de 6 dígitos a <strong className="text-fg">{email}</strong>. Al verificarlo agregamos a tu cuenta las compras que hiciste como invitado con este correo.
          </p>
          <form action={verify} className="mt-3 flex flex-wrap gap-2">
            <input
              name="code"
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              placeholder="000000"
              aria-label="Código de verificación"
              className="field h-11 w-40 text-center font-mono text-[18px] font-bold tracking-[0.35em]"
            />
            <Button type="submit" loading={verifying}>
              Verificar
            </Button>
          </form>
          <form action={resend} className="mt-2">
            <button type="submit" disabled={resending} className="text-[12.5px] text-fg-muted underline-offset-4 hover:text-fg hover:underline">
              Enviar otro código
            </button>
          </form>
          {state?.error && <Alert tone="danger" className="mt-3">{state.error}</Alert>}
          {state?.ok && <Alert tone="success" className="mt-3">{state.ok}</Alert>}
          {resent?.error && <Alert tone="danger" className="mt-3">{resent.error}</Alert>}
          {resent?.ok && <Alert tone="success" className="mt-3">{resent.ok}</Alert>}
        </div>
      </div>
    </section>
  );
}
