"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, FieldHint, Label } from "@/components/ui/primitives";
import { requestPasswordResetAction, resetPasswordAction } from "@/app/actions/auth";
import { HoneypotField } from "@/components/ui/honeypot-field";

export function RequestResetForm() {
  const [state, action, pending] = useActionState(requestPasswordResetAction, null);
  if (state?.ok) return <Alert tone="success">{state.ok}</Alert>;
  return (
    <form action={action} className="space-y-4">
      <HoneypotField />
      <div>
        <Label htmlFor="email">Correo de tu cuenta</Label>
        <input id="email" name="email" type="email" required autoComplete="email" className="field h-11" />
      </div>
      {state?.error && <Alert tone="danger">{state.error}</Alert>}
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Enviar enlace
      </Button>
    </form>
  );
}

export function NewPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPasswordAction, null);
  const [show, setShow] = useState(false);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <div>
        <Label htmlFor="password">Nueva contraseña</Label>
        <div className="relative">
          <input id="password" name="password" type={show ? "text" : "password"} required minLength={10} autoComplete="new-password" className="field h-11 pr-11" />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="absolute right-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-md text-fg-subtle hover:text-fg"
            aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        <FieldHint>Mínimo 10 caracteres, con letras y números.</FieldHint>
      </div>
      <div>
        <Label htmlFor="confirm">Repite la contraseña</Label>
        <input id="confirm" name="confirm" type={show ? "text" : "password"} required minLength={10} autoComplete="new-password" className="field h-11" />
      </div>
      {state?.error && <Alert tone="danger">{state.error}</Alert>}
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Guardar contraseña
      </Button>
    </form>
  );
}
