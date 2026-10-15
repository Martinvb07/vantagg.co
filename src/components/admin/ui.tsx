import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-2xl font-semibold">{title}</h1>
        {description && <p className="mt-1 text-sm text-fg-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, actions, children, className, bodyClass }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClass?: string }) {
  return (
    <section className={cn("rounded-[12px] border border-white/[0.07] bg-ink-850", className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
          {title && <h2 className="text-[14px] font-semibold">{title}</h2>}
          {actions}
        </header>
      )}
      <div className={cn("p-4", bodyClass)}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "warn" | "bad" | "ok" }) {
  return (
    <div className="rounded-[12px] border border-white/[0.07] bg-ink-850 p-4">
      <p className="text-[12px] text-fg-muted">{label}</p>
      <p className={cn("mt-1.5 font-display text-2xl font-semibold tabular-nums", tone === "warn" && "text-warn-400", tone === "bad" && "text-bad-400", tone === "ok" && "text-ok-400")}>{value}</p>
      {hint && <p className="mt-1 text-[11.5px] text-fg-subtle">{hint}</p>}
    </div>
  );
}

export function Table({ children }: { children: ReactNode }) {
  return (
    // tabIndex: en pantallas angostas la tabla se desplaza y debe poder hacerse con el teclado.
    <div tabIndex={0} className="overflow-x-auto rounded-[12px] border border-white/[0.07] bg-ink-850 outline-none focus-visible:ring-2 focus-visible:ring-volt-400">
      <table className="w-full min-w-[720px] text-left text-[13px] [&_td]:px-4 [&_td]:py-3 [&_th]:px-4 [&_th]:py-2.5 [&_th]:text-[11.5px] [&_th]:font-medium [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-fg-subtle [&_thead]:border-b [&_thead]:border-white/[0.06] [&_tbody_tr]:border-b [&_tbody_tr]:border-white/[0.04] [&_tbody_tr:last-child]:border-0 [&_tbody_tr:hover]:bg-white/[0.02]">
        {children}
      </table>
    </div>
  );
}

export function Field({ label, children, hint, className }: { label: string; children: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-[12.5px] font-medium text-fg">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11.5px] text-fg-subtle">{hint}</span>}
    </label>
  );
}

export function Check({ name, label, defaultChecked, hint, value }: { name: string; label: string; defaultChecked?: boolean; hint?: string; value?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-[13px]">
      <input type="checkbox" name={name} value={value} defaultChecked={defaultChecked} className="mt-0.5 size-4 accent-[#c8f04f]" />
      <span>
        {label}
        {hint && <span className="block text-[11.5px] text-fg-subtle">{hint}</span>}
      </span>
    </label>
  );
}
