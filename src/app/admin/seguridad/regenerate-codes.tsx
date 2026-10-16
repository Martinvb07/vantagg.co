"use client";

import { useActionState, useState } from "react";
import { Check, Copy, Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/primitives";
import { regenerateRecoveryCodesAction } from "@/app/actions/staff-auth";

export function RegenerateCodes() {
  const [state, action, pending] = useActionState(regenerateRecoveryCodesAction, null);
  const [copied, setCopied] = useState(false);
  const [code, setCode] = useState("");

  if (state?.codes) {
    const text = state.codes.join("\n");
    const download = () => {
      const url = URL.createObjectURL(new Blob([`Códigos de recuperación del panel\n\n${text}\n`], { type: "text/plain" }));
      const a = Object.assign(document.createElement("a"), { href: url, download: "codigos-recuperacion.txt" });
      a.click();
      URL.revokeObjectURL(url);
    };
    return (
      <div className="space-y-3">
        <Alert tone="success">Códigos nuevos generados. Guárdalos ahora: no se volverán a mostrar.</Alert>
        <ol className="grid grid-cols-2 gap-2 rounded-[12px] bg-ink-900/70 p-3 font-mono text-[13.5px] tracking-wider ring-1 ring-white/[0.06]">
          {state.codes.map((c, i) => (
            <li key={c} className="flex items-center gap-2 rounded-lg bg-white/[0.04] px-2.5 py-2">
              <span className="w-4 text-right text-[11px] text-fg-subtle">{i + 1}</span>
              {c}
            </li>
          ))}
        </ol>
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="secondary" onClick={() => navigator.clipboard?.writeText(text).then(() => setCopied(true))}>
            {copied ? <Check className="size-4 text-ok-400" /> : <Copy className="size-4" />} {copied ? "Copiados" : "Copiar"}
          </Button>
          <Button type="button" variant="secondary" onClick={download}>
            <Download className="size-4" /> Descargar .txt
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-2.5">
      <label htmlFor="regen-code" className="block text-[13px] font-medium">
        Código de verificación
      </label>
      <div className="flex gap-2">
        <input
          id="regen-code"
          name="code"
          required
          inputMode="numeric"
          maxLength={7}
          autoComplete="one-time-code"
          placeholder="000 000"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ""))}
          className="field h-10 min-w-0 flex-1 text-center font-mono tracking-[0.3em]"
        />
        <Button type="submit" variant="secondary" loading={pending} disabled={code.replace(/\s/g, "").length !== 6} className="shrink-0">
          <RefreshCw className="size-4" /> Generar
        </Button>
      </div>
      <p className="text-[12px] text-fg-subtle">Los códigos anteriores dejarán de funcionar.</p>
      {state?.error && <Alert tone="danger">{state.error}</Alert>}
    </form>
  );
}
