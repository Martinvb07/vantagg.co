"use client";

import { useActionState, useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
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
  const [state, formAction] = useActionState(action, null);
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
