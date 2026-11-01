"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { CircleCheck, MailX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { unsubscribeAction, type UnsubState } from "./actions";

function Submit({ optIn, children }: { optIn: boolean; children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" name="optIn" value={optIn ? "1" : "0"} size="lg" variant={optIn ? "secondary" : "primary"} loading={pending} className="w-full sm:w-auto">
      {children}
    </Button>
  );
}

export function UnsubscribeForm({ id, who, t, optedIn }: { id: string; who: "u" | "c"; t: string; optedIn: boolean }) {
  const [state, action] = useActionState<UnsubState, FormData>(unsubscribeAction, null);
  const current = state?.ok ? state.optedIn : optedIn;
  return (
    <form action={action} className="mt-6 space-y-4">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="who" value={who} />
      <input type="hidden" name="t" value={t} />
      {state && (
        <p role="status" className={`flex items-start gap-2 rounded-xl px-4 py-3 text-[14px] ${state.ok ? "bg-ok-400/10 text-ok-400" : "bg-bad-400/10 text-bad-400"}`}>
          {state.ok ? <CircleCheck className="mt-0.5 size-4 shrink-0" /> : <MailX className="mt-0.5 size-4 shrink-0" />} {state.message}
        </p>
      )}
      {current ? <Submit optIn={false}>Darme de baja de las ofertas</Submit> : <Submit optIn>Volver a recibir ofertas</Submit>}
    </form>
  );
}
