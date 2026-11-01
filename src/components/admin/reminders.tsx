"use client";

import { useState, type ReactNode } from "react";
import { CircleCheck, Clock, Mail, RotateCcw, Send } from "lucide-react";
import { ActionForm, ConfirmSubmit, SubmitButton } from "@/components/admin/action-form";
import { orderAction, sendRemindersAction } from "@/app/actions/admin";
import { cn } from "@/lib/utils";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const WINDOWS = [7, 14, 30] as const;

/** Tarjeta de un tipo de recordatorio: número grande, qué le llega al cliente y el botón. */
function Card({ icon, tone, count, label, gets, children }: { icon: ReactNode; tone: "warn" | "volt"; count: number; label: string; gets: string; children: ReactNode }) {
  return (
    <div className="flex flex-col rounded-[12px] bg-ink-900 p-4 ring-1 ring-white/[0.06]">
      <div className="flex items-center gap-3">
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-full", tone === "warn" ? "bg-warn-400/12 text-warn-400" : "bg-volt-400/12 text-volt-300")}>{icon}</span>
        <p className="min-w-0 leading-tight">
          <span className="block text-[26px] font-bold tabular-nums">{count}</span>
          <span className="text-[13px] text-fg-muted">{label}</span>
        </p>
      </div>
      <p className="mt-3 text-[12.5px] leading-relaxed text-fg-muted">
        <Mail className="mr-1 inline size-3.5 -translate-y-px text-fg-subtle" />
        {gets}
      </p>
      <div className="mt-auto pt-3">{children}</div>
    </div>
  );
}

function NothingToSend({ text }: { text: string }) {
  return (
    <p className="flex items-center gap-1.5 rounded-lg bg-white/[0.03] px-3 py-2.5 text-[12.5px] text-fg-subtle">
      <CircleCheck className="size-4 text-ok-400" /> {text}
    </p>
  );
}

