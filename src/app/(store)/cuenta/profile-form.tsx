"use client";

import { useActionState } from "react";
import { Gamepad2, Lock, Phone, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, FieldHint, Label } from "@/components/ui/primitives";
import { updateProfileAction } from "@/app/actions/profile";

export function ProfileForm({ name, email, phone, ffPlayerId }: { name: string; email: string; phone: string; ffPlayerId: string }) {
  const [state, action, pending] = useActionState(updateProfileAction, null);
  const field = "field h-11 pl-10";
  return (
    <form action={action} className="space-y-4">
      <div>
        <Label htmlFor="pf-name">Nombre</Label>
        <div className="relative">
          <UserRound className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
          <input id="pf-name" name="name" defaultValue={name} required minLength={2} maxLength={60} autoComplete="name" className={field} />
        </div>
      </div>
      <div>
        <Label htmlFor="pf-ff">ID de Free Fire</Label>
        <div className="relative">
          <Gamepad2 className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
          <input id="pf-ff" name="ffPlayerId" defaultValue={ffPlayerId} inputMode="numeric" pattern="[0-9]{6,12}" maxLength={12} placeholder="Ej.: 123456789" className={`${field} font-mono tracking-wider`} />
        </div>
        <FieldHint>Lo usamos para llenar la recarga por ti. Igual verificamos el ID antes de cada pago.</FieldHint>
      </div>
      <div>
        <Label htmlFor="pf-phone">WhatsApp</Label>
        <div className="relative">
          <Phone className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
          <input id="pf-phone" name="phone" defaultValue={phone} inputMode="tel" autoComplete="tel" placeholder="+57 300 000 0000" className={field} />
        </div>
        <FieldHint>Opcional. Para avisarte de la entrega de cuentas.</FieldHint>
      </div>
      <div>
        <Label htmlFor="pf-email">Correo</Label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
          <input id="pf-email" value={email} readOnly className={`${field} cursor-not-allowed text-fg-muted`} />
        </div>
        <FieldHint>Es tu identidad en la tienda; no se puede cambiar desde aquí.</FieldHint>
      </div>
      {state?.error && <Alert tone="danger">{state.error}</Alert>}
      {state?.ok && <Alert tone="success">{state.ok}</Alert>}
      <Button type="submit" size="lg" className="w-full sm:w-auto" loading={pending}>
        Guardar cambios
      </Button>
    </form>
  );
}
