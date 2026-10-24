"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, Label } from "@/components/ui/primitives";
import { submitClaimAction } from "@/app/actions/store";
import { DataNotice } from "@/components/legal/data-notice";
import { HoneypotField } from "@/components/ui/honeypot-field";

export function ClaimForm({ accountId }: { accountId: string }) {
  const [state, action, pending] = useActionState(submitClaimAction, null);
  if (state?.ok) return <Alert tone="success" className="mt-4">{state.message}</Alert>;
  return (
    <form action={action} className="mt-4 space-y-3">
      <HoneypotField />
      <input type="hidden" name="accountId" value={accountId} />
      <p className="text-[12.5px] text-fg-subtle">
        Si eres el titular de esta cuenta o tienes una reclamación sobre su procedencia, cuéntanos. Revisamos cada caso y podemos suspender la
        publicación mientras se resuelve.
      </p>
      <div>
        <Label htmlFor="claim-email">Correo de contacto</Label>
        <input id="claim-email" name="email" type="email" required className="field" />
      </div>
      <div>
        <Label htmlFor="claim-reason">Motivo</Label>
        <textarea id="claim-reason" name="reason" required minLength={20} rows={4} className="field resize-y" />
      </div>
      {state && !state.ok && <Alert tone="danger">{state.message}</Alert>}
      <DataNotice />
      <Button type="submit" variant="secondary" loading={pending}>
        Enviar reclamación
      </Button>
    </form>
  );
}
