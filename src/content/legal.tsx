import type { ReactNode } from "react";
import type { StoreSettings } from "@/server/settings";

/**
 * Textos legales base. Son una PLANTILLA redactada para este modelo de negocio:
 * deben revisarse con asesoría legal en Colombia antes de operar.
 */
export type LegalDoc = { title: string; description: string; body: (s: StoreSettings) => ReactNode };

/** Fecha de vigencia de estos textos (Decreto 1377 de 2013, art. 13). Actualízala al cambiar cualquier documento. */
export const LEGAL_UPDATED = "2026-10-24";

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
        <h2 id="menores">6. Edad mínima y menores de edad</h2>
        <p>
          Para comprar debes ser mayor de 18 años. Si eres menor de edad, la compra debe hacerla, o autorizarla expresamente, tu padre, madre o
          representante legal, quien es responsable del pago y del medio de pago utilizado. Si un representante nos informa que una compra se hizo
          sin su autorización, revisaremos el caso conforme a la política de reembolsos y a la ley.
        </p>
        <h2 id="precios-finales">7. Sin cargos ocultos</h2>
        <p>
          El precio que ves antes de pagar es el total: no sumamos comisiones, cargos de servicio ni costos adicionales. Los descuentos por código
          promocional se muestran antes de pagar, aplican solo a lo que indique cada código y no son acumulables salvo que se diga lo contrario.
        </p>
        <h2>8. Uso indebido</h2>
        <p>
          Podemos cancelar pedidos con indicios de fraude, suplantación o uso de medios de pago no autorizados, informando al comprador y
          gestionando la devolución que corresponda.
        </p>
        <h2>9. Documentos relacionados y cambios</h2>
        <p>
          También forman parte de estas condiciones la <a href="/legal/privacidad">política de privacidad</a>, la{" "}
          <a href="/legal/cookies">política de cookies</a>, la <a href="/legal/reembolsos">política de reembolsos</a> y la{" "}
          <a href="/legal/productos-digitales">información sobre productos digitales</a>. Si cambiamos estos textos, publicaremos la nueva versión
          con su fecha; los pedidos ya hechos se rigen por la versión vigente al momento de la compra.
        </p>
        <h2>10. Contacto</h2>
        <p>
          Para cualquier solicitud escríbenos a {contact(s)}. Si no quedas conforme con nuestra respuesta, puedes acudir a la Superintendencia de
          Industria y Comercio (www.sic.gov.co).
        </p>
      </>
    ),
  },
  privacidad: {
    title: "Política de privacidad",
    description: "Cómo tratamos tus datos personales conforme a la Ley 1581 de 2012 y el Decreto 1377 de 2013.",
    body: (s) => (
      <>
        <p>
          <strong>{company(s)}</strong> es responsable del tratamiento de los datos personales recolectados en este sitio, de acuerdo con la Ley 1581
          de 2012, el Decreto 1377 de 2013 (compilado en el Decreto 1074 de 2015) y demás normas aplicables.
        </p>
        <h2 id="responsable">Responsable</h2>
        <SellerData s={s} />
        <h2 id="datos">Datos que recolectamos (solo los necesarios)</h2>
        <ul>
          <li><strong>Para comprar:</strong> correo electrónico e ID de jugador de Free Fire (para entregar la recarga). Nada más es obligatorio.</li>
          <li><strong>Si creas una cuenta:</strong> nombre y correo; opcionalmente teléfono, foto de perfil e ID de jugador guardado para recargar más rápido.</li>
          <li><strong>Si escribes a soporte o abres un reclamo:</strong> tu correo y lo que nos cuentes.</li>
          <li><strong>Datos técnicos mínimos:</strong> una huella anonimizada de la dirección IP y el tipo de navegador de tus sesiones, para prevenir abusos y proteger tu cuenta.</li>
        </ul>
        <p>
          <strong>No</strong> pedimos tu contraseña de Free Fire ni de redes sociales, ni datos de tarjetas: el pago se hace en la plataforma de la
          pasarela. No usamos herramientas de analítica ni publicidad que te rastreen.
        </p>
        <h2 id="finalidades">Finalidades</h2>
        <ul>
          <li>Procesar, entregar y dar seguimiento a tus pedidos.</li>
          <li>Enviarte correos transaccionales sobre tus compras y tu cuenta (confirmaciones, códigos de acceso, estado del pedido). No enviamos publicidad.</li>
          <li>Atender solicitudes de soporte, reclamaciones y reembolsos.</li>
          <li>Prevenir fraude y cumplir obligaciones legales, contables y tributarias.</li>
        </ul>
        <h2 id="autorizacion">Autorización</h2>
        <p>
          Al crear tu cuenta, hacer un pedido o escribirnos, nos autorizas a tratar tus datos para estas finalidades. Siempre te lo indicamos junto al
          formulario. Puedes revocar la autorización en cualquier momento, salvo cuando debamos conservar datos por un deber legal o contractual.
        </p>
        <h2 id="encargados">Con quién los compartimos</h2>
        <p>Solo con proveedores que necesitamos para operar, que actúan como encargados del tratamiento y reciben únicamente lo indispensable:</p>
        <ul>
          <li><strong>Bold</strong> (pasarela de pagos, Colombia): monto, número de pedido y los datos que ingreses en su plataforma para pagar.</li>
          <li><strong>Proveedor de recargas</strong>: el ID de jugador y el paquete, para acreditar los diamantes.</li>
          <li><strong>Resend</strong> (envío de correos, Estados Unidos): tu correo y el contenido del mensaje.</li>
          <li><strong>Google</strong> (solo si eliges «Continuar con Google»): Google nos confirma tu correo y nombre; no recibimos tu contraseña.</li>
          <li><strong>Proveedor de hosting</strong>: aloja el servidor y la base de datos de la tienda.</li>
        </ul>
        <p>
          Algunos de estos proveedores están fuera de Colombia; la transmisión se hace solo para las finalidades descritas y con proveedores que
          ofrecen medidas de seguridad adecuadas. No vendemos ni cedemos tus datos.
        </p>
        <h2 id="conservacion">Cuánto tiempo los guardamos</h2>
        <ul>
          <li>Datos de tu cuenta: mientras la mantengas activa. Puedes eliminarla cuando quieras.</li>
          <li>Pedidos y pagos: el tiempo que exige la ley para soportes contables y comerciales (hasta 10 años, Código de Comercio, art. 60).</li>
          <li>Sesiones y registros técnicos: lo necesario para seguridad; las sesiones vencen solas.</li>
        </ul>
        <h2 id="derechos">Tus derechos</h2>
        <p>
          Puedes conocer, actualizar y rectificar tus datos, pedir prueba de la autorización, saber cómo los usamos, revocar la autorización, pedir su
          supresión y presentar quejas ante la Superintendencia de Industria y Comercio. Escríbenos a {contact(s)} o usa el{" "}
          <a href="/ayuda#contacto">centro de ayuda</a>. Respondemos consultas en máximo diez (10) días hábiles y reclamos en máximo quince (15)
          días hábiles (Ley 1581, arts. 14 y 15).
        </p>
        <h2 id="supresion">Eliminar tu cuenta</h2>
        <p>
          Desde <a href="/cuenta?seccion=seguridad">Mi cuenta → Seguridad</a> puedes eliminar tu cuenta tú mismo: borramos tu perfil, foto, ID de jugador
          guardado, sesiones y vínculo con Google al instante. Tus pedidos quedan sin cuenta asociada y se conservan solo por el deber legal de
          guardar soportes contables. Si compraste sin cuenta, pide la supresión por el centro de ayuda.
        </p>
        <h2 id="menores">Menores de edad</h2>
        <p>
          La tienda está dirigida a mayores de 18 años. Los datos de menores solo se tratan cuando su padre, madre o representante legal realiza o
          autoriza la compra, respetando el interés superior del menor (Ley 1581, art. 7).
        </p>
        <h2 id="cookies">Cookies</h2>
        <p>
          Usamos solo cookies técnicas necesarias para que el sitio funcione (sesión y seguridad). Detalle en la{" "}
          <a href="/legal/cookies">política de cookies</a>.
        </p>
        <h2 id="seguridad">Seguridad</h2>
        <p>
          Usamos conexión cifrada (HTTPS), contraseñas protegidas con algoritmos de resumen, mensajes de entrega de cuentas cifrados y acceso
          restringido al panel con verificación en dos pasos.
        </p>
      </>
    ),
  },
  cookies: {
    title: "Política de cookies",
    description: "Qué cookies usa la tienda y para qué.",
    body: () => (
      <>
        <p>
          Las cookies son pequeños archivos que la página guarda en tu navegador. Aquí solo usamos las necesarias para que la tienda funcione. No
          usamos cookies de publicidad, de analítica ni de redes sociales, y nada de esto se comparte con terceros.
        </p>
        <h2>Para qué las usamos</h2>
        <ul>
          <li>Mantener tu sesión iniciada si entras a tu cuenta.</li>
          <li>Recordar lo que tienes en el carrito.</li>
          <li>Proteger el inicio de sesión con Google.</li>
          <li>Recordar que ya viste el aviso de cookies, para no mostrártelo otra vez.</li>
        </ul>
        <p>Como son indispensables, no necesitamos pedirte que las aceptes; igual te lo contamos la primera vez que entras.</p>
        <h2>Cómo borrarlas</h2>
        <p>
          Puedes borrarlas o bloquearlas desde la configuración de tu navegador. Si lo haces, la sesión se cerrará y el carrito quedará vacío, pero
          podrás seguir comprando sin cuenta.
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
