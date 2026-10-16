"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Check, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, Label } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { staffChangePasswordAction } from "@/app/actions/staff-auth";

function PasswordInput({ id, name, value, onChange, autoComplete }: { id: string; name: string; value?: string; onChange?: (v: string) => void; autoComplete: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type={show ? "text" : "password"}
        required
        autoComplete={autoComplete}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        className="field h-11 pr-11"
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
        className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-fg-subtle transition-colors hover:bg-white/[0.06] hover:text-fg"
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

/** 0–4 según largo y variedad de caracteres. */
function strength(v: string) {
  if (!v) return 0;
  let s = 0;
  if (v.length >= 10) s++;
  if (v.length >= 14) s++;
  if (/[a-z]/.test(v) && /[A-Z]/.test(v)) s++;
  if (/\d/.test(v) && /[^A-Za-z0-9]/.test(v)) s++;
  return Math.max(1, s);
}
const LEVELS = [
  { l: "", c: "" },
  { l: "Débil", c: "bg-bad-400" },
  { l: "Aceptable", c: "bg-warn-400" },
  { l: "Buena", c: "bg-volt-400" },
  { l: "Fuerte", c: "bg-ok-400" },
];

/** Cambiar la contraseña del panel: contraseña actual + nueva + código de la app de autenticación. */
export function ChangePassword() {
  const [state, action, pending] = useActionState(staffChangePasswordAction, null);
  const form = useRef<HTMLFormElement>(null);
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [code, setCode] = useState("");

  useEffect(() => {
    if (state?.ok) {
      form.current?.reset();
      setNext("");
      setConfirm("");
      setCode("");
    }
  }, [state]);

  const rules = [
    { ok: next.length >= 10, l: "Mínimo 10 caracteres" },
    { ok: /[A-Za-z]/.test(next) && /\d/.test(next), l: "Letras y números" },
    { ok: !!next && next === confirm, l: "Las dos coinciden" },
  ];
  const level = strength(next);
  const ready = rules.every((r) => r.ok) && code.replace(/\s/g, "").length === 6;

  return (
    <form ref={form} action={action} className="space-y-5">
      <div>
        <Label htmlFor="pw-current">Contraseña actual</Label>
        <PasswordInput id="pw-current" name="current" autoComplete="current-password" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="pw-next">Nueva contraseña</Label>
          <PasswordInput id="pw-next" name="next" value={next} onChange={setNext} autoComplete="new-password" />
        </div>
        <div>
          <Label htmlFor="pw-confirm">Confirmar nueva contraseña</Label>
          <PasswordInput id="pw-confirm" name="confirm" value={confirm} onChange={setConfirm} autoComplete="new-password" />
        </div>
      </div>

      <div className="rounded-[12px] bg-ink-900/70 p-3.5 ring-1 ring-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="grid flex-1 grid-cols-4 gap-1.5" aria-hidden>
            {[1, 2, 3, 4].map((i) => (
              <span key={i} className={cn("h-1.5 rounded-full transition-colors", i <= level ? LEVELS[level].c : "bg-white/[0.08]")} />
            ))}
          </div>
          <span className="w-16 text-right text-[12px] font-medium text-fg-muted" aria-live="polite">
            {next ? LEVELS[level].l : "Seguridad"}
          </span>
        </div>
        <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[12.5px]">
          {rules.map((r) => (
            <li key={r.l} className={cn("flex items-center gap-1.5 transition-colors", r.ok ? "text-ok-400" : "text-fg-subtle")}>
              <span className={cn("grid size-4 place-items-center rounded-full", r.ok ? "bg-ok-400/15" : "bg-white/[0.06]")}>
                <Check className={cn("size-2.5", !r.ok && "opacity-0")} strokeWidth={3} />
              </span>
              {r.l}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <Label htmlFor="pw-code">Código de verificación</Label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            id="pw-code"
            name="code"
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={7}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ""))}
            placeholder="000 000"
            className="field h-11 text-center font-mono text-[17px] tracking-[0.35em] sm:w-44"
          />
          <p className="flex items-center gap-1.5 text-[12.5px] text-fg-subtle">
            <ShieldCheck className="size-3.5 shrink-0" /> Los 6 dígitos de tu app de autenticación.
          </p>
        </div>
      </div>

      {state?.error && <Alert tone="danger">{state.error}</Alert>}
      {state?.ok && <Alert tone="success">{state.ok}</Alert>}

      <div className="flex flex-col-reverse gap-3 border-t border-white/[0.06] pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[12px] text-fg-subtle">Se cerrarán tus demás sesiones y recibirás un aviso por correo.</p>
        <Button type="submit" loading={pending} disabled={!ready} className="sm:min-w-44">
          Actualizar contraseña
        </Button>
      </div>
    </form>
  );
}
