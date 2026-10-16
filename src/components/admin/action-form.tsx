"use client";

import { useActionState, useCallback, useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { CircleCheck, CircleX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/app/actions/admin";

type Action = (prev: ActionResult, form: FormData) => Promise<ActionResult>;

export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess,
  hideMessage,
}: {
  action: Action;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  hideMessage?: boolean;
}) {
  // Si el envío falla en el navegador (p. ej. el panel se actualizó mientras estaba abierto), se avisa
  // en vez de no hacer nada. Las redirecciones de Next (errores con digest NEXT_…) siguen su curso.
  const safeAction = useCallback<Action>(
    async (prev, form) => {
      try {
        return await action(prev, form);
      } catch (err) {
        if (String((err as { digest?: unknown })?.digest ?? "").startsWith("NEXT_")) throw err;
        console.error(err);
        return { ok: false, message: "No se pudo guardar: el panel se actualizó mientras estaba abierto. Recarga la página (F5) e inténtalo de nuevo." };
      }
    },
    [action],
  );
  const [state, formAction] = useActionState(safeAction, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form ref={ref} action={formAction} className={className}>
      {children}
      {state && !hideMessage && (
        <p role="status" className={cn("mt-2 flex items-start gap-1.5 text-[12.5px]", state.ok ? "text-ok-400" : "text-bad-400")}>
          {state.ok ? <CircleCheck className="mt-px size-3.5 shrink-0" /> : <CircleX className="mt-px size-3.5 shrink-0" />}
          {state.message}
        </p>
      )}
    </form>
  );
}

export function SubmitButton({ children, ...rest }: ComponentProps<typeof Button>) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending} {...rest}>
      {children}
    </Button>
  );
}

/**
 * Botón de dos pasos para acciones sensibles. Las claves distintas evitan que React
 * reutilice el mismo nodo: si el type cambiara a "submit" durante el clic, se enviaría
 * el formulario sin la segunda confirmación.
 */
export function ConfirmSubmit({ children, confirmText = "¿Confirmar?", variant = "danger", size = "sm" }: { children: ReactNode; confirmText?: string; variant?: ComponentProps<typeof Button>["variant"]; size?: ComponentProps<typeof Button>["size"] }) {
  const [armed, setArmed] = useState(false);
  const { pending } = useFormStatus();
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  if (!armed) {
    return (
      <Button key="arm" type="button" variant={variant === "danger" ? "outline" : variant} size={size} onClick={() => setArmed(true)}>
        {children}
      </Button>
    );
  }
  return (
    <Button key="confirm" type="submit" variant={variant} size={size} loading={pending}>
      {confirmText}
    </Button>
  );
}
