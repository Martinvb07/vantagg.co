import Link from "next/link";
import { ExternalLink, MailCheck, MailWarning } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { PageHeader, Panel, Table } from "@/components/admin/ui";
import { Badge } from "@/components/ui/primitives";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { formatDate } from "@/lib/money";
import { cn } from "@/lib/utils";
import { sendTestEmailAction } from "@/app/actions/admin";
import { EMAIL_PREVIEWS } from "@/server/email-previews";
import { emailReady, notificationsMissingConfig } from "@/server/notifications";
import { getSettings } from "@/server/settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Correos" };

const STATUS = {
  SENT: { l: "Enviado", t: "success" },
  SKIPPED: { l: "Sin enviar", t: "warning" },
  FAILED: { l: "Falló", t: "danger" },
} as const;

const TEMPLATE_LABEL: Record<string, string> = {
  login_code: "Código para ingresar",
  verify_code: "Verificar correo",
  password_reset: "Recuperar contraseña",
  welcome: "Bienvenida",
  order_created: "Pedido creado",
  payment_confirmed: "Pago confirmado",
  delivered: "Entregado",
  delivery_failed: "Problema de entrega",
  refunded: "Reembolso",
  cancelled: "Cancelado",
  chat_message: "Mensaje en el chat",
  support_reply: "Respuesta de soporte",
  staff_account_sold: "Aviso: cuenta vendida",
  staff_ticket: "Aviso: nueva solicitud",
  password_changed: "Contraseña cambiada",
  ticket_received: "Solicitud recibida",
  claim_received: "Reclamo recibido",
  staff_chat: "Aviso: mensaje del cliente",
  staff_claim: "Aviso: reclamo de cuenta",
  staff_delivery_issue: "Aviso: recarga detenida",
  staff_login: "Seguridad: ingreso al panel",
  staff_2fa_enabled: "Seguridad: 2FA activado",
  staff_2fa_reset: "Seguridad: 2FA restablecido",
  staff_recovery_regenerated: "Seguridad: códigos nuevos",
  test: "Prueba",
};

