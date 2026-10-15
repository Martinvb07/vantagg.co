"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, FieldHint, Label } from "@/components/ui/primitives";
import { loginAction, registerAction } from "@/app/actions/auth";

export function AuthForm({ mode, next }: { mode: "login" | "register"; next?: string }) {
  const [state, action, pending] = useActionState(mode === "login" ? loginAction : registerAction, null);
  const [show, setShow] = useState(false);
  // React limpia el formulario tras cada envío: nombre y correo se conservan si hay un error.
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  return (
    <form action={action} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      {mode === "register" && (
        <div>
          <Label htmlFor="name">Nombre</Label>
          <input id="name" name="name" required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className="field h-11" />
        </div>
      )}
      <div>
        <Label htmlFor="email">Correo</Label>
        <input id="email" name="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="field h-11" />
      </div>
      <div>
        <Label htmlFor="password">Contraseña</Label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={show ? "text" : "password"}
            required
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            className="field h-11 pr-11"
            minLength={mode === "register" ? 10 : undefined}
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="absolute right-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-md text-fg-subtle hover:text-fg"
            aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        {mode === "register" && <FieldHint>Mínimo 10 caracteres, con letras y números.</FieldHint>}
      </div>
      {mode === "register" && (
        <label className="flex items-start gap-2.5 text-[13px] text-fg-muted">
          <input type="checkbox" name="accept" required className="mt-0.5 size-4 accent-[#c8f04f]" />
          <span>
            Autorizo el tratamiento de mis datos según la{" "}
            <a href="/legal/privacidad" target="_blank" className="text-volt-300 underline underline-offset-2">
              política de privacidad
            </a>
            .
          </span>
        </label>
      )}
      {state?.error && <Alert tone="danger">{state.error}</Alert>}
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        {mode === "login" ? "Ingresar" : "Crear cuenta"}
      </Button>
    </form>
  );
}