/** Panel → Pedidos: recordatorios en lote, con el conteo antes de enviar y confirmación en dos toques. */
export function ReminderPanel({ pending, recovery }: { pending: number; recovery: Record<(typeof WINDOWS)[number], number> }) {
  const [days, setDays] = useState<(typeof WINDOWS)[number]>(14);
  const n = recovery[days];
  // Sin nadie a quien escribirle: una sola línea, para no ocupar la pantalla (sobre todo en el celular).
  if (pending === 0 && recovery[30] === 0) {
    return (
      <p className="mb-5 flex items-center gap-2 rounded-[12px] border border-white/[0.07] bg-ink-850 px-4 py-3 text-[13px] text-fg-muted">
        <Mail className="size-4 shrink-0 text-volt-300" />
        <span>
          <strong className="font-semibold text-fg">Recordatorios por correo:</strong> no hay pedidos esperando pago ni personas por recuperar ahora.
        </span>
      </p>
    );
  }
  return (
    <section className="mb-5 rounded-[12px] border border-white/[0.07] bg-ink-850" aria-labelledby="recordatorios">
      <header className="flex flex-col gap-0.5 border-b border-white/[0.06] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <h2 id="recordatorios" className="flex items-center gap-2 text-[15px] font-semibold">
          <Mail className="size-4 text-volt-300" /> Recordatorios por correo
        </h2>
        <p className="text-[12.5px] text-fg-muted">Para que los clientes terminen su compra. Nunca se cobra nada hasta que paguen.</p>
      </header>

      <div className="grid gap-3 p-3 sm:p-4 md:grid-cols-2">
        <Card icon={<Clock className="size-5" />} tone="warn" count={pending} label={pending === 1 ? "pedido esperando pago" : "pedidos esperando pago"} gets="Les llega «Tu pedido te espera» con el botón para pagar.">
          {pending > 0 ? (
            <ActionForm action={sendRemindersAction}>
              <input type="hidden" name="kind" value="payment" />
              <ConfirmSubmit variant="primary" size="md" className="w-full sm:w-auto" confirmText="Toca otra vez para enviar">
                <Send className="size-4" /> Enviar a {plural(pending, "cliente", "clientes")}
              </ConfirmSubmit>
            </ActionForm>
          ) : (
            <NothingToSend text="Nadie esperando pago ahora." />
          )}
        </Card>

        <Card icon={<RotateCcw className="size-5" />} tone="volt" count={n} label={n === 1 ? "persona no terminó su compra" : "personas no terminaron su compra"} gets="Les llega «¿Aún quieres tus diamantes?» con su ID ya escrito para comprar de nuevo.">
          <ActionForm action={sendRemindersAction}>
            <input type="hidden" name="kind" value="recovery" />
            <input type="hidden" name="days" value={days} />
            <fieldset className="mb-3">
              <legend className="mb-1.5 text-[12px] text-fg-subtle">Pedidos vencidos en los últimos</legend>
              <div className="grid grid-cols-3 gap-1.5" role="radiogroup">
                {WINDOWS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    role="radio"
                    aria-checked={days === d}
                    onClick={() => setDays(d)}
                    className={cn(
                      "flex h-11 flex-col items-center justify-center rounded-lg border text-[13px] font-medium leading-tight transition-colors",
                      days === d ? "border-volt-400 bg-volt-400/10 text-fg" : "border-white/10 text-fg-muted hover:border-white/25 hover:text-fg",
                    )}
                  >
                    {d} días
                    <span className="text-[11px] font-normal text-fg-subtle">{plural(recovery[d], "persona", "personas")}</span>
                  </button>
                ))}
              </div>
            </fieldset>
            {n > 0 ? (
              <ConfirmSubmit key={days} variant="primary" size="md" className="w-full sm:w-auto" confirmText="Toca otra vez para enviar">
                <Send className="size-4" /> Enviar a {plural(n, "persona", "personas")}
              </ConfirmSubmit>
            ) : (
              <NothingToSend text={`Nadie a quien escribirle en ${days} días.`} />
            )}
          </ActionForm>
        </Card>
      </div>

      <details className="group border-t border-white/[0.06] px-4 py-3 text-[12.5px] text-fg-muted">
        <summary className="cursor-pointer list-none font-medium text-fg-muted hover:text-fg [&::-webkit-details-marker]:hidden">¿A quién no se le escribe? <span className="text-fg-subtle group-open:hidden">Ver reglas</span></summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>A quien ya compró después, o tiene otro pedido esperando pago.</li>
          <li>A pedidos de prueba y a los que canceló el equipo.</li>
          <li>Un recordatorio de cada tipo por pedido, y máximo un «comprar de nuevo» por persona cada 7 días.</li>
          <li>El recordatorio de pago también sale solo a los 20 minutos de crear el pedido.</li>
          <li>Nada en modo mantenimiento.</li>
        </ul>
      </details>
    </section>
  );
}

/** Panel → Pedido: el recordatorio que le toca a este pedido, o por qué no se puede enviar. */
export function OrderReminder({ orderId, email, kind, canSend, reason, sentAt }: { orderId: string; email: string; kind: "payment" | "recovery"; canSend: boolean; reason?: string; sentAt?: string | null }) {
  const title = kind === "payment" ? "Recordatorio de pago" : "Recordatorio para comprar de nuevo";
  const gets = kind === "payment" ? "«Tu pedido te espera», con el botón para pagar." : "«¿Aún quieres tus diamantes?», con su ID ya escrito para comprar de nuevo.";
  return (
    <div className="rounded-[12px] bg-ink-900 p-3.5 ring-1 ring-white/[0.06]">
      <p className="flex items-center gap-2 text-[13.5px] font-semibold">
        <Mail className="size-4 text-volt-300" /> {title}
      </p>
      <p className="mt-1 break-words text-[12.5px] leading-relaxed text-fg-muted">
        Le llega a <span className="text-fg">{email}</span>: {gets}
      </p>
      {canSend ? (
        <ActionForm action={orderAction} className="mt-3">
          <input type="hidden" name="orderId" value={orderId} />
          <input type="hidden" name="op" value="remind" />
          <SubmitButton size="md" className="w-full sm:w-auto">
            <Send className="size-4" /> Enviar recordatorio
          </SubmitButton>
        </ActionForm>
      ) : sentAt ? (
        <p className="mt-3 flex items-center gap-1.5 text-[12.5px] text-ok-400">
          <CircleCheck className="size-4" /> Ya se envió el {sentAt}.
        </p>
      ) : (
        <p className="mt-3 rounded-lg bg-white/[0.03] px-3 py-2 text-[12.5px] text-fg-subtle">No se puede enviar: {reason}</p>
      )}
    </div>
  );
}
