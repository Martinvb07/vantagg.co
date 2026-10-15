import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { Check, Field, PageHeader, Panel } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/server/settings";
import { db } from "@/lib/db";
import { saveSettingsAction } from "@/app/actions/admin";
import { PAYMENT_METHODS, parsePaymentMethods } from "@/domain/payment-methods";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ajustes de la tienda" };

export default async function SettingsAdmin() {
  await requireAdmin();
  const [s, publicAccounts] = await Promise.all([getSettings(), db.accountListing.count({ where: { status: { in: ["PUBLISHED", "RESERVED"] } } })]);
  return (
    <>
      <PageHeader title="Ajustes de la tienda" description="Marca, datos de la empresa y canales de contacto. Los campos vacíos no se muestran en la tienda." />
      <ActionForm action={saveSettingsAction} className="max-w-3xl space-y-6">
        <Panel title="Marca">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre de la tienda">
              <input name="storeName" required defaultValue={s.storeName} className="field" />
            </Field>
            <Field label="Lema corto">
              <input name="storeTagline" defaultValue={s.storeTagline} className="field" />
            </Field>
            <Field label="URL del logotipo (opcional)" hint="Si está vacío se usa el logotipo tipográfico.">
              <input name="logoUrl" defaultValue={s.logoUrl} placeholder="https://… o /logo.svg" className="field" />
            </Field>
            <Field label="Prefijo de pedidos" hint="2–6 caracteres en mayúsculas. Ej. VX → VX-7K2M-9QHT">
              <input name="orderPrefix" defaultValue={s.orderPrefix} maxLength={6} className="field font-mono uppercase" />
            </Field>
            <Field label="Anuncio superior (opcional)" className="sm:col-span-2">
              <input name="announcement" defaultValue={s.announcement} maxLength={180} className="field" />
            </Field>
          </div>
        </Panel>

        <Panel title="Empresa">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Razón social">
              <input name="legalName" defaultValue={s.legalName} className="field" />
            </Field>
            <Field label="NIT">
              <input name="taxId" defaultValue={s.taxId} className="field" />
            </Field>
            <Field label="Ciudad">
              <input name="city" defaultValue={s.city} className="field" />
            </Field>
            <Field label="Dirección (opcional)">
              <input name="address" defaultValue={s.address} className="field" />
            </Field>
          </div>
        </Panel>

        <Panel title="Contacto y soporte">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="WhatsApp" hint="Con indicativo, solo números. Ej. 573001234567">
              <input name="whatsapp" defaultValue={s.whatsapp} inputMode="tel" className="field font-mono" />
            </Field>
            <Field label="Instagram" hint="URL completa">
              <input name="instagram" defaultValue={s.instagram} placeholder="https://instagram.com/tutienda" className="field" />
            </Field>
            <Field label="Correo de soporte" hint="Se muestra a los clientes y recibe sus respuestas.">
              <input name="supportEmail" type="email" defaultValue={s.supportEmail} className="field" />
            </Field>
            <Field label="Correo para avisos internos" hint="No se muestra en la tienda. Aquí llegan: cuenta vendida, chats, soporte, reclamos y recargas detenidas.">
              <input name="staffAlertEmail" type="email" defaultValue={s.staffAlertEmail} placeholder="Si lo dejas vacío, se usa el de soporte" className="field" />
            </Field>
            <Field label="Horario de atención">
              <input name="supportHours" defaultValue={s.supportHours} placeholder="Lun a sáb, 9:00 a 20:00" className="field" />
            </Field>
          </div>
          <div className="mt-4">
            <Check name="showGarenaDisclaimer" label="Mostrar aviso de independencia respecto de Garena en el pie de página" defaultChecked={s.showGarenaDisclaimer === "true"} />
          </div>
        </Panel>

        <Panel title="Medios de pago visibles">
          <p className="mb-3 text-[12.5px] text-fg-muted">Se muestran al cliente en el checkout, la ficha y el pie de página. Activa solo los que tu pasarela realmente procesa.</p>
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            {PAYMENT_METHODS.map((m) => (
              <Check key={m.id} name="paymentMethods" value={m.id} label={m.label} defaultChecked={parsePaymentMethods(s.paymentMethods).includes(m.id)} />
            ))}
          </div>
        </Panel>

        <Panel title="Sección de cuentas">
          <p className="mb-3 text-[12.5px] text-fg-muted">
            Controla si la tienda muestra la venta de cuentas (menú, inicio, buscador y catálogo). Ahora hay {publicAccounts} cuenta(s) publicada(s).
          </p>
          <Field label="Mostrar la sección de cuentas" hint="En «Automático» aparece sola cuando publicas la primera cuenta; así nunca se ve un catálogo vacío.">
            <select name="accountsMode" defaultValue={s.accountsMode || "auto"} className="field">
              <option value="auto">Automático (solo si hay cuentas publicadas)</option>
              <option value="on">Siempre</option>
              <option value="off">Nunca (solo diamantes)</option>
            </select>
          </Field>
        </Panel>

        <SubmitButton>Guardar ajustes</SubmitButton>
      </ActionForm>
    </>
  );
}
