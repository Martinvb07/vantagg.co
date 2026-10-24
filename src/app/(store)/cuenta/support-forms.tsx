"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { CircleCheck, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { SUPPORT_TOPICS } from "@/domain/support";
import { createAccountTicketAction, replyAccountTicketAction, resolveAccountTicketAction } from "@/app/actions/support";
import { DataNotice } from "@/components/legal/data-notice";

export type OrderOption = { id: string; label: string };

/** Nueva solicitud desde Mi cuenta (el correo es el de la cuenta). */
export function NewTicketForm({ orders, email }: { orders: OrderOption[]; email: string }) {
  const [state, action, pending] = useActionState(createAccountTicketAction, null);
  const [topic, setTopic] = useState<string>("otro");
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) {
      form.current?.reset();
      setTopic("otro");
    }
  }, [state]);

  return (
    <form ref={form} action={action} className="space-y-4">
      <input type="hidden" name="topic" value={topic} />
      <fieldset>
        <legend className="mb-2 text-[13px] font-medium">¿Sobre qué es?</legend>
        <div className="flex flex-wrap gap-1.5">
          {SUPPORT_TOPICS.map((t) => (
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
      {orders.length > 0 && (
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-medium">
            Pedido relacionado <span className="font-normal text-fg-subtle">(opcional)</span>
          </span>
          <select name="orderId" defaultValue="" className="field h-10 text-[13.5px]">
            <option value="">Ninguno</option>
            {orders.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="block">
        <span className="mb-1.5 block text-[13px] font-medium">Tu mensaje</span>
        <textarea name="message" required minLength={15} maxLength={2000} rows={4} className="field resize-y" placeholder="Cuéntanos tu duda con el mayor detalle posible." />
        <span className="mt-1 block text-[11.5px] text-fg-subtle">Te respondemos a {email} y aquí mismo. Nunca compartas contraseñas ni códigos.</span>
      </label>
      {state?.error && <Alert tone="danger">{state.error}</Alert>}
      {state?.ok && (
        <p role="status" className="flex items-start gap-2 rounded-[10px] bg-ok-400/10 px-3 py-2.5 text-[13px] text-ok-400 ring-1 ring-ok-400/25">
          <CircleCheck className="mt-0.5 size-4 shrink-0" /> {state.ok}
        </p>
      )}
      <DataNotice />
      <Button type="submit" className="w-full" loading={pending}>
        <Send className="size-4" /> Enviar solicitud
      </Button>
    </form>
  );
}

/** Respuesta del cliente dentro de una solicitud. */
export function TicketReplyForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(replyAccountTicketAction, null);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) form.current?.reset();
  }, [state]);
  return (
    <form ref={form} action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <div className="flex items-end gap-2">
        <textarea
          name="body"
          required
          minLength={2}
          maxLength={2000}
          rows={1}
          aria-label="Responder"
          placeholder="Escribe una respuesta…"
          className="field min-h-10 flex-1 resize-y py-2 text-[13.5px]"
        />
        <Button type="submit" variant="secondary" className="shrink-0" loading={pending} aria-label="Enviar respuesta">
          <Send className="size-4" />
        </Button>
      </div>
      {state?.error && <p className="text-[12.5px] text-bad-400">{state.error}</p>}
    </form>
  );
}

/** «Ya se resolvió»: cierra el caso desde el lado del cliente. */
export function ResolveTicketButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState(resolveAccountTicketAction, null);
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={pending} className="text-[12.5px] font-medium text-fg-muted underline-offset-4 hover:text-fg hover:underline disabled:opacity-50">
        {pending ? "Guardando…" : "Ya se resolvió"}
      </button>
      {state?.error && <span className="ml-2 text-[12px] text-bad-400">{state.error}</span>}
    </form>
  );
}
