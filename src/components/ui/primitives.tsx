import type { ComponentProps, ReactNode } from "react";
import { AlertTriangle, CircleCheck, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StatusTone } from "@/domain/order-status";

export function Container({ className, ...rest }: ComponentProps<"div">) {
  return <div className={cn("mx-auto w-full max-w-[1240px] px-4 sm:px-6 lg:px-8", className)} {...rest} />;
}

const toneClass: Record<StatusTone, string> = {
  neutral: "bg-white/[0.06] text-fg-muted border-white/10",
  info: "bg-sky-400/10 text-sky-400 border-sky-400/25",
  accent: "bg-volt-400/10 text-volt-300 border-volt-400/25",
  success: "bg-ok-400/10 text-ok-400 border-ok-400/25",
  warning: "bg-warn-400/10 text-warn-400 border-warn-400/25",
  danger: "bg-bad-400/10 text-bad-400 border-bad-400/25",
};

export function Badge({ tone = "neutral", className, children, dot }: { tone?: StatusTone; className?: string; children: ReactNode; dot?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-[6px] border px-2 py-0.5 text-[11.5px] font-medium leading-5", toneClass[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}

/** Marca visible para todo dato de demostración. */
export function DemoBadge({ className, label = "DEMO" }: { className?: string; label?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[5px] border border-dashed border-warn-400/50 bg-warn-400/10 px-1.5 py-px font-mono text-[10px] font-semibold tracking-[0.12em] text-warn-400",
        className,
      )}
      title="Dato de demostración: no corresponde a un producto real"
    >
      {label}
    </span>
  );
}

const alertIcon = { info: Info, success: CircleCheck, warning: AlertTriangle, danger: XCircle } as const;

export function Alert({ tone = "info", title, children, className }: { tone?: keyof typeof alertIcon; title?: string; children?: ReactNode; className?: string }) {
  const Icon = alertIcon[tone];
  const colors = {
    info: "border-sky-400/25 bg-sky-400/[0.06] text-sky-400",
    success: "border-ok-400/25 bg-ok-400/[0.06] text-ok-400",
    warning: "border-warn-400/25 bg-warn-400/[0.06] text-warn-400",
    danger: "border-bad-400/25 bg-bad-400/[0.06] text-bad-400",
  }[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex gap-3 rounded-[10px] border px-4 py-3 text-sm", colors, className)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0">
        {title && <p className="font-medium text-fg">{title}</p>}
        {children && <div className={cn("text-fg-muted", title && "mt-0.5")}>{children}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="surface-flat flex flex-col items-center px-6 py-14 text-center">
      {icon && <div className="mb-4 grid size-12 place-items-center rounded-xl border border-white/8 bg-ink-750 text-fg-muted">{icon}</div>}
      <p className="font-display text-lg font-semibold">{title}</p>
      {description && <p className="mt-1.5 max-w-md text-sm text-fg-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Label({ className, ...rest }: ComponentProps<"label">) {
  return <label className={cn("mb-1.5 block text-[13px] font-medium text-fg", className)} {...rest} />;
}

export function FieldHint({ children, error }: { children: ReactNode; error?: boolean }) {
  return <p className={cn("mt-1.5 text-[12.5px]", error ? "text-bad-400" : "text-fg-subtle")}>{children}</p>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden />;
}

