"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Alert, Label } from "@/components/ui/primitives";
import { staffChangePasswordAction } from "@/app/actions/staff-auth";

/** Cambiar la contraseña del panel: contraseña actual + nueva + código de la app de autenticación. */
export function ChangePassword() {
  const [state, action, pending] = useActionState(staffChangePasswordAction, null);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) form.current?.reset();
  }, [state]);

  return (
    <form ref={form} action={action} className="space-y-3">
      <div>
        <Label htmlFor="pw-current">Contraseña actual</Label>
        <input id="pw-current" name="current" type="password" required autoComplete="current-password" className="field" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="pw-next">Nueva contraseña</Label>
          <input id="pw-next" name="next" type="password" required minLength={10} autoComplete="new-password" className="field" />
        </div>
        <div>
          <Label htmlFor="pw-confirm">Repite la nueva</Label>
          <input id="pw-confirm" name="confirm" type="password" required minLength={10} autoComplete="new-password" className="field" />
        </div>
      </div>
      <div>
        <Label htmlFor="pw-code">Código de tu app de autenticación</Label>
        <input id="pw-code" name="code" required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} placeholder="123 456" className="field font-mono tracking-widest" />
      </div>
      <p className="text-[12px] text-fg-subtle">Mínimo 10 caracteres. Al cambiarla se cierran tus demás sesiones y te llega un aviso por correo.</p>
      {state?.error && <Alert tone="danger">{state.error}</Alert>}
      {state?.ok && <Alert tone="success">{state.ok}</Alert>}
      <Button type="submit" variant="secondary" loading={pending}>
        Cambiar contraseña
      </Button>
    </form>
  );
}
