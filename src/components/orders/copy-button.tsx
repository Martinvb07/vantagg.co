"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyButton({ value, label = "Copiar" }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() =>
        navigator.clipboard
          ?.writeText(value)
          .then(() => {
            setDone(true);
            setTimeout(() => setDone(false), 1600);
          })
          .catch(() => {})
      }
      className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-white/[0.06] px-2.5 text-[12px] font-medium text-fg-muted hover:bg-white/10 hover:text-fg"
      aria-label={`${label} ${value}`}
    >
      {done ? <Check className="size-3.5 text-ok-400" /> : <Copy className="size-3.5" />}
      {done ? "Copiado" : label}
    </button>
  );
}
