import { CircleAlert, Clock, CreditCard, PackageCheck, RotateCcw, XCircle, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

/** Guía compacta de estados: flujo normal en 4 pasos + excepciones agrupadas. */
const FLOW = [
  { icon: Clock, label: "Pendiente de pago", text: "Esperamos la confirmación de la pasarela.", tone: "bg-warn-400/15 text-warn-400" },
  { icon: CreditCard, label: "Pago confirmado", text: "La entrega empieza de inmediato.", tone: "bg-sky-400/15 text-sky-300" },
  { icon: Zap, label: "En procesamiento", text: "Acreditando tu recarga o preparando tu cuenta.", tone: "bg-volt-400/15 text-volt-300" },
  { icon: PackageCheck, label: "Entregado", text: "Listo. Revisa tu juego.", tone: "bg-ok-400/15 text-ok-400" },
];

const EXCEPTIONS = [
  { icon: CircleAlert, label: "Error de entrega", text: "Tu pago está seguro; lo resolvemos nosotros.", tone: "text-bad-400" },
  { icon: RotateCcw, label: "Reembolso", text: "Se devuelve por el mismo medio de pago.", tone: "text-warn-400" },
  { icon: XCircle, label: "Cancelado", text: "No hubo cobro.", tone: "text-fg-subtle" },
];

export function StatusGuide({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-[16px] bg-ink-850 ring-1 ring-white/[0.07]", className)}>
      <div className="px-5 pb-2 pt-4">
        <h2 className="text-[15px] font-bold">Estados del pedido</h2>
        <p className="mt-0.5 text-[12.5px] text-fg-muted">Avanza solo con confirmaciones reales.</p>
      </div>
      <ol className="relative px-5 pb-4 pt-2">
        <span className="absolute bottom-8 left-[34px] top-6 w-px bg-gradient-to-b from-warn-400/40 via-sky-400/40 to-ok-400/40" aria-hidden />
        {FLOW.map(({ icon: Icon, label, text, tone }) => (
          <li key={label} className="relative flex gap-3 py-1.5">
            <span className={cn("relative grid size-7 shrink-0 place-items-center rounded-full ring-4 ring-ink-850", tone)} aria-hidden>
              <Icon className="size-3.5" strokeWidth={2.4} />
            </span>
            <p className="pt-1 text-[13px] leading-snug">
              <span className="font-semibold text-fg">{label}</span>
              <span className="text-fg-muted"> · {text}</span>
            </p>
          </li>
        ))}
      </ol>
      <div className="border-t border-white/[0.06] px-5 py-3.5">
        <p className="mb-2 text-[11.5px] font-medium uppercase tracking-wide text-fg-subtle">Si algo cambia</p>
        <ul className="space-y-2">
          {EXCEPTIONS.map(({ icon: Icon, label, text, tone }) => (
            <li key={label} className="flex items-start gap-2.5 text-[12.5px] leading-snug">
              <Icon className={cn("mt-px size-3.5 shrink-0", tone)} />
              <span>
                <span className="font-medium text-fg">{label}</span>
                <span className="text-fg-muted"> · {text}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
