"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ArrowLeft, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, Label } from "@/components/ui/primitives";
import { sendLoginCodeAction, verifyLoginCodeAction } from "@/app/actions/auth";

/** Ingresar (o crear la cuenta) con un código de 6 dígitos enviado al correo. */
export function CodeLogin({ next }: { next?: string }) {
  const [sent, send, sending] = useActionState(sendLoginCodeAction, null);
  const [checked, verify, verifying] = useActionState(verifyLoginCodeAction, null);
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [cooldown, setCooldown] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (sent?.ok) {
      setStep("code");
      setCooldown(60);
      setTimeout(() => codeRef.current?.focus(), 50);
    }
  }, [sent]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  if (step === "code") {
    return (
      <div className="space-y-4">
        <div className="flex gap-3 rounded-[12px] bg-volt-400/[0.07] p-3.5 ring-1 ring-volt-400/20">
          <MailCheck className="mt-0.5 size-5 shrink-0 text-volt-300" />
          <p className="text-[13px] leading-relaxed text-fg-muted">{sent?.ok}</p>
        </div>
        <form action={verify} className="space-y-4">
          <input type="hidden" name="email" value={email} />
          {next && <input type="hidden" name="next" value={next} />}
          <div>
            <Label htmlFor="code">Código</Label>
            <input
              ref={codeRef}
              id="code"
              name="code"
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              placeholder="••••••"
              className="field h-14 text-center font-mono text-[26px] font-bold tracking-[0.5em] placeholder:tracking-[0.5em]"
              onChange={(e) => {
                e.target.value = e.target.value.replace(/\D/g, "").slice(0, 6);
              }}
            />
          </div>
          {checked?.error && <Alert tone="danger">{checked.error}</Alert>}
          <Button type="submit" size="lg" className="w-full" loading={verifying}>
            Ingresar
          </Button>
        </form>
        <div className="flex items-center justify-between text-[13px]">
          <button type="button" onClick={() => setStep("email")} className="inline-flex items-center gap-1 text-fg-muted hover:text-fg">
            <ArrowLeft className="size-3.5" /> Cambiar correo
          </button>
          <form action={send}>
            <input type="hidden" name="email" value={email} />
            <button type="submit" disabled={cooldown > 0 || sending} className="text-fg-muted underline-offset-4 hover:text-fg hover:underline disabled:no-underline disabled:opacity-50">
              {cooldown > 0 ? `Reenviar en ${cooldown} s` : "Reenviar código"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <form action={send} className="space-y-4">
      <div>
        <Label htmlFor="code-email">Correo</Label>
        <input id="code-email" name="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="field h-11" />
      </div>
      {sent?.error && <Alert tone="danger">{sent.error}</Alert>}
      <Button type="submit" size="lg" className="w-full" loading={sending}>
        Enviarme un código
      </Button>
      <p className="text-center text-[12px] leading-relaxed text-fg-subtle">
        Sin contraseña. Si aún no tienes cuenta, se crea al ingresar. Al continuar aceptas la{" "}
        <a href="/legal/privacidad" target="_blank" className="underline underline-offset-2">
          política de privacidad
        </a>
        .
      </p>
    </form>
  );
}
