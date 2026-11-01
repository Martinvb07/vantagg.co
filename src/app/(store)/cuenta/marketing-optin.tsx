"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { BellRing, CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { marketingConsentAction } from "@/app/actions/profile";

function Choice({ optIn, source, children, variant }: { optIn: boolean; source: string; children: React.ReactNode; variant: "primary" | "ghost" | "secondary" }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" name="optIn" value={optIn ? "1" : "0"} variant={variant} size="md" loading={pending} className="w-full sm:w-auto" onClick={(e) => (e.currentTarget.form!.elements.namedItem("source") as HTMLInputElement).value = source}>
      {children}
    </Button>
  );
}

/**
 * Ofertas por correo (Ley 1581: autorización previa y expresa).
 *  - «prompt»: pregunta una sola vez a quien aún no decidió (Mis pedidos).
 *  - «setting»: el interruptor en Perfil, siempre disponible.
 */
export function MarketingOptIn({ mode, optedIn }: { mode: "prompt" | "setting"; optedIn: boolean }) {
  const [state, action] = useActionState(marketingConsentAction, null);
  if (mode === "prompt") {
    if (state?.ok) {
      return (
        <p role="status" className="mt-4 flex items-center gap-2 rounded-[14px] bg-ok-400/10 px-4 py-3 text-[13px] text-ok-400 ring-1 ring-ok-400/25">
          <CircleCheck className="size-4 shrink-0" /> {state.ok}
        </p>
      );
    }
    return (
      <form action={action} className="mt-4 flex flex-col gap-3 rounded-[18px] bg-ink-850 p-4 ring-1 ring-volt-400/25 sm:flex-row sm:items-center sm:p-5">
        <input type="hidden" name="source" value="cuenta-aviso" />
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-volt-400/12 text-volt-300">
          <BellRing className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold">¿Te avisamos de ofertas y descuentos?</p>
          <p className="mt-0.5 text-[13px] text-fg-muted">Bonos y códigos de descuento por correo. Máximo uno por semana y te das de baja con un clic.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Choice optIn source="cuenta-aviso" variant="primary">
            Sí, avísame
          </Choice>
          <Choice optIn={false} source="cuenta-aviso" variant="ghost">
            No, gracias
          </Choice>
        </div>
        {state?.error && <p className="text-[12.5px] text-bad-400">{state.error}</p>}
      </form>
    );
  }
  const now = state?.ok ? state.ok.startsWith("Listo: te avisaremos") : optedIn;
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="source" value="cuenta-perfil" />
      <p className="flex items-start gap-2 text-[13.5px]">
        <BellRing className={now ? "mt-0.5 size-4 shrink-0 text-volt-300" : "mt-0.5 size-4 shrink-0 text-fg-subtle"} />
        <span>
          {now ? "Recibes ofertas y descuentos por correo (máximo uno por semana)." : "No recibes ofertas por correo. Los correos de tus pedidos te llegan igual."}
        </span>
      </p>
      {now ? (
        <Choice optIn={false} source="cuenta-perfil" variant="secondary">
          Dejar de recibir ofertas
        </Choice>
      ) : (
        <Choice optIn source="cuenta-perfil" variant="primary">
          Quiero recibir ofertas
        </Choice>
      )}
      {state?.ok && <p role="status" className="text-[12.5px] text-ok-400">{state.ok}</p>}
      {state?.error && <p className="text-[12.5px] text-bad-400">{state.error}</p>}
    </form>
  );
}
