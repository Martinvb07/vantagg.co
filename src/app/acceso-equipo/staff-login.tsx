"use client";

/* eslint-disable @next/next/no-img-element */
import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight, Check, Copy, Download, Eye, EyeOff, KeyRound, LifeBuoy, Lock, Mail, ShieldCheck, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { staffEnrollAction, staffFinishEnrollAction, staffPasswordAction, staffTotpAction, type StaffAuthState } from "@/app/actions/staff-auth";

/** Indicador de pasos del ingreso. */
function Steps({ labels, current }: { labels: string[]; current: number }) {
  return (
    <ol className="mb-8 flex items-center gap-2" aria-label="Pasos del ingreso">
      {labels.map((label, i) => {
        const done = i < current;
        const on = i === current;
        return (
          <li key={label} className="flex flex-1 items-center gap-2" aria-current={on ? "step" : undefined}>
            <span
              className={cn(
                "grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold transition-colors",
                done ? "bg-volt-400 text-volt-ink" : on ? "bg-volt-400/15 text-volt-300 ring-1 ring-volt-400/50" : "bg-white/[0.06] text-fg-subtle",
              )}
            >
              {done ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
            </span>
            <span className={cn("truncate text-[12.5px]", on ? "font-semibold text-fg" : "text-fg-subtle")}>{label}</span>
            {i < labels.length - 1 && <span className={cn("h-px flex-1", done ? "bg-volt-400/60" : "bg-white/10")} />}
          </li>
        );
      })}
    </ol>
  );
}

function Heading({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="mb-6">
      <span className="mb-4 grid size-11 place-items-center rounded-[12px] bg-volt-400/10 text-volt-300 ring-1 ring-volt-400/25">{icon}</span>
      <h1 className="font-display text-[26px] font-bold leading-tight tracking-tight sm:text-[28px]">{title}</h1>
      {children && <p className="mt-2 text-[14px] leading-relaxed text-fg-muted">{children}</p>}
    </div>
  );
}

/** Campo con ícono a la izquierda. */
function IconField({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-subtle">{icon}</span>
      {children}
    </div>
  );
}

/** Código de 6 dígitos en casillas (un solo campo real: acepta pegar y el autocompletado del celular). */
function OtpInput() {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(true);
  return (
    <div className="relative">
      <input
        name="code"
        required
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value.replace(/\D/g, "").slice(0, 6))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        aria-label="Código de 6 dígitos"
        className="absolute inset-0 z-10 w-full cursor-text opacity-0"
      />
      <div aria-hidden className="grid grid-cols-6 gap-2 sm:gap-2.5">
        {Array.from({ length: 6 }, (_, i) => {
          const active = focused && (i === value.length || (i === 5 && value.length === 6));
          return (
            <div
              key={i}
              className={cn(
                "grid h-14 place-items-center rounded-[12px] bg-ink-900 font-mono text-[24px] font-bold tabular-nums ring-1 transition-all sm:h-16",
                active ? "ring-2 ring-volt-400 shadow-[0_0_0_4px_rgba(200,240,79,0.12)]" : value[i] ? "ring-white/20" : "ring-white/[0.08]",
              )}
            >
              {value[i] ?? (active ? <span className="h-6 w-px animate-pulse bg-volt-300" /> : "")}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RecoveryInput() {
  return (
    <IconField icon={<LifeBuoy className="size-4" />}>
      <input
        name="code"
        required
        autoFocus
        autoComplete="off"
        maxLength={9}
        placeholder="ABCD-EFGH"
        aria-label="Código de recuperación"
        className="field h-14 pl-10 font-mono text-[18px] font-semibold uppercase tracking-[0.2em]"
      />
    </IconField>
  );
}

/** Pasos: contraseña → código 2FA (o configurarlo la primera vez) → códigos de recuperación. */
export function StaffLogin({ next }: { next: string }) {
  const [pw, pwAction, pwPending] = useActionState<StaffAuthState, FormData>(staffPasswordAction, null);
  const [totp, totpAction, totpPending] = useActionState<StaffAuthState, FormData>(staffTotpAction, null);
  const [enroll, enrollAction, enrollPending] = useActionState<StaffAuthState, FormData>(staffEnrollAction, null);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [email, setEmail] = useState(""); // React borra los campos tras cada envío; el correo se conserva
  const [showPw, setShowPw] = useState(false);
  const [caps, setCaps] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  useEffect(() => emailRef.current?.focus(), []);

  // Si el código venció, cualquier paso puede devolver a la contraseña.
  const expired = totp?.step === "password" ? totp : enroll?.step === "password" ? enroll : null;
  const state = enroll ?? (totp?.step === "totp" ? totp : null) ?? pw;
  const step = state?.step ?? "password";
  const firstTime = step === "enroll" || step === "codes";
  const labels = firstTime ? ["Credenciales", "Activar 2FA", "Códigos"] : ["Credenciales", "Código"];
  const current = step === "password" ? 0 : step === "codes" ? 2 : 1;

  if (expired) {
    return (
      <div>
        <Heading icon={<Lock className="size-5" />} title="La verificación venció">
          Por seguridad, el paso del código dura 10 minutos.
        </Heading>
        <Alert tone="warning">{expired.error ?? "Ingresa de nuevo para continuar."}</Alert>
        <Button type="button" size="lg" className="mt-5 h-12 w-full" onClick={() => window.location.reload()}>
          Ingresar de nuevo
        </Button>
      </div>
    );
  }

  if (state?.step === "codes") {
    const codes = state.codes;
    const download = () => {
      const blob = new Blob([`Códigos de recuperación del panel (cada uno sirve una vez)\n\n${codes.join("\n")}\n`], { type: "text/plain" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "codigos-recuperacion-panel.txt";
      a.click();
      URL.revokeObjectURL(a.href);
    };
    return (
      <div>
        <Steps labels={labels} current={current} />
        <Heading icon={<ShieldCheck className="size-5" />} title="Verificación activada">
          Guarda estos <strong className="text-fg">códigos de recuperación</strong>. Cada uno sirve <strong className="text-fg">una sola vez</strong> si pierdes el celular y no se volverán a mostrar.
        </Heading>
        <ul aria-label="Códigos de recuperación" className="grid grid-cols-2 gap-2 rounded-[14px] bg-ink-900 p-3 ring-1 ring-white/10">
          {codes.map((c, i) => (
            <li key={c} className="flex items-center gap-2 rounded-[8px] bg-white/[0.04] px-2.5 py-2 font-mono text-[14px] tracking-wider">
              <span className="w-4 text-right text-[11px] text-fg-subtle">{i + 1}</span>
              <span data-code>{c}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigator.clipboard?.writeText(codes.join("\n")).then(() => setCopied(true))}
          >
            {copied ? <Check className="size-4 text-ok-400" /> : <Copy className="size-4" />} {copied ? "Copiados" : "Copiar"}
          </Button>
          <Button type="button" variant="secondary" onClick={download}>
            <Download className="size-4" /> Descargar .txt
          </Button>
        </div>
        <form action={staffFinishEnrollAction} className="mt-5">
          <input type="hidden" name="next" value={state.next} />
          <label className="flex cursor-pointer items-start gap-2.5 text-[13px] text-fg-muted">
            <input type="checkbox" className="mt-0.5 size-4 accent-[#c8f04f]" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
            Ya guardé mis códigos en un lugar seguro.
          </label>
          <Button type="submit" size="lg" className="mt-4 h-12 w-full" disabled={!saved}>
            Entrar al panel <ArrowRight className="size-4" />
          </Button>
        </form>
      </div>
    );
  }

  if (state?.step === "enroll") {
    return (
      <form action={enrollAction}>
        <input type="hidden" name="next" value={next} />
        <Steps labels={labels} current={current} />
        <Heading icon={<Smartphone className="size-5" />} title="Activa la verificación en dos pasos">
          Solo la primera vez. Desde ahora cada ingreso pedirá un código de tu celular.
        </Heading>
        <div className="grid gap-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
          <div className="mx-auto rounded-[16px] bg-white p-2.5 shadow-[0_20px_50px_-20px_rgba(200,240,79,0.35)]">
            <img src={state.qr} alt="Código QR para la app de autenticación" width={168} height={168} className="block" />
          </div>
          <ol className="space-y-3 text-[13.5px] text-fg-muted">
            {[
              <>
                Instala <strong className="text-fg">Google Authenticator</strong>, Microsoft Authenticator o Authy.
              </>,
              <>Toca «+» y elige «Escanear código QR».</>,
              <>Escribe abajo el código de 6 dígitos que aparece.</>,
            ].map((t, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-white/[0.08] text-[11px] font-semibold text-fg">{i + 1}</span>
                <span className="leading-relaxed">{t}</span>
              </li>
            ))}
          </ol>
        </div>
        <details className="group mt-4 rounded-[12px] bg-ink-900/70 px-3.5 py-2.5 ring-1 ring-white/[0.07] [&_summary::-webkit-details-marker]:hidden">
          <summary className="cursor-pointer list-none text-[12.5px] text-fg-muted hover:text-fg">¿No puedes escanear? Ver la clave para escribirla</summary>
          <span className="mt-2 block select-all break-all font-mono text-[13px] tracking-wider text-fg">{state.secret}</span>
        </details>
        <p className="mb-2 mt-6 text-[12.5px] font-medium">Código de la app</p>
        <OtpInput />
        {state.error && (
          <Alert tone="danger" className="mt-4">
            {state.error}
          </Alert>
        )}
        <Button type="submit" size="lg" className="mt-5 h-12 w-full" loading={enrollPending}>
          Activar y entrar
        </Button>
      </form>
    );
  }

  if (step === "totp") {
    return (
      <form action={totpAction}>
        <input type="hidden" name="next" value={next} />
        <Steps labels={labels} current={current} />
        <Heading icon={recovery ? <LifeBuoy className="size-5" /> : <Smartphone className="size-5" />} title="Código de verificación">
          {recovery ? "Escribe uno de tus códigos de recuperación (ABCD-EFGH). Cada uno sirve una sola vez." : "Abre tu app de autenticación y escribe el código de 6 dígitos."}
        </Heading>
        {recovery ? <RecoveryInput key="r" /> : <OtpInput key="t" />}
        {state?.step === "totp" && state.error && (
          <Alert tone="danger" className="mt-4">
            {state.error}
          </Alert>
        )}
        <Button type="submit" size="lg" className="mt-5 h-12 w-full" loading={totpPending}>
          Verificar
        </Button>
        <button type="button" onClick={() => setRecovery((v) => !v)} className="mt-4 w-full text-center text-[13px] text-fg-muted underline-offset-4 hover:text-fg hover:underline">
          {recovery ? "Usar el código de la app" : "¿Perdiste el celular? Usar un código de recuperación"}
        </button>
      </form>
    );
  }

  return (
    <form action={pwAction}>
      <Steps labels={labels} current={current} />
      <Heading icon={<KeyRound className="size-5" />} title="Ingresar al panel">
        Accede con tu cuenta del equipo.
      </Heading>
      <div className="space-y-4">
        <div>
          <label htmlFor="email" className="mb-1.5 block text-[12.5px] font-medium">
            Correo
          </label>
          <IconField icon={<Mail className="size-4" />}>
            <input ref={emailRef} id="email" name="email" type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" className="field h-12 pl-10" />
          </IconField>
        </div>
        <div>
          <label htmlFor="password" className="mb-1.5 block text-[12.5px] font-medium">
            Contraseña
          </label>
          <IconField icon={<Lock className="size-4" />}>
            <input
              id="password"
              name="password"
              type={showPw ? "text" : "password"}
              required
              autoComplete="current-password"
              placeholder="••••••••••"
              onKeyUp={(e) => setCaps(e.getModifierState("CapsLock"))}
              className="field h-12 pl-10 pr-11"
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              aria-label={showPw ? "Ocultar contraseña" : "Mostrar contraseña"}
              className="absolute right-1.5 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-[8px] text-fg-subtle hover:bg-white/[0.06] hover:text-fg"
            >
              {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </IconField>
          {caps && <p className="mt-1.5 text-[12px] text-warn-400">Bloq Mayús está activado.</p>}
        </div>
      </div>
      {state?.step === "password" && state.error && (
        <Alert tone="danger" className="mt-4">
          {state.error}
        </Alert>
      )}
      <Button type="submit" size="lg" className="mt-6 h-12 w-full" loading={pwPending}>
        Continuar <ArrowRight className="size-4" />
      </Button>
    </form>
  );
}
