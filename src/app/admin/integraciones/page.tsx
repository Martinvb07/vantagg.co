import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { PageHeader } from "@/components/admin/ui";
import { Badge } from "@/components/ui/primitives";
import { requireAdmin } from "@/lib/auth";
import { env, isProduction } from "@/lib/env";
import { formatDate } from "@/lib/money";
import { cn } from "@/lib/utils";
import { testIntegrationAction } from "@/app/actions/admin";
import { getIntegrationOverview } from "@/server/integrations/status";

export const dynamic = "force-dynamic";
export const metadata = { title: "Integraciones" };

export default async function IntegrationsAdmin() {
  await requireAdmin();
  const cards = await getIntegrationOverview();
  const groups = ["Pagos", "Recargas", "Notificaciones", "Acceso", "Almacenamiento"] as const;

  return (
    <>
      <PageHeader
        title="Integraciones"
        description={
          <>
            Las credenciales se configuran solo como variables de entorno del servidor; aquí se muestran enmascaradas. Entorno:{" "}
            <strong className="text-fg">{isProduction ? "producción" : "desarrollo"}</strong>.
          </>
        }
      />
      <div className="mb-6 rounded-[12px] border border-white/[0.07] bg-ink-850 p-4 text-[13px] text-fg-muted">
        <p>
          <strong className="text-fg">PAYMENT_PROVIDER</strong> = <span className="font-mono">{env.paymentProviders.join(",") || "(vacío)"}</span> ·{" "}
          <strong className="text-fg">TOPUP_PROVIDER</strong> = <span className="font-mono">{env.topup.provider || "(vacío)"}</span> ·{" "}
          <strong className="text-fg">APP_URL</strong> = <span className="break-all font-mono">{env.appUrl}</span>
        </p>
        <p className="mt-1.5">Tras cambiar variables de entorno reinicia o vuelve a desplegar la aplicación. Una integración permanece desactivada hasta que todas sus variables estén presentes.</p>
      </div>

      {groups.map((g) => (
        <section key={g} className="mb-8">
          <h2 className="eyebrow mb-3">{g}</h2>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
            {cards
              .filter((c) => c.group === g)
              .map((c) => (
                <article key={c.key} className={cn("rounded-[12px] border bg-ink-850 p-4", c.active ? "border-ok-400/25" : "border-white/[0.07]")}>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{c.name}</h3>
                    <Badge tone={c.active ? "success" : c.selected ? "warning" : "neutral"} dot>
                      {c.active ? "Activa" : c.selected ? "Integración pendiente" : "No seleccionada"}
                    </Badge>
                    <span className="ml-auto text-[12px] text-fg-subtle">Modo: {c.mode}</span>
                  </div>
                  {c.note && <p className="mt-2 text-[12.5px] text-fg-muted">{c.note}</p>}

                  {c.values.length > 0 && (
                    <dl className="mt-3 grid gap-1 rounded-lg bg-ink-900 p-3 font-mono text-[11.5px]">
                      {c.values.map((v) => (
                        <div key={v.name} className="flex flex-wrap justify-between gap-x-3">
                          <dt className="text-fg-subtle">{v.name}</dt>
                          <dd className={cn("min-w-0 break-all", v.value ? "text-fg" : "text-warn-400")}>{v.value ?? "sin configurar"}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                  {c.missing.length > 0 && c.selected && <p className="mt-2 text-[12px] text-warn-400">Falta: {c.missing.join(", ")}</p>}
                  {c.redirectUrl && (
                    <p className="mt-2 text-[12px] text-fg-muted">
                      URI de redirección autorizada: <span className="select-all break-all font-mono text-fg">{c.redirectUrl}</span>
                    </p>
                  )}
                  {c.webhookUrl && (
                    <p className="mt-2 text-[12px] text-fg-muted">
                      URL de webhook: <span className="select-all break-all font-mono text-fg">{c.webhookUrl}</span>
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-3 text-[12px] text-fg-subtle">
                    <span>
                      Última verificación: {c.lastCheckAt ? formatDate(c.lastCheckAt) : "nunca"}
                      {c.lastOkAt && <> · Última conexión correcta: {formatDate(c.lastOkAt)}</>}
                      {c.lastError && <span className="block text-bad-400">Último error: {c.lastError}</span>}
                    </span>
                    <ActionForm action={testIntegrationAction}>
                      <input type="hidden" name="key" value={c.key} />
                      <SubmitButton size="sm" variant="secondary">
                        Probar conexión
                      </SubmitButton>
                    </ActionForm>
                  </div>
                </article>
              ))}
          </div>
        </section>
      ))}
    </>
  );
}
