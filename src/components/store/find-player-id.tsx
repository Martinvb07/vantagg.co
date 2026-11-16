import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** «¿Dónde está mi ID?»: los tres pasos para copiar el ID de Free Fire (recargas y Armas Evo). */
export function FindPlayerId({ className }: { className?: string }) {
  return (
    <details className={cn("group rounded-[12px] bg-ink-850 ring-1 ring-white/[0.07] [&_summary::-webkit-details-marker]:hidden", className)} open>
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-[14px] font-semibold">
        ¿Dónde está mi ID?
        <ChevronRight className="size-4 text-fg-subtle transition-transform group-open:rotate-90" />
      </summary>
      <ol className="space-y-2.5 px-4 pb-4 text-[13px] text-fg-muted">
        <li className="flex gap-2.5">
          <span className="grid size-5 shrink-0 place-items-center rounded-full bg-white/[0.08] text-[11px] font-semibold text-fg">1</span>
          Abre Free Fire y toca tu avatar arriba a la izquierda.
        </li>
        <li className="flex gap-2.5">
          <span className="grid size-5 shrink-0 place-items-center rounded-full bg-white/[0.08] text-[11px] font-semibold text-fg">2</span>
          Copia el número que aparece debajo de tu nombre.
        </li>
        <li className="flex gap-2.5">
          <span className="grid size-5 shrink-0 place-items-center rounded-full bg-white/[0.08] text-[11px] font-semibold text-fg">3</span>
          Pégalo aquí: verificamos la cuenta y su región antes de que pagues.
        </li>
      </ol>
    </details>
  );
}