export default async function EmailsAdmin({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  const user = await requireAdmin();
  const { estado } = await searchParams;
  const filter = estado && estado in STATUS ? estado : undefined;
  const [logs, counts, settings] = await Promise.all([
    db.emailLog.findMany({ where: filter ? { status: filter } : {}, orderBy: { createdAt: "desc" }, take: 150 }),
    db.emailLog.groupBy({ by: ["status"], _count: { _all: true }, where: { createdAt: { gte: new Date(Date.now() - 7 * 86_400_000) } }, orderBy: { status: "asc" } }),
    getSettings(),
  ]);
  const ready = emailReady();
  const count = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0;
  const groups = [...new Set(EMAIL_PREVIEWS.map((p) => p.group))];

  return (
    <>
      <PageHeader title="Correos" description="Códigos, recuperación de contraseña, pedidos, soporte y avisos. Revisa cómo se ven y si están llegando." />

      <div className={cn("mb-6 flex flex-col gap-3 rounded-[14px] p-4 ring-1 sm:flex-row sm:items-center", ready ? "bg-ok-400/[0.06] ring-ok-400/20" : "bg-warn-400/[0.06] ring-warn-400/25")}>
        {ready ? <MailCheck className="size-6 shrink-0 text-ok-400" /> : <MailWarning className="size-6 shrink-0 text-warn-400" />}
        <div className="min-w-0 flex-1 text-[13px]">
          {ready ? (
            <p>
              <strong>Correo activo</strong> con {env.notify.provider === "smtp" ? `SMTP (${env.notify.smtp.host})` : "Resend"} · remitente <span className="font-mono">{env.notify.fromEmail}</span>
            </p>
          ) : null}
          {ready && env.notify.onlyTo.length > 0 ? (
            <p className="mt-1 text-warn-400">
              <strong>Modo prueba:</strong> solo se envía a {env.notify.onlyTo.length === 1 ? "tu correo" : `${env.notify.onlyTo.length} correos autorizados`}. Los demás quedan como «no enviado». Verifica tu dominio en Resend y quita NOTIFY_ONLY_TO del .env para enviar a todos los clientes.
            </p>
          ) : null}
          {ready ? null : (
            <p>
              <strong className="text-warn-400">El correo no está configurado:</strong> los clientes no reciben códigos, enlaces de recuperación ni avisos. Falta: {notificationsMissingConfig().join(", ") || "NOTIFY_PROVIDER (resend o smtp)"}.{" "}
              <Link href="/admin/integraciones" className="underline">
                Ver Integraciones
              </Link>
            </p>
          )}
          <p className="mt-1 text-fg-muted">
            Avisos al equipo van a:{" "}
            {settings.staffAlertEmail || settings.supportEmail ? (
              <span className="text-fg">{settings.staffAlertEmail || settings.supportEmail}</span>
            ) : (
              <Link href="/admin/ajustes" className="text-warn-400 underline">
                define el correo para avisos internos en Ajustes
              </Link>
            )}
          </p>
        </div>
        <ActionForm action={sendTestEmailAction} className="flex shrink-0 flex-wrap items-center gap-2">
          <input name="to" type="email" defaultValue={user.email} className="field h-9 w-60 text-[13px]" aria-label="Enviar prueba a" />
          <SubmitButton size="sm" variant="secondary">
            Enviar prueba
          </SubmitButton>
        </ActionForm>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 min-[480px]:grid-cols-3">
        {(Object.keys(STATUS) as Array<keyof typeof STATUS>).map((s) => (
          <Link key={s} href={filter === s ? "/admin/correos" : `/admin/correos?estado=${s}`} className={cn("rounded-[12px] border bg-ink-850 p-4 transition hover:border-white/15", filter === s ? "border-white/25" : "border-white/[0.07]")}>
            <p className="text-[12px] text-fg-muted">{STATUS[s].l} · 7 días</p>
            <p className={cn("mt-1 font-display text-2xl font-semibold tabular-nums", s === "FAILED" && count(s) > 0 && "text-bad-400", s === "SKIPPED" && count(s) > 0 && "text-warn-400")}>{count(s)}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div>
          <h2 className="eyebrow mb-3">Historial{filter ? ` · ${STATUS[filter as keyof typeof STATUS].l}` : ""}</h2>
          <Table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Para</th>
                <th>Correo</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-fg-muted">
                    Aún no se han enviado correos.
                  </td>
                </tr>
              )}
              {logs.map((l) => (
                <tr key={l.id}>
                  <td className="whitespace-nowrap text-fg-muted">{formatDate(l.createdAt)}</td>
                  <td className="max-w-[200px] truncate">{l.to}</td>
                  <td>
                    <span className="block text-[13px]">{TEMPLATE_LABEL[l.template] ?? l.template}</span>
                    <span className="block max-w-[260px] truncate text-[11.5px] text-fg-subtle">{l.subject}</span>
                  </td>
                  <td>
                    <Badge tone={STATUS[l.status as keyof typeof STATUS]?.t ?? "neutral"}>{STATUS[l.status as keyof typeof STATUS]?.l ?? l.status}</Badge>
                    {l.error && l.status === "FAILED" && <span className="mt-1 block max-w-[220px] truncate text-[11px] text-bad-400" title={l.error}>{l.error}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>

        <Panel title="Plantillas" bodyClass="p-0">
          {groups.map((g) => (
            <div key={g} className="border-b border-white/[0.05] last:border-0">
              <p className="px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-subtle">{g}</p>
              <ul>
                {EMAIL_PREVIEWS.filter((p) => p.group === g).map((p) => (
                  <li key={p.key}>
                    <a href={`/api/admin/email-preview?t=${p.key}`} target="_blank" rel="noopener" className="flex items-center justify-between gap-3 px-4 py-2.5 text-[13px] hover:bg-white/[0.03]">
                      {p.label}
                      <span className="inline-flex items-center gap-1 text-[12px] text-fg-muted">
                        Ver <ExternalLink className="size-3.5" />
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </Panel>
      </div>
    </>
  );
}
