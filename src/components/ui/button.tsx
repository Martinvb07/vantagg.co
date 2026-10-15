import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-[background,border-color,color,transform,box-shadow] duration-150 disabled:pointer-events-none disabled:opacity-45 active:translate-y-px select-none";

const variants: Record<Variant, string> = {
  primary:
    "bg-volt-400 text-volt-ink hover:bg-volt-300 shadow-[0_1px_0_0_rgb(255_255_255/0.35)_inset,0_8px_24px_-10px_rgb(200_240_79/0.55)]",
  secondary: "bg-ink-700 text-fg hover:bg-ink-600 border border-white/8",
  outline: "border border-white/14 text-fg hover:border-white/28 hover:bg-white/[0.03]",
  ghost: "text-fg-muted hover:text-fg hover:bg-white/[0.05]",
  danger: "bg-bad-400/12 text-bad-400 border border-bad-400/30 hover:bg-bad-400/20",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] rounded-[7px]",
  md: "h-10 px-4 text-sm rounded-[var(--radius-ctl)]",
  lg: "h-12 px-6 text-[15px] rounded-[10px]",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

type ButtonProps = ComponentProps<"button"> & { variant?: Variant; size?: Size; loading?: boolean };

export function Button({ variant = "primary", size = "md", loading, className, children, disabled, ...rest }: ButtonProps) {
  return (
    <button className={buttonClass(variant, size, className)} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading && <Spinner />}
      {children}
    </button>
  );
}

type LinkButtonProps = ComponentProps<typeof Link> & { variant?: Variant; size?: Size; children: ReactNode };

export function LinkButton({ variant = "primary", size = "md", className, children, ...rest }: LinkButtonProps) {
  return (
    <Link className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn("size-4 animate-spin", className)} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
