"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Loader2 } from "lucide-react";
import { PROFILE_THEMES } from "@/domain/player";
import { cn } from "@/lib/utils";
import { setProfileThemeAction } from "@/app/actions/profile";

export function ThemePicker({ current }: { current: string }) {
  const [selected, setSelected] = useState(current);
  const [pending, setPending] = useState<string | null>(null);
  const [, start] = useTransition();
  return (
    <div role="radiogroup" aria-label="Portada del perfil" className="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
      {PROFILE_THEMES.map((t) => {
        const on = selected === t.key;
        return (
          <button
            key={t.key}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => {
              setPending(t.key);
              start(async () => {
                const r = await setProfileThemeAction(t.key);
                if (r?.ok) setSelected(t.key);
                setPending(null);
              });
            }}
            className={cn("group relative h-16 overflow-hidden rounded-[12px] text-left transition hover:scale-[1.03]", on ? "ring-2 ring-volt-400 ring-offset-2 ring-offset-ink-850" : "ring-1 ring-white/10")}
            style={{ background: t.bg }}
          >
            <span className="absolute bottom-1.5 left-2 text-[11.5px] font-semibold text-white drop-shadow">{t.label}</span>
            {(on || pending === t.key) && (
              <span className="absolute right-1.5 top-1.5 grid size-5 place-items-center rounded-full bg-volt-400 text-volt-ink">
                {pending === t.key ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" strokeWidth={3} />}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function CopyChip({ value, label, tone = "glass" }: { value: string; label: string; tone?: "glass" | "plain" }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard?.writeText(value).then(() => (setDone(true), setTimeout(() => setDone(false), 1500)))}
      className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[12px] font-semibold tracking-wider ring-1 transition", tone === "glass" ? "bg-black/35 text-white ring-white/15 backdrop-blur hover:bg-black/50" : "bg-white/[0.05] text-fg ring-white/10 hover:bg-white/[0.09]")}
      title="Copiar"
      aria-label={`Copiar ${label} ${value}`}
    >
      {label} {value} {done ? <Check className="size-3 text-ok-400" /> : <Copy className="size-3 opacity-70" />}
    </button>
  );
}
