import { cn } from "@/lib/utils";

/** Ilustraciones originales para las tarjetas de categoría. */

export function AccountsIllustration({ className }: { className?: string }) {
  return (
    <div className={cn("relative h-full w-full", className)} aria-hidden>
      <div className="absolute inset-0 bg-[radial-gradient(60%_70%_at_70%_40%,rgba(200,240,79,0.16),transparent_70%)]" />
      <svg viewBox="0 0 200 150" className="absolute right-[6%] top-[12%] w-[70%]">
        <rect x="40" y="18" width="120" height="112" rx="10" fill="#1c2029" stroke="rgba(255,255,255,0.12)" />
        <rect x="52" y="30" width="34" height="34" rx="8" fill="#2d3340" />
        <path d="M60 58c2-8 16-8 18 0" stroke="#c8f04f" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <circle cx="69" cy="44" r="6" fill="#c8f04f" />
        <rect x="94" y="34" width="52" height="7" rx="3.5" fill="#3b4251" />
        <rect x="94" y="48" width="34" height="6" rx="3" fill="#2d3340" />
        <g fill="#232833" stroke="rgba(255,255,255,0.08)">
          <rect x="52" y="76" width="28" height="28" rx="6" />
          <rect x="86" y="76" width="28" height="28" rx="6" />
          <rect x="120" y="76" width="28" height="28" rx="6" />
        </g>
        <path d="M60 96l6-10 5 6 4-4 5 8z" fill="#6cb4ff" fillOpacity="0.8" />
        <path d="M94 96l8-12 8 12z" fill="#c8f04f" fillOpacity="0.8" />
        <circle cx="134" cy="90" r="7" fill="#f4b84a" fillOpacity="0.85" />
        <rect x="52" y="112" width="60" height="7" rx="3.5" fill="#2d3340" />
        <rect x="120" y="111" width="28" height="9" rx="4.5" fill="#c8f04f" />
      </svg>
    </div>
  );
}

/** Imagen de respaldo para cuentas sin fotografía. */
export function AccountPlaceholder({ title, className }: { title?: string; className?: string }) {
  return (
    <div className={cn("relative grid h-full w-full place-items-center overflow-hidden bg-ink-750", className)} role="img" aria-label={title ? `Sin imagen: ${title}` : "Sin imagen"}>
      <div className="bg-grid absolute inset-0 opacity-60" />
      <AccountsIllustration className="opacity-70" />
    </div>
  );
}
