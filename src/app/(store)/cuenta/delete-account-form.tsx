"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, Label } from "@/components/ui/primitives";
import { deleteMyAccountAction } from "@/app/actions/profile";

/** Eliminar la cuenta (supresión de datos). Hay que escribir ELIMINAR: no se hace con un clic por error. */
export function DeleteAccountForm() {
  const [state, action, pending] = useActionState(deleteMyAccountAction, null);
  const [text, setText] = useState("");
  const ready = text.trim().toUpperCase() === "ELIMINAR";
  return (
    <form action={action} className="mt-4 space-y-3">
      <div>
        <Label htmlFor="confirm-delete">Escribe ELIMINAR para confirmar</Label>
        <input id="confirm-delete" name="confirm" value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" className="field" />
      </div>
      {state?.error && <Alert tone="danger">{state.error}</Alert>}
      <Button type="submit" variant="danger" className="w-full" loading={pending} disabled={!ready}>
        Eliminar mi cuenta definitivamente
      </Button>
    </form>
  );
}
