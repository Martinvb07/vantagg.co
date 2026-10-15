"use client";

import { useActionState, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/primitives";
import { regenerateRecoveryCodesAction } from "@/app/actions/staff-auth";

export function RegenerateCodes() {
  const [state, action, pending] = useActionState(regenerateRecoveryCodesAction, null);
  const [copied, setCopied] = useState(false);

  if (state?.codes) {
    return (
      <div className="mt-4 space-y-3">
        <Alert tone="success">Nuevos códigos generados. Guárdalos ahora: no se volverán a mostrar.</Alert>
        <ul className="grid grid-cols-2 gap-2 rounded-[12px] bg-ink-900 p-3 font-mono text-[13.5px] tracking-wider ring-1 ring-white/10">
          {state.codes.map((c) => (
            <li key={c} className="rounded-md bg-white/[0.04] px-2 py-1.5 text-center">
              {c}
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => navigator.clipboard?.writeText(state.codes!.join("\n")).then(() => setCopied(true))}
          className="inline-flex items-center gap-2 rounded-lg bg-white/[0.06] px-3 py-2 text-[13px] ring-1 ring-white/10 hover:bg-white/10"
        >
          {copied ? <Check className="size-4 text-ok-400" /> : <Copy className="size-4" />} {copied ? "Copiados" : "Copiar"}
        </button>
      </div>
    );
  }

  return (
    <form action={action} className="mt-4 flex flex-wrap items-center gap-2">
      <input name="code" required inputMode="numeric" maxLength={6} placeholder="Código de la app" aria-label="Código de la app" autoComplete="one-time-code" className="field h-10 w-44 text-center font-mono tracking-[0.2em]" />
      <Button type="submit" variant="secondary" loading={pending}>
        Generar nuevos códigos
      </Button>
      {state?.error && <Alert tone="danger" className="w-full">{state.error}</Alert>}
    </form>
  );
}
