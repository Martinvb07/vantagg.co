import { KeyRound, Link2, MonitorSmartphone, ShieldCheck } from "lucide-react";
import { PageHeader, Panel } from "@/components/admin/ui";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/money";
import { adminEntryUrl } from "@/server/admin-gate";
import { ChangePassword } from "./change-password";
import { RegenerateCodes } from "./regenerate-codes";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mi seguridad" };

export default async function StaffSecurity() {
  const me = await requireStaff();
  const [user, sessions] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: me.id }, select: { totpEnabledAt: true, recoveryCodes: true } }),
    db.session.findMany({ where: { userId: me.id, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" }, select: { id: true, createdAt: true, userAgent: true } }),
  ]);
  const remaining = Array.isArray(user.recoveryCodes) ? user.recoveryCodes.length : 0;

  return (
    <>
      <PageHeader title="Mi seguridad" description="Tu acceso al panel: verificación en dos pasos, códigos de recuperación y dirección secreta." />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-2">
        <Panel title="Verificación en dos pasos">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-ok-400/12 text-ok-400">
              <ShieldCheck className="size-5" />
            </span>
            <div className="text-[13px]">
              <p className="font-semibold text-fg">Activa {user.totpEnabledAt ? `desde ${formatDate(user.totpEnabledAt, false)}` : ""}</p>
              <p className="mt-0.5 text-fg-muted">Cada ingreso al panel pide el código de tu app de autenticación. Es obligatoria para todo el equipo.</p>
            </div>
          </div>
          <div className="mt-5 border-t border-white/[0.06] pt-4">
            <p className="flex items-center gap-2 text-[13px]">
              <KeyRound className="size-4 text-fg-subtle" /> Códigos de recuperación disponibles:{" "}
              <strong className={remaining <= 2 ? "text-warn-400" : "text-fg"}>{remaining} de 10</strong>
            </p>
            <p className="mt-1 text-[12px] text-fg-subtle">Genera nuevos si gastaste varios o crees que alguien los vio. Los anteriores dejan de servir.</p>
            <RegenerateCodes />
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel title="Contraseña">
            <ChangePassword />
          </Panel>

          <Panel title="Dirección secreta del panel">
            <p className="flex items-start gap-2 text-[13px] text-fg-muted">
              <Link2 className="mt-0.5 size-4 shrink-0 text-fg-subtle" /> Guárdala en tus marcadores y compártela solo con tu equipo. Quien entre a /admin sin pasar por aquí verá «página no encontrada».
            </p>
            <p className="mt-3 select-all break-all rounded-lg bg-ink-900 px-3 py-2.5 font-mono text-[13px] ring-1 ring-white/10">{adminEntryUrl()}</p>
            <p className="mt-2 text-[12px] text-fg-subtle">Para cambiarla, edita ADMIN_PATH en el archivo .env y reinicia la tienda.</p>
          </Panel>

          <Panel title={`Sesiones abiertas (${sessions.length})`} bodyClass="p-0">
            <ul className="divide-y divide-white/[0.05]">
              {sessions.map((s) => (
                <li key={s.id} className="flex items-center gap-3 px-4 py-3 text-[13px]">
                  <MonitorSmartphone className="size-4 shrink-0 text-fg-subtle" />
                  <span className="min-w-0 flex-1 truncate text-fg-muted" title={s.userAgent ?? undefined}>
                    {s.userAgent?.match(/(Windows|Android|iPhone|Mac OS X|Linux)[^;)]*/)?.[0] ?? "Dispositivo"} · {s.userAgent?.match(/(Edg|Chrome|Firefox|Safari)\/[\d.]+/)?.[0]?.split("/")[0]?.replace("Edg", "Edge") ?? "Navegador"}
                  </span>
                  <span className="shrink-0 text-[12px] text-fg-subtle">{formatDate(s.createdAt)}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}
