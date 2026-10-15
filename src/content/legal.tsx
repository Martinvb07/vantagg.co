import type { ReactNode } from "react";
import type { StoreSettings } from "@/server/settings";

/**
 * Textos legales base. Son una PLANTILLA redactada para este modelo de negocio:
 * deben revisarse con asesoría legal en Colombia antes de operar.
 */
export type LegalDoc = { title: string; description: string; body: (s: StoreSettings) => ReactNode };

/** Fecha de vigencia de estos textos (Decreto 1377 de 2013, art. 13). Actualízala al cambiar cualquier documento. */
export const LEGAL_UPDATED = "2026-10-14";

const company = (s: StoreSettings) => s.legalName || s.storeName;
const contact = (s: StoreSettings) => [s.supportEmail, s.whatsapp && `WhatsApp ${s.whatsapp}`].filter(Boolean).join(" · ") || "los canales publicados en el centro de ayuda";

/** Datos del vendedor que exige el Estatuto del Consumidor (Ley 1480, art. 50). Solo se listan los que estén configurados. */
function SellerData({ s }: { s: StoreSettings }) {
  const rows: Array<[string, string]> = [
    ["Nombre o razón social", s.legalName || s.storeName],
    ...(s.taxId ? ([["NIT o documento", s.taxId]] as Array<[string, string]>) : []),
    ...(s.address ? ([["Dirección", [s.address, s.city].filter(Boolean).join(", ")]] as Array<[string, string]>) : s.city ? ([["Ciudad", s.city]] as Array<[string, string]>) : []),
    ...(s.supportEmail ? ([["Correo", s.supportEmail]] as Array<[string, string]>) : []),
    ...(s.whatsapp ? ([["Teléfono y WhatsApp", s.whatsapp]] as Array<[string, string]>) : []),
  ];
  return (
    <ul>
      {rows.map(([k, v]) => (
        <li key={k}>
          <strong>{k}:</strong> {v}
        </li>
      ))}
    </ul>
  );
}

