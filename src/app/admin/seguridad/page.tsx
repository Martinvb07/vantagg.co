import type { ReactNode } from "react";
import { KeyRound, LifeBuoy, Link2, Lock, MonitorSmartphone, ShieldCheck, Smartphone } from "lucide-react";
import { PageHeader } from "@/components/admin/ui";
import { CopyButton } from "@/components/orders/copy-button";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/money";
import { cn } from "@/lib/utils";
import { adminEntryUrl } from "@/server/admin-gate";
import { ChangePassword } from "./change-password";
import { RegenerateCodes } from "./regenerate-codes";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mi seguridad" };

function Card({ icon, title, description, aside, children, className }: { icon: ReactNode; title: string; description: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-[16px] border border-white/[0.07] bg-ink-850", className)}>
      <header className="flex items-start gap-3.5 border-b border-white/[0.06] px-5 py-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-volt-400/10 text-volt-300 ring-1 ring-volt-400/20">{icon}</span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold leading-tight">{title}</h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-fg-muted">{description}</p>
        </div>
        {aside}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

function device(ua: string | null) {
  const os = ua?.match(/(Windows|Android|iPhone|iPad|Mac OS X|Linux)/)?.[0]?.replace("Mac OS X", "macOS") ?? "Dispositivo";
  const browser = ua?.match(/(Edg|OPR|Chrome|Firefox|Safari)\//)?.[1]?.replace("Edg", "Edge").replace("OPR", "Opera") ?? "Navegador";
  return { os, browser, mobile: /Android|iPhone|iPad/.test(ua ?? "") };
}

export default async function StaffSecurity() {
  const me = await requireStaff();
  const [user, sessions, lastChange] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: me.id }, select: { totpEnabledAt: true, recoveryCodes: true } }),
    db.session.findMany({ where: { userId: me.id, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" }, select: { id: true, createdAt: true, userAgent: true } }),
    db.auditLog.findFirst({ where: { entityId: me.id, action: { in: ["auth.staff_password_changed", "auth.password_changed"] } }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
  ]);
  const remaining = Array.isArray(user.recoveryCodes) ? user.recoveryCodes.length : 0;
  const lowCodes = remaining <= 2;

  const summary = [
    { icon: ShieldCheck, l: "Verificación en dos pasos", v: user.totpEnabledAt ? "Activa" : "Pendiente", hint: user.totpEnabledAt ? `Desde ${formatDate(user.totpEnabledAt, false)}` : "Obligatoria para el equipo", tone: user.totpEnabledAt ? "ok" : "warn" },
    { icon: KeyRound, l: "Contraseña", v: lastChange ? "Al día" : "Temporal", hint: lastChange ? `Cambiada el ${formatDate(lastChange.createdAt, false)}` : "Cámbiala si es la temporal", tone: lastChange ? "ok" : "warn" },
    { icon: LifeBuoy, l: "Códigos de recuperación", v: `${remaining} de 10`, hint: lowCodes ? "Genera códigos nuevos" : "Disponibles", tone: lowCodes ? "warn" : "ok" },
    { icon: MonitorSmartphone, l: "Sesiones abiertas", v: String(sessions.length), hint: sessions.length === 1 ? "Solo este dispositivo" : "Revisa que todas sean tuyas", tone: "ok" },
  ] as const;

  return (
    <>
      <PageHeader title="Mi seguridad" description="Contraseña, verificación en dos pasos y accesos de tu cuenta del equipo." />

      <dl className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {summary.map(({ icon: Icon, l, v, hint, tone }) => (
          <div key={l} className="flex flex-col-reverse gap-3 rounded-[16px] border border-white/[0.07] bg-ink-850 p-4">
            <dt className="text-[12px] text-fg-subtle">
              {l}
              <span className={cn("mt-0.5 block text-[11.5px]", tone === "warn" ? "text-warn-400" : "text-fg-subtle/80")}>{hint}</span>
            </dt>
            <dd className="flex items-center gap-2.5">
              <span className={cn("grid size-9 shrink-0 place-items-center rounded-[10px]", tone === "warn" ? "bg-warn-400/12 text-warn-400" : "bg-ok-400/12 text-ok-400")}>
                <Icon className="size-[18px]" />
              </span>
              <span className="truncate font-display text-[18px] font-bold leading-tight">{v}</span>
            </dd>
          </div>
        ))}
      </dl>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Card icon={<Lock className="size-5" />} title="Cambiar contraseña" description="Usa una contraseña larga que no uses en otros sitios. Te pediremos la actual y un código de tu app de autenticación.">
          <ChangePassword />
        </Card>

        <div className="space-y-6">
          <Card
            icon={<Smartphone className="size-5" />}
            title="Códigos de recuperación"
            description="Sirven para entrar si pierdes el celular. Cada código funciona una sola vez."
            aside={<span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold tabular-nums ring-1", lowCodes ? "bg-warn-400/10 text-warn-400 ring-warn-400/25" : "bg-white/[0.05] text-fg ring-white/10")}>{remaining}/10</span>}
          >
            <div className="mb-4 grid grid-cols-10 gap-1" aria-hidden>
              {Array.from({ length: 10 }, (_, i) => (
                <span key={i} className={cn("h-1.5 rounded-full", i < remaining ? (lowCodes ? "bg-warn-400" : "bg-ok-400") : "bg-white/[0.08]")} />
              ))}
            </div>
            <RegenerateCodes />
          </Card>

          <Card icon={<Link2 className="size-5" />} title="Dirección secreta del panel" description="Guárdala en tus marcadores y compártela solo con tu equipo. Sin ella, /admin muestra «página no encontrada».">
            <div className="flex items-center gap-2 rounded-[12px] bg-ink-900/70 p-1.5 pl-3.5 ring-1 ring-white/[0.06]">
              <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-fg">{adminEntryUrl()}</span>
              <CopyButton value={adminEntryUrl()} />
            </div>
            <p className="mt-2.5 text-[12px] text-fg-subtle">Para cambiarla, edita ADMIN_PATH en el archivo .env del servidor y reinicia la tienda.</p>
          </Card>

          <Card icon={<MonitorSmartphone className="size-5" />} title="Sesiones abiertas" description="Dispositivos con acceso al panel. Cambiar la contraseña cierra todas menos la actual.">
            <ul className="-my-2 divide-y divide-white/[0.05]">
              {sessions.map((s, i) => {
                const d = device(s.userAgent);
                return (
                  <li key={s.id} className="flex items-center gap-3 py-3 text-[13px]" title={s.userAgent ?? undefined}>
                    <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-white/[0.05] text-fg-muted">
                      {d.mobile ? <Smartphone className="size-4" /> : <MonitorSmartphone className="size-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {d.os} · {d.browser}
                      </span>
                      <span className="block text-[12px] text-fg-subtle">Inició {formatDate(s.createdAt)}</span>
                    </span>
                    {i === 0 && <span className="shrink-0 rounded-full bg-ok-400/10 px-2 py-0.5 text-[11px] font-semibold text-ok-400 ring-1 ring-ok-400/25">Más reciente</span>}
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
