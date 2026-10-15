"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { createTicketAction } from "@/app/actions/store";
import { SUPPORT_TOPICS as TOPICS } from "@/domain/support";

export function TicketForm({ defaultOrder, defaultTopic, defaultEmail }: { defaultOrder?: string; defaultTopic?: string; defaultEmail?: string }) {
  const [state, action, pending] = useActionState(createTicketAction, null);
  const [topic, setTopic] = useState<string>(TOPICS.some((t) => t.v === defaultTopic) ? defaultTopic! : defaultOrder ? "pedido" : "otro");

  if (state?.ok) {
    return (
      <div className="flex flex-col items-center px-2 py-6 text-center">
        <CircleCheck className="size-10 text-ok-400" />
        <p className="mt-3 font-semibold">Recibimos tu solicitud</p>
        <p className="mt-1 text-[13.5px] text-fg-muted">{state.message}</p>
        {defaultEmail && (
          <Link href="/cuenta?seccion=soporte" className="mt-3 text-[13px] font-medium text-volt-300 underline underline-offset-4">
            Seguirla en Mi cuenta
          </Link>
        )}
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="topic" value={topic} />
      <fieldset>
        <legend className="mb-2 text-[13px] font-medium">¿Sobre qué es?</legend>
        <div className="flex flex-wrap gap-1.5">
          {TOPICS.map((t) => (
            <button
              key={t.v}
              type="button"
              aria-pressed={topic === t.v}
              onClick={() => setTopic(t.v)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                topic === t.v ? "border-volt-400 bg-volt-400/10 text-volt-300" : "border-white/10 text-fg-muted hover:border-white/20 hover:text-fg",
              )}
            >
              {t.l}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-medium">Correo</span>
          <input name="email" type="email" required autoComplete="email" defaultValue={defaultEmail} className="field h-10" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-medium">
            Pedido <span className="font-normal text-fg-subtle">(opcional)</span>
          </span>
          <input name="orderNumber" defaultValue={defaultOrder} placeholder="VX-XXXX-XXXX" className="field h-10 font-mono uppercase" maxLength={20} />
        </label>
      </div>
      <label className="block">
        <span className="mb-1.5 block text-[13px] font-medium">Cuéntanos qué pasó</span>
        <textarea name="message" required minLength={15} maxLength={2000} rows={4} className="field resize-y" placeholder="Ej.: pagué con PSE hace 40 minutos y el pedido sigue pendiente." />
        <span className="mt-1 block text-[11.5px] text-fg-subtle">Nunca compartas contraseñas, códigos SMS ni datos de tarjetas.</span>
      </label>
      {state && !state.ok && <Alert tone="danger">{state.message}</Alert>}
      <Button type="submit" className="w-full" loading={pending}>
        Enviar solicitud
      </Button>
    </form>
  );
}
