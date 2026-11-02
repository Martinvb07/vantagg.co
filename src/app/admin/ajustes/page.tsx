import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { Check, Field, PageHeader, Panel } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/server/settings";
import { db } from "@/lib/db";
import { saveSettingsAction } from "@/app/actions/admin";
import { PAYMENT_METHODS, parsePaymentMethods } from "@/domain/payment-methods";
import { MAINTENANCE_DEFAULT_MESSAGE } from "@/domain/maintenance";
import { marketingStats } from "@/server/marketing";
import { purgeCancelledOrders } from "@/server/retention";
import { blockedAttempts } from "@/server/order-limits";
import { getFx } from "@/server/fx";
import { getPaymentProvider } from "@/server/integrations/payments";
import { formatCharge } from "@/lib/money";
import { usdPriceCents } from "@/domain/market";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ajustes de la tienda" };

export default async function SettingsAdmin() {
  await requireAdmin();
  const [s, publicAccounts, stats, purge, blocked, fx] = await Promise.all([getSettings(), db.accountListing.count({ where: { status: { in: ["PUBLISHED", "RESERVED"] } } }), marketingStats(), purgeCancelledOrders({ dryRun: true }), blockedAttempts(), getFx()]);
  const epaycoReady = !!getPaymentProvider("epayco")?.isEnabled();
  const copPerUsd = fx?.rates.COP ?? null;
  const surcharge = s.foreignSurchargePct === "" || !Number.isFinite(Number(s.foreignSurchargePct)) ? 5 : Number(s.foreignSurchargePct);
  return (
    <>
      <PageHeader title="Ajustes de la tienda" description="Marca, datos de la empresa y canales de contacto. Los campos vacíos no se muestran en la tienda." />
      <ActionForm action={saveSettingsAction} className="max-w-3xl space-y-6">
        <Panel title="Modo mantenimiento">
          <p className="mb-3 text-[12.5px] text-fg-muted">
            La tienda se sigue viendo, pero no acepta compras nuevas ni pagos de pedidos pendientes. Los pedidos ya pagados se siguen entregando. Úsalo cuando el proveedor no pueda entregar.
          </p>
          <Check name="maintenanceMode" label="Activar el modo mantenimiento (pausar las ventas)" defaultChecked={s.maintenanceMode === "true"} />
          <Field label="Mensaje para los clientes (opcional)" hint={`Si está vacío: «${MAINTENANCE_DEFAULT_MESSAGE}»`} className="mt-4">
            <input name="maintenanceMessage" defaultValue={s.maintenanceMessage} maxLength={240} className="field" />
          </Field>
        </Panel>

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

        <Panel title="Correos automáticos">
          <p className="mb-4 text-[12.5px] text-fg-muted">
            Salen solos entre 8 a. m. y 9 p. m. Las ofertas solo llegan a quien aceptó recibirlas (al registrarse o en Mi cuenta), máximo una por semana y siempre con «Darte de baja».
          </p>
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ["Aceptan ofertas", `${stats.optedIn} · ${stats.optedInUsers} con cuenta, ${stats.contacts} sin cuenta`],
              ["Comprar de nuevo (7 días)", stats.last7.recovery],
              ["Primera recarga (7 días)", stats.last7.firstPurchase],
              ["Te extrañamos (7 días)", stats.last7.winback],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg bg-ink-900 px-3 py-2.5 ring-1 ring-white/[0.06]">
                <p className="text-[18px] font-bold tabular-nums">{v}</p>
                <p className="text-[11.5px] leading-tight text-fg-subtle">{k}</p>
              </div>
            ))}
          </div>
          <div className="space-y-3">
            <Check name="autoRecovery" label="«¿Aún quieres tus diamantes?» 1 hora después de que un pedido vence sin pagar (es sobre su propio pedido: uno por pedido, no a quien se dio de baja)" defaultChecked={s.autoRecovery === "true"} />
            <Check name="mktFirstPurchase" label="«Tu primera recarga te espera» a registrados que aún no compran (un día después de registrarse, una vez)" defaultChecked={s.mktFirstPurchase === "true"} />
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="«¿Te quedaste sin diamantes?»" hint="A quien lleva ese tiempo sin comprar. Una vez por cada racha sin compras.">
              <select name="mktWinbackDays" defaultValue={s.mktWinbackDays || "21"} className="field">
                <option value="0">Apagado</option>
                {["14", "21", "30", "45", "60"].map((d) => (
                  <option key={d} value={d}>
                    A los {d} días sin comprar
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Código de descuento en las ofertas (opcional)" hint="Créalo en Descuentos; aparece grande en «primera recarga» y «te extrañamos».">
              <input name="marketingPromoCode" defaultValue={s.marketingPromoCode} placeholder="VUELVE10" className="field font-mono uppercase" />
            </Field>
          </div>
        </Panel>

        <Panel title="Pedidos cancelados">
          <p className="mb-3 text-[12.5px] text-fg-muted">
            Los pedidos que vencieron sin pagar se borran solos para que no llenen el historial: 24 horas después del correo «¿Aún quieres tus diamantes?», o 2 días después de cancelarse si no les tocaba correo. Los clientes no se borran: las cuentas y los contactos que aceptaron ofertas siguen recibiendo correos.
          </p>
          <Check name="purgeCancelled" label="Borrar los pedidos cancelados sin pago" defaultChecked={s.purgeCancelled === "true"} />
          <p className="mt-3 rounded-lg bg-ink-900 px-3 py-2.5 text-[12.5px] text-fg-muted ring-1 ring-white/[0.06]">
            {purge.due ? `Ahora mismo hay ${purge.due} pedido(s) cancelado(s) listos para borrar.` : "No hay pedidos cancelados para borrar ahora."}
            {purge.kept ? ` ${purge.kept} cancelado(s) se conservan porque tienen cobro, entrega, chat, notas o soporte.` : ""} Nunca se borran pedidos pagados ni con dinero de por medio.
          </p>
        </Panel>

        <Panel title="Límites contra pedidos falsos">
          <p className="mb-3 text-[12.5px] text-fg-muted">
            Frena a quien hace muchos pedidos y no paga. Se cuenta por correo (los alias tipo «nombre+1@gmail.com» cuentan como el mismo) y por ID de jugador. Quien paga no se ve afectado. Además, cada conexión puede crear como máximo 8 pedidos cada 10 minutos.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Pedidos esperando pago a la vez" hint="Al llegar al límite, el cliente debe pagar uno o esperar a que venza (1 hora). Cuentas en venta: siempre 1.">
              <select name="orderLimitOpen" defaultValue={s.orderLimitOpen || "2"} className="field">
                {[["1", "1"], ["2", "2 (recomendado)"], ["3", "3"], ["5", "5"], ["0", "Sin límite"]].map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Pedidos sin pagar en 24 horas" hint="Al llegar al límite, no puede crear más hasta que pasen 24 h desde el primero.">
              <select name="orderLimitUnpaid" defaultValue={s.orderLimitUnpaid || "5"} className="field">
                {[["3", "3"], ["5", "5 (recomendado)"], ["10", "10"], ["20", "20"], ["0", "Sin límite"]].map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <p className="mt-3 rounded-lg bg-ink-900 px-3 py-2.5 text-[12.5px] text-fg-muted ring-1 ring-white/[0.06]">
            {blocked ? `En las últimas 24 horas se frenaron ${blocked} intento(s) de crear pedidos (quedan en Historial de cambios).` : "En las últimas 24 horas no se frenó ningún intento."}
          </p>
        </Panel>

        <Panel title="Precios fuera de Colombia">
          <p className="mb-3 text-[12.5px] text-fg-muted">
            La tienda detecta el país de cada visitante. En Colombia todo sigue en pesos. A quien está en otro país se le muestra el precio en dólares (con el recargo) y en su moneda como referencia. Con «Cobrar en dólares», ePayco le cobra ese precio en US$; Bold siempre cobra en pesos.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Cobro a clientes de otros países" hint={epaycoReady ? "ePayco está conectado: puede cobrar en dólares." : "Para cobrar en dólares hace falta ePayco conectado (Integraciones). Mientras tanto se cobra en pesos."}>
              <select name="foreignPricing" defaultValue={s.foreignPricing === "usd" ? "usd" : "reference"} className="field">
                <option value="reference">En pesos (el precio en dólares solo como referencia)</option>
                <option value="usd">Cobrar en dólares con ePayco</option>
              </select>
            </Field>
            <Field label="Recargo para otros países (%)" hint="Cubre la comisión de tarjetas internacionales y la variación del dólar. Recomendado: 5 %.">
              <select name="foreignSurchargePct" defaultValue={String(surcharge)} className="field">
                {["0", "3", "5", "7", "10", "15"].map((v) => (
                  <option key={v} value={v}>
                    {v === "5" ? "5 % (recomendado)" : `${v} %`}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <p className="mt-3 rounded-lg bg-ink-900 px-3 py-2.5 text-[12.5px] text-fg-muted ring-1 ring-white/[0.06]">
            {copPerUsd
              ? `Dólar de hoy: ${new Intl.NumberFormat("es-CO").format(Math.round(copPerUsd))} pesos. Ejemplo: un paquete de $20.000 se muestra a ${formatCharge(usdPriceCents(20000, copPerUsd, surcharge), "USD")} fuera de Colombia.`
              : "Todavía no hay tasa del dólar: se actualiza sola cada 12 horas."}
            {s.foreignPricing === "usd" && !epaycoReady ? " Ahora se cobra en pesos porque ePayco no está conectado." : ""}
          </p>
        </Panel>

        <Panel title="Publicidad (Meta Pixel y Google)">
          <p className="mb-3 text-[12.5px] text-fg-muted">
            Para medir tus campañas: registran visitas, inicios de compra y compras pagadas (con su valor). Los clientes eligen en el aviso de cookies si aceptan las de publicidad; sin su permiso no se envía nada a Meta y Google no guarda cookies. Deja vacío lo que no uses.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="ID del píxel de Meta (Facebook e Instagram)" hint="Administrador de eventos → Orígenes de datos → tu píxel → Configuración → «Identificador del conjunto de datos». Solo el número." className="sm:col-span-2">
              <input name="metaPixelId" defaultValue={s.metaPixelId} inputMode="numeric" placeholder="123456789012345" className="field font-mono" />
            </Field>
            <Field label="ID de la etiqueta de Google" hint="Google Ads → Herramientas → Configuración de la etiqueta de Google: AW-123456789. Si también usas Analytics, agrega su G-… separado por coma.">
              <input name="googleTagId" defaultValue={s.googleTagId} placeholder="AW-123456789, G-ABC123XYZ" className="field font-mono" />
            </Field>
            <Field label="Conversión de compra (Google Ads)" hint="Objetivos → Conversiones → tu acción «Compra» → Configuración de la etiqueta → «send_to»: AW-123456789/AbCdEf…">
              <input name="googleAdsPurchase" defaultValue={s.googleAdsPurchase} placeholder="AW-123456789/AbCdEfGhIjKl" className="field font-mono" />
            </Field>
          </div>
        </Panel>

        <SubmitButton>Guardar ajustes</SubmitButton>
      </ActionForm>
    </>
  );
}
