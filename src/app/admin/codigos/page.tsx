import type { PromoCode } from "@prisma/client";
import { ActionForm, ConfirmSubmit, SubmitButton } from "@/components/admin/action-form";
import { Check, Field, PageHeader, Panel } from "@/components/admin/ui";
import { Badge, DemoBadge } from "@/components/ui/primitives";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatMoney } from "@/lib/money";
import { promoCodeAction, savePromoCodeAction } from "@/app/actions/admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Descuentos" };

const SCOPE = { ALL: "Todo", TOPUP: "Recargas", ACCOUNT: "Cuentas" } as const;

/** Date → "YYYY-MM-DDTHH:mm" en hora de Colombia para inputs datetime-local. */
const toLocal = (d: Date | null) => (d ? new Date(d.getTime() - 5 * 3600_000).toISOString().slice(0, 16) : "");

function statusOf(p: PromoCode, now: Date): { label: string; tone: "success" | "info" | "neutral" | "warning" } {
  if (!p.active) return { label: "Inactivo", tone: "neutral" };
  if (p.startsAt && p.startsAt > now) return { label: "Programado", tone: "info" };
  if (p.endsAt && p.endsAt <= now) return { label: "Vencido", tone: "neutral" };
  if (p.maxUses != null && p.uses >= p.maxUses) return { label: "Agotado", tone: "warning" };
  return { label: "Vigente", tone: "success" };
}

export default async function PromoCodesAdmin() {
  await requireAdmin();
  const now = new Date();
  const codes = await db.promoCode.findMany({ orderBy: [{ active: "desc" }, { createdAt: "desc" }] });
  const stats = await db.promoRedemption.groupBy({
    by: ["promoCodeId"],
    where: { status: "CONFIRMED" },
    _count: true,
    _sum: { discount: true },
  });
  const statOf = (id: string) => stats.find((s) => s.promoCodeId === id);

  return (
    <>
      <PageHeader
        title="Descuentos"
        description="Tus ofertas especiales. El cliente escribe el código en el checkout; el descuento se valida y calcula solo en el servidor."
      />

      <div className="space-y-3">
        {codes.length === 0 && <p className="text-sm text-fg-muted">Aún no hay códigos. Crea el primero abajo.</p>}
        {codes.map((p) => {
          const st = statusOf(p, now);
          const conf = statOf(p.id);
          return (
            <details key={p.id} className="rounded-[12px] border border-white/[0.07] bg-ink-850 open:border-white/14">
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 text-[13px] [&::-webkit-details-marker]:hidden">
                <span className="font-mono text-[15px] font-semibold tracking-wider">{p.code}</span>
                <span className="font-semibold text-volt-300">{p.discountType === "PERCENT" ? `−${p.value}%` : `−${formatMoney(p.value)}`}</span>
                <Badge tone={st.tone} dot>
                  {st.label}
                </Badge>
                <span className="text-fg-muted">{SCOPE[p.scope]}</span>
                <span className="tabular-nums text-fg-muted">
                  {p.uses}
                  {p.maxUses != null ? ` / ${p.maxUses}` : ""} usos
                </span>
                {conf && <span className="text-fg-subtle">{conf._count} pagados · −{formatMoney(conf._sum.discount ?? 0)}</span>}
                {p.isDemo && <DemoBadge />}
                <span className="ml-auto text-fg-subtle">{p.endsAt ? `Hasta ${formatDate(p.endsAt)}` : "Sin vencimiento"} · Editar ▾</span>
              </summary>
              <div className="border-t border-white/[0.06] p-4">
                <PromoForm p={p} />
                <div className="mt-4 flex flex-wrap gap-2 border-t border-white/[0.06] pt-4">
                  <ActionForm action={promoCodeAction}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="op" value="toggle" />
                    <SubmitButton size="sm" variant="secondary">
                      {p.active ? "Desactivar" : "Activar"}
                    </SubmitButton>
                  </ActionForm>
                  <ActionForm action={promoCodeAction}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="op" value="delete" />
                    <ConfirmSubmit confirmText="Confirmar eliminación">Eliminar</ConfirmSubmit>
                  </ActionForm>
                </div>
              </div>
            </details>
          );
        })}
      </div>

      <Panel title="Nuevo código" className="mt-8">
        <PromoForm />
      </Panel>
    </>
  );
}

function PromoForm({ p }: { p?: PromoCode }) {
  return (
    <ActionForm action={savePromoCodeAction} resetOnSuccess={!p}>
      {p && <input type="hidden" name="id" value={p.id} />}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Código" hint="Letras, números y guiones. Ej. BIENVENIDA10">
          <input name="code" required minLength={4} maxLength={32} defaultValue={p?.code} className="field font-mono uppercase tracking-wider" autoComplete="off" />
        </Field>
        <Field label="Tipo">
          <select name="discountType" defaultValue={p?.discountType ?? "PERCENT"} className="field">
            <option value="PERCENT">Porcentaje (%)</option>
            <option value="FIXED">Valor fijo (COP)</option>
          </select>
        </Field>
        <Field label="Valor" hint="% (1–90) o pesos">
          <input name="value" type="number" min={1} required defaultValue={p?.value} className="field" />
        </Field>
        <Field label="Tope de descuento (opcional)" hint="Solo para %. Máximo en pesos.">
          <input name="maxDiscount" type="number" min={0} step={100} defaultValue={p?.maxDiscount ?? ""} className="field" />
        </Field>
        <Field label="Aplica a">
          <select name="scope" defaultValue={p?.scope ?? "ALL"} className="field">
            <option value="ALL">Recargas y cuentas</option>
            <option value="TOPUP">Solo recargas</option>
            <option value="ACCOUNT">Solo cuentas</option>
          </select>
        </Field>
        <Field label="Compra mínima (opcional)">
          <input name="minSubtotal" type="number" min={0} step={100} defaultValue={p?.minSubtotal ?? ""} className="field" />
        </Field>
        <Field label="Usos totales (opcional)" hint="Vacío = ilimitado">
          <input name="maxUses" type="number" min={1} defaultValue={p?.maxUses ?? ""} className="field" />
        </Field>
        <Field label="Usos por cliente" hint="Por correo electrónico">
          <input name="maxUsesPerEmail" type="number" min={1} required defaultValue={p?.maxUsesPerEmail ?? 1} className="field" />
        </Field>
        <Field label="Inicio (opcional, hora Colombia)">
          <input name="startsAt" type="datetime-local" defaultValue={toLocal(p?.startsAt ?? null)} className="field" />
        </Field>
        <Field label="Fin (opcional, hora Colombia)">
          <input name="endsAt" type="datetime-local" defaultValue={toLocal(p?.endsAt ?? null)} className="field" />
        </Field>
        <Field label="Nota interna (opcional)" className="sm:col-span-2">
          <input name="description" maxLength={255} defaultValue={p?.description ?? ""} placeholder="Ej. Campaña Instagram octubre" className="field" />
        </Field>
      </div>
      <div className="mt-4 flex flex-wrap gap-6">
        <Check name="active" label="Activo" defaultChecked={p?.active ?? true} />
      </div>
      <div className="mt-4">
        <SubmitButton size="sm">{p ? "Guardar cambios" : "Crear código"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
