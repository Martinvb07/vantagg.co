"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, Label } from "@/components/ui/primitives";
import { changePasswordAction } from "@/app/actions/auth";

/** Cambiar la contraseña, o crearla si la cuenta entró con Google o con código. */
export function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const [state, action, pending] = useActionState(changePasswordAction, null);
  return (
    <form action={action} className="mt-4 space-y-3">
      {hasPassword && (
        <div>
          <Label htmlFor="current">Contraseña actual</Label>
          <input id="current" name="current" type="password" required autoComplete="current-password" className="field" />
        </div>
      )}
      <div>
        <Label htmlFor="next">{hasPassword ? "Nueva contraseña" : "Contraseña"}</Label>
        <input id="next" name="next" type="password" required minLength={10} autoComplete="new-password" className="field" />
      </div>
      {state?.error && <Alert tone="danger">{state.error}</Alert>}
      {state?.ok && <Alert tone="success">{state.ok}</Alert>}
      <Button type="submit" variant="secondary" className="w-full" loading={pending}>
        {hasPassword ? "Actualizar contraseña" : "Crear contraseña"}
      </Button>
    </form>
  );
}
