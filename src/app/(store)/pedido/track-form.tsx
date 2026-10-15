"use client";

import { useActionState, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/primitives";
import { trackOrderAction } from "@/app/actions/store";

/** "vx-7k2m9qht" / "7K2M9QHT" → "7K2M-9QHT" (sin prefijo). */
function formatBody(raw: string, prefix: string) {
  let s = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (s.startsWith(prefix)) s = s.slice(prefix.length);
  s = s.slice(0, 8);
  return s.length > 4 ? `${s.slice(0, 4)}-${s.slice(4)}` : s;
}

export function TrackForm({ prefix }: { prefix: string }) {
  const [state, action, pending] = useActionState(trackOrderAction, null);
  const [body, setBody] = useState("");
  const complete = body.replace("-", "").length === 8;

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="number" value={`${prefix}-${body}`} />
      <label className="block">
        <span className="mb-1.5 block text-[13px] font-medium">Número de pedido</span>
        <span className="flex h-14 items-center overflow-hidden rounded-[12px] border border-white/10 bg-ink-900 focus-within:border-volt-500/60">
          <span className="flex h-full items-center border-r border-white/10 bg-white/[0.04] px-4 font-mono text-[18px] font-semibold tracking-[0.12em] text-fg-muted">{prefix}-</span>
          <input
            value={body}
            onChange={(e) => setBody(formatBody(e.target.value, prefix))}
            onPaste={(e) => {
              e.preventDefault();
              setBody(formatBody(e.clipboardData.getData("text"), prefix));
            }}
            required
            autoComplete="off"
            spellCheck={false}
            inputMode="text"
            placeholder="XXXX-XXXX"
            aria-label="Número de pedido sin prefijo"
            className="h-full min-w-0 flex-1 bg-transparent px-4 font-mono text-[18px] font-semibold uppercase tracking-[0.12em] outline-none placeholder:text-fg-subtle"
          />
        </span>
      </label>
      {/* Corte de ticket */}
      <div className="relative -mx-5 py-1 sm:-mx-7" aria-hidden>
        <span className="absolute -left-2.5 top-1/2 size-5 -translate-y-1/2 rounded-full bg-ink-900" />
        <span className="absolute -right-2.5 top-1/2 size-5 -translate-y-1/2 rounded-full bg-ink-900" />
        <span className="mx-5 block border-t-2 border-dashed border-white/[0.09]" />
      </div>
      <label className="block">
        <span className="mb-1.5 block text-[13px] font-medium">Correo con el que compraste</span>
        <input name="email" type="email" required autoComplete="email" placeholder="tu@correo.com" className="field h-12 bg-ink-900" />
      </label>
      {state?.error && <Alert tone="danger">{state.error}</Alert>}
      <Button type="submit" size="lg" variant={complete ? "primary" : "secondary"} className="h-12 w-full text-[15px] font-semibold disabled:opacity-100 disabled:text-fg-subtle" loading={pending} disabled={!complete}>
        Ver estado del pedido <ArrowRight className="size-4" />
      </Button>
    </form>
  );
}
