import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Mail, MessageCircle, Search } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { PageHeader } from "@/components/admin/ui";
import { Badge } from "@/components/ui/primitives";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/money";
import { cn, whatsappLink } from "@/lib/utils";
import { replyTicketAction, ticketAction } from "@/app/actions/admin";
import { notificationsMissingConfig } from "@/server/notifications";
import { env } from "@/lib/env";
import { topicLabel } from "@/domain/support";

export const dynamic = "force-dynamic";
export const metadata = { title: "Soporte" };

const META = {
  OPEN: { l: "Abierta", t: "warning" },
  IN_PROGRESS: { l: "En curso", t: "info" },
  RESOLVED: { l: "Resuelta", t: "success" },
  CLOSED: { l: "Cerrada", t: "neutral" },
} as const;

const DELIVERY = {
  SENT: { l: "Enviada por correo", c: "text-ok-400" },
  SKIPPED: { l: "Guardada (correo sin configurar)", c: "text-warn-400" },
  FAILED: { l: "El correo falló", c: "text-bad-400" },
} as const;

const TABS = [
  { k: "pendientes", l: "Pendientes" },
  { k: "resueltas", l: "Resueltas" },
  { k: "todas", l: "Todas" },
] as const;

export default async function SupportAdmin({ searchParams }: { searchParams: Promise<{ v?: string; q?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const view = TABS.some((t) => t.k === sp.v) ? sp.v! : "pendientes";
  const q = sp.q?.trim().slice(0, 80);
  const statusWhere: Prisma.SupportTicketWhereInput =
    view === "pendientes"
      ? { OR: [{ status: { in: ["OPEN", "IN_PROGRESS"] } }, { status: { in: ["RESOLVED", "CLOSED"] }, updatedAt: { gte: new Date(Date.now() - 10 * 60_000) } }] }
      : view === "resueltas" ? { status: { in: ["RESOLVED", "CLOSED"] } } : {};
  const where: Prisma.SupportTicketWhereInput = { ...statusWhere, ...(q ? { OR: [{ email: { contains: q.toLowerCase() } }, { id: { endsWith: q.toLowerCase() } }, { order: { number: { contains: q.toUpperCase() } } }] } : {}) };

  const [tickets, pendingCount] = await Promise.all([
    db.supportTicket.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: { order: { select: { id: true, number: true, customerPhone: true } }, replies: { orderBy: { createdAt: "asc" } } },
      take: 100,
    }),
    db.supportTicket.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }),
  ]);
  const emailReady = env.notify.provider === "resend" && notificationsMissingConfig().length === 0;

  return (
    <>
      <PageHeader title="Soporte" description="Solicitudes del Centro de ayuda y de Mi cuenta. Respondes aquí: el cliente lo recibe por correo y, si tiene cuenta, también lo ve y contesta desde ella." />

      {!emailReady && (
        <p className="mb-4 rounded-lg border border-warn-400/25 bg-warn-400/[0.06] px-4 py-3 text-[13px] text-fg-muted">
          <strong className="text-warn-400">El correo no está configurado.</strong> Las respuestas se guardan, pero no le llegan al cliente. Configura Resend en{" "}
          <Link href="/admin/integraciones" className="underline">
            Integraciones
          </Link>{" "}
          o usa los botones de correo y WhatsApp de cada solicitud.
        </p>
      )}

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav className="flex gap-1 rounded-full bg-white/[0.04] p-1 ring-1 ring-white/[0.06]" aria-label="Filtro">
          {TABS.map((t) => (
            <Link key={t.k} href={`/admin/soporte?v=${t.k}${q ? `&q=${encodeURIComponent(q)}` : ""}`} className={cn("inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium", view === t.k ? "bg-white/[0.09] text-fg" : "text-fg-muted hover:text-fg")}>
              {t.l}
              {t.k === "pendientes" && pendingCount > 0 && <span className="rounded-full bg-warn-400/15 px-1.5 text-[11px] font-semibold text-warn-400">{pendingCount}</span>}
            </Link>
          ))}
        </nav>
        <form method="get" className="relative sm:w-80">
          <input type="hidden" name="v" value={view} />
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
          <input name="q" defaultValue={q} placeholder="Correo, número de pedido o #referencia" className="field h-9 pl-9 text-[13px]" aria-label="Buscar solicitudes" />
        </form>
      </div>

      {tickets.length === 0 ? (
        <div className="rounded-[14px] bg-ink-850 px-6 py-12 text-center ring-1 ring-white/[0.06]">
          <p className="text-[14px] font-semibold">{view === "pendientes" ? "No hay solicitudes pendientes" : "No hay solicitudes"}</p>
          <p className="mt-1 text-[13px] text-fg-muted">Las solicitudes del Centro de ayuda y de Mi cuenta aparecen aquí.</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {tickets.map((t) => {
            const ref = t.id.slice(-8).toUpperCase();
            const wa = whatsappLink(t.order?.customerPhone, `Hola, te escribimos sobre tu solicitud #${ref}.`);
            return (
              <li key={t.id} className="overflow-hidden rounded-[14px] bg-ink-850 ring-1 ring-white/[0.07]">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-white/[0.06] px-4 py-3 text-[13px]">
                  <Badge tone={META[t.status].t} dot>
                    {META[t.status].l}
                  </Badge>
                  <span className="font-mono text-[12px] text-fg-muted">#{ref}</span>
                  <span className="font-medium">{topicLabel(t.topic)}</span>
                  {t.userId && <Badge tone="info">Desde su cuenta</Badge>}
                  {t.order && (
                    <Link href={`/admin/pedidos/${t.order.id}`} className="font-mono text-[12.5px] text-volt-300 hover:underline">
                      {t.order.number}
                    </Link>
                  )}
                  <span className="ml-auto text-fg-subtle">
                    {t.email} · {formatDate(t.createdAt)}
                  </span>
                </div>

                <div className="space-y-3 px-4 py-4">
                  <div className="max-w-3xl rounded-[12px] rounded-tl-[4px] bg-ink-750 px-3.5 py-2.5 ring-1 ring-white/[0.05]">
                    <p className="mb-1 text-[11px] text-fg-subtle">
                      <span className="font-semibold uppercase tracking-wide">Cliente</span> · {formatDate(t.createdAt)}
                    </p>
                    <p className="whitespace-pre-line text-[13.5px] leading-relaxed">{t.message}</p>
                  </div>
                  {t.replies.map((r) =>
                    r.fromCustomer ? (
                      <div key={r.id} className="max-w-3xl rounded-[12px] rounded-tl-[4px] bg-ink-750 px-3.5 py-2.5 ring-1 ring-white/[0.05]">
                        <p className="mb-1 text-[11px] text-fg-subtle">
                          <span className="font-semibold uppercase tracking-wide">Cliente</span> · {formatDate(r.createdAt)}
                        </p>
                        <p className="whitespace-pre-line text-[13.5px] leading-relaxed">{r.body}</p>
                      </div>
                    ) : (
                    <div key={r.id} className="ml-auto max-w-3xl rounded-[12px] rounded-tr-[4px] bg-volt-400/[0.08] px-3.5 py-2.5 ring-1 ring-volt-400/20">
                      <p className="mb-1 flex flex-wrap items-center gap-x-2 text-[11px] text-fg-subtle">
                        <span className="font-semibold uppercase tracking-wide">{r.authorEmail}</span>· {formatDate(r.createdAt)} ·<span className={DELIVERY[r.delivery as keyof typeof DELIVERY]?.c}>{DELIVERY[r.delivery as keyof typeof DELIVERY]?.l ?? r.delivery}</span>
                      </p>
                      <p className="whitespace-pre-line text-[13.5px] leading-relaxed">{r.body}</p>
                    </div>
                    ),
                  )}
                </div>

                <div className="grid gap-3 border-t border-white/[0.06] px-4 py-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                  <ActionForm action={replyTicketAction} resetOnSuccess className="space-y-2">
                    <input type="hidden" name="id" value={t.id} />
                    <textarea name="body" required rows={2} maxLength={4000} placeholder={`Responder a ${t.email}…`} className="field text-[13.5px]" aria-label="Respuesta" />
                    <div className="flex flex-wrap items-center gap-3">
                      <SubmitButton size="sm">Responder</SubmitButton>
                      <label className="flex items-center gap-2 text-[12.5px] text-fg-muted">
                        <input type="checkbox" name="resolve" className="size-4 accent-[#c8f04f]" /> Marcar como resuelta
                      </label>
                    </div>
                  </ActionForm>
                  <div className="flex flex-wrap items-start gap-2 lg:flex-col lg:items-end">
                    <a href={`mailto:${t.email}?subject=${encodeURIComponent(`Tu solicitud #${ref}`)}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-white/[0.05] px-3 text-[12.5px] text-fg-muted ring-1 ring-white/[0.08] hover:text-fg">
                      <Mail className="size-3.5" /> Correo
                    </a>
                    {wa && (
                      <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-green-500/10 px-3 text-[12.5px] text-green-400 ring-1 ring-green-500/25 hover:ring-green-500/50">
                        <MessageCircle className="size-3.5" /> WhatsApp
                      </a>
                    )}
                    <ActionForm action={ticketAction} hideMessage className="flex items-center gap-1.5">
                      <input type="hidden" name="id" value={t.id} />
                      <select name="status" defaultValue={t.status} className="field h-8 w-auto py-1 text-[12.5px]" aria-label="Estado">
                        {Object.entries(META).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v.l}
                          </option>
                        ))}
                      </select>
                      <SubmitButton size="sm" variant="ghost">
                        Guardar
                      </SubmitButton>
                    </ActionForm>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
