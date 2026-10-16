import { CircleDashed, MailCheck, MailQuestion } from "lucide-react";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { v: "CONFIRMED", l: "Confirmado", icon: MailCheck, on: "peer-checked:bg-ok-400/12 peer-checked:text-ok-400 peer-checked:ring-ok-400/40" },
  { v: "PENDING", l: "En proceso", icon: CircleDashed, on: "peer-checked:bg-warn-400/12 peer-checked:text-warn-400 peer-checked:ring-warn-400/40" },
  { v: "", l: "Sin indicar", icon: MailQuestion, on: "peer-checked:bg-white/[0.08] peer-checked:text-fg peer-checked:ring-white/20" },
] as const;

/** Estado del correo vinculado a la cuenta en venta: botones de opción (sin JavaScript). */
export function EmailStatusPicker({ defaultValue }: { defaultValue: string }) {
  return (
    <div role="radiogroup" aria-label="Correo de la cuenta" className="grid grid-cols-3 gap-1.5">
      {OPTIONS.map(({ v, l, icon: Icon, on }) => (
        <label key={l} className="relative cursor-pointer">
          <input type="radio" name="emailStatus" value={v} defaultChecked={defaultValue === v} className="peer sr-only" />
          <span
            className={cn(
              "flex h-10 items-center justify-center gap-1.5 rounded-[var(--radius-ctl)] bg-ink-850 px-2 text-[12.5px] font-medium text-fg-muted ring-1 ring-white/[0.09] transition-colors hover:text-fg peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-volt-400",
              on,
            )}
          >
            <Icon className="size-4 shrink-0" /> {l}
          </span>
        </label>
      ))}
    </div>
  );
}