export const LEGAL: Record<string, LegalDoc> = {
  terminos: {
    title: "Términos y condiciones",
    description: "Condiciones de uso de la tienda, compra de productos digitales, pagos y responsabilidades.",
    body: (s) => (
      <>
        <p>
          Estos términos regulan el uso del sitio y la compra de productos digitales ofrecidos por <strong>{company(s)}</strong>
          {s.taxId ? ` (NIT ${s.taxId})` : ""}. Al realizar un pedido aceptas estas condiciones.
        </p>
        <h2 id="vendedor">Datos del vendedor</h2>
        <SellerData s={s} />
        <h2>1. Naturaleza de la tienda</h2>
        <p>
          Somos una tienda independiente. No estamos afiliados ni respaldados por Garena ni por los titulares de Free Fire. Las marcas mencionadas
          pertenecen a sus respectivos dueños y se usan solo para identificar el juego.
        </p>
        <h2>2. Productos</h2>
        <ul>
          <li><strong>Recargas de diamantes:</strong> se acreditan al ID de jugador que indiques y confirmes antes de pagar, a través de un proveedor de recargas integrado.</li>
          <li><strong>Cuentas digitales:</strong> unidades únicas, descritas en su ficha con la información disponible. Se entregan mediante traspaso asistido.</li>
        </ul>
        <h2 id="pagos">3. Precios y pagos</h2>
        <p>
          Los precios se expresan en pesos colombianos e incluyen los impuestos aplicables. El valor a pagar se calcula en nuestros servidores al
          crear el pedido. Los pagos se procesan en la plataforma de la pasarela autorizada; no almacenamos datos de tarjetas. Un pedido se considera
          pagado únicamente cuando la pasarela nos confirma la transacción.
        </p>
        <h2>4. Responsabilidad del comprador</h2>
        <ul>
          <li>Verificar que el ID de jugador sea correcto. Las recargas acreditadas a un ID informado erróneamente por el comprador no son reversibles.</li>
          <li>Proporcionar un correo de contacto válido.</li>
          <li>En cuentas, actualizar los datos de acceso y recuperación inmediatamente después del traspaso.</li>
        </ul>
        <h2>5. Plazos</h2>
        <p>
          La entrega inicia cuando se confirma el pago. Los tiempos dependen del proveedor de recargas o de la coordinación del traspaso en el caso de
          cuentas. El estado actualizado está siempre disponible en la página de seguimiento.
        </p>
        <h2>6. Uso indebido</h2>
        <p>
          Podemos cancelar pedidos con indicios de fraude, suplantación o uso de medios de pago no autorizados, informando al comprador y
          gestionando la devolución que corresponda.
        </p>
        <h2>7. Contacto</h2>
        <p>Para cualquier solicitud escríbenos a {contact(s)}.</p>
      </>
    ),
  },
  privacidad: {
    title: "Política de privacidad",
    description: "Cómo tratamos tus datos personales conforme a la Ley 1581 de 2012.",
    body: (s) => (
      <>
        <p>
          <strong>{company(s)}</strong> es responsable del tratamiento de los datos personales recolectados en este sitio, de acuerdo con la Ley 1581
          de 2012 y sus decretos reglamentarios.
        </p>
        <h2>Datos que recolectamos</h2>
        <ul>
          <li>Correo electrónico, y opcionalmente nombre y teléfono, para gestionar tu pedido.</li>
          <li>ID de jugador, exclusivamente para entregar la recarga.</li>
          <li>Datos técnicos mínimos (por ejemplo, una huella anonimizada de la dirección IP) para prevenir abusos.</li>
        </ul>
        <p>
          <strong>No</strong> recolectamos contraseñas de redes sociales ni datos de tarjetas: el pago se realiza en la plataforma de la pasarela.
        </p>
        <h2>Finalidades</h2>
        <ul>
          <li>Procesar, entregar y dar seguimiento a tus pedidos.</li>
          <li>Enviarte notificaciones transaccionales sobre el estado de tus compras.</li>
          <li>Atender solicitudes de soporte, reclamaciones y reembolsos.</li>
          <li>Prevenir fraude y cumplir obligaciones legales.</li>
        </ul>
        <h2>Tus derechos</h2>
        <p>
          Puedes conocer, actualizar, rectificar y solicitar la supresión de tus datos, así como revocar la autorización, escribiendo a {contact(s)}.
        </p>
        <h2>Encargados</h2>
        <p>
          Compartimos únicamente la información necesaria con la pasarela de pagos, el proveedor de recargas y el servicio de correo transaccional,
          que actúan como encargados del tratamiento.
        </p>
      </>
    ),
  },
  reembolsos: {
    title: "Política de reembolsos",
    description: "Cuándo procede un reembolso y cómo solicitarlo.",
    body: (s) => (
      <>
        <p>Queremos que cada compra termine bien. Estos son los casos en que procede un reembolso:</p>
        <h2>Procede el reembolso cuando</h2>
        <ul>
          <li>El pago fue confirmado y la entrega no pudo completarse por causas atribuibles a la tienda o al proveedor.</li>
          <li>La cuenta comprada dejó de estar disponible antes de confirmarse el pago.</li>
          <li>La cuenta entregada no corresponde de forma sustancial con lo publicado en su ficha, reportado dentro de las 48 horas siguientes a la entrega.</li>
          <li>Se realizó un cobro duplicado por el mismo pedido.</li>
        </ul>
        <h2>No procede cuando</h2>
        <ul>
          <li>La recarga se acreditó correctamente al ID que el comprador indicó y confirmó.</li>
          <li>El comprador perdió el acceso a una cuenta por no actualizar los datos de recuperación tras la entrega.</li>
        </ul>
        <h2 id="retracto">Derecho de retracto</h2>
        <p>
          En compras a distancia puedes retractarte dentro de los cinco (5) días hábiles siguientes a la compra (Ley 1480 de 2011, art. 47), siempre
          que el producto no se haya entregado: si tu pedido aún está pendiente de entrega, escríbenos y lo cancelamos con reembolso completo por el
          mismo medio de pago. Una recarga acreditada al ID que confirmaste, o una cuenta ya entregada, es un producto digital ejecutado con tu
          consentimiento que por su naturaleza no puede devolverse, por lo que el retracto ya no aplica.
        </p>
        <h2 id="reversion">Reversión del pago</h2>
        <p>
          Si pagaste con un medio electrónico (tarjeta, PSE, Nequi, Botón Bancolombia u otro), puedes pedir la reversión del pago (Ley 1480 de 2011, art. 51, y
          Decreto 587 de 2016) cuando: fuiste víctima de fraude, la operación no fue solicitada por ti, no recibiste el producto, o el producto no
          corresponde a lo solicitado o es defectuoso. Debes pedirla dentro de los cinco (5) días hábiles siguientes a la fecha en que conociste la
          situación, presentando la queja ante nosotros e informando a la entidad emisora del medio de pago, que hará la reversión.
        </p>
        <h2>Cómo solicitarlo</h2>
        <p>
          Abre una solicitud en el <a href="/ayuda#contacto">centro de ayuda</a> con tu número de pedido. Los reembolsos aprobados se procesan por el
          mismo medio de pago, en los plazos de la pasarela y la entidad financiera. Esta política se aplica sin perjuicio de los derechos que te
          otorga la Ley 1480 de 2011 (Estatuto del Consumidor).
        </p>
        <p>Contacto: {contact(s)}.</p>
      </>
    ),
  },
  "productos-digitales": {
    title: "Información sobre productos digitales",
    description: "Cómo funcionan las recargas y la entrega de cuentas digitales.",
    body: () => (
      <>
        <h2>Recargas de diamantes</h2>
        <ul>
          <li>Se envían al ID de jugador que confirmas antes de pagar. No necesitamos tu contraseña.</li>
          <li>La entrega la ejecuta un proveedor de recargas integrado, solo después de que la pasarela confirma el pago.</li>
          <li>Un pedido aparece como «Entregado» únicamente cuando el proveedor confirma la acreditación.</li>
        </ul>
        <h2>Cuentas digitales</h2>
        <ul>
          <li>Cada cuenta es una unidad única. Durante el checkout queda reservada para ti por tiempo limitado.</li>
          <li>Antes de publicar una cuenta revisamos su procedencia y la autorización de venta de su titular.</li>
          <li>«Inventario revisado» indica que el equipo comprobó dentro de la cuenta lo publicado; si no aparece, la información fue declarada por el vendedor.</li>
          <li>Los datos de acceso se entregan por el chat del pedido, que se guarda cifrado. Te pediremos actualizar inmediatamente los datos de acceso y recuperación.</li>
        </ul>
        <h2>Reclamaciones sobre publicaciones</h2>
        <p>
          Si consideras que una publicación infringe tus derechos, usa la opción «Reportarla» en su ficha. Podemos suspenderla mientras revisamos el
          caso.
        </p>
      </>
    ),
  },
};
