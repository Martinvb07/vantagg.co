/**
 * Centro de ayuda: preguntas por tema. Texto original, coherente con las
 * políticas de la tienda y sin afirmaciones de oficialidad.
 */
export const HELP_TOPICS = [
  { id: "recargas", label: "Recargas" },
  { id: "pagos", label: "Pagos" },
  { id: "pedidos", label: "Pedidos y entregas" },
  { id: "cuentas", label: "Compra de cuentas" },
  { id: "reembolsos", label: "Reembolsos" },
  { id: "seguridad", label: "Seguridad" },
] as const;
export type HelpTopic = (typeof HELP_TOPICS)[number]["id"];

export type FaqItem = { id: string; group: HelpTopic; q: string; a: string };

export const FAQ: FaqItem[] = [
  // Recargas
  {
    id: "que-necesito",
    group: "recargas",
    q: "¿Qué necesito para recargar diamantes?",
    a: "Solo tu ID de jugador de Free Fire y un correo para enviarte la confirmación. No pedimos tu contraseña ni el acceso a Facebook, Google o VK.",
  },
  {
    id: "donde-esta-mi-id",
    group: "recargas",
    q: "¿Dónde encuentro mi ID de jugador?",
    a: "Abre Free Fire, toca tu avatar en la esquina superior izquierda y copia el número que aparece debajo de tu nombre. Antes de pagar verificamos que ese ID exista y de qué región es, y te pedimos confirmar que es tu cuenta.",
  },
  {
    id: "bonus",
    group: "recargas",
    q: "¿Cómo funciona el bonus de diamantes?",
    a: "Cada paquete muestra la cantidad base y el bonus, por ejemplo «100 + 10 Bonus». En tu pedido verás el total que recibes. El bonus forma parte de la recarga y se entrega junto con ella.",
  },
  {
    id: "id-equivocado",
    group: "recargas",
    q: "Me equivoqué de ID, ¿qué hago?",
    a: "Si el pedido aún no está pagado, simplemente no lo pagues y crea uno nuevo. Si ya fue entregado a otro ID, la recarga no se puede revertir; por eso te pedimos revisar el ID y confirmarlo antes de pagar.",
  },
  // Pagos
  {
    id: "medios-de-pago",
    group: "pagos",
    q: "¿Qué medios de pago aceptan?",
    a: "Tarjeta débito, tarjeta crédito, Nequi, PSE y Botón Bancolombia, según lo que muestre el paso de pago. Pagas en la plataforma de la pasarela: nunca vemos ni guardamos los datos de tu tarjeta.",
  },
  {
    id: "pago-pendiente",
    group: "pagos",
    q: "Pagué, pero mi pedido sigue «Pendiente de pago»",
    a: "Algunos medios, como PSE, tardan unos minutos en confirmarse. El pedido cambia solo cuando la pasarela nos notifica el pago. Si pasan más de 30 minutos y ya ves el cobro en tu banco, escríbenos con el número de pedido y lo revisamos con la pasarela.",
  },
  {
    id: "pago-rechazado",
    group: "pagos",
    q: "Mi pago fue rechazado",
    a: "No se hizo ningún cobro. Puedes intentarlo de nuevo desde la página de tu pedido con otro medio de pago mientras siga vigente (el tiempo aparece en el seguimiento).",
  },
  {
    id: "codigo-promocional",
    group: "pagos",
    q: "¿Cómo uso un código promocional?",
    a: "En el último paso del checkout toca «¿Tienes un código promocional?», escríbelo y presiona Aplicar. Verás el descuento antes de pagar. Cada código tiene condiciones propias, como vigencia o compra mínima.",
  },
  // Pedidos
  {
    id: "cuanto-tarda",
    group: "pedidos",
    q: "¿Cuánto tarda la entrega?",
    a: "La recarga empieza automáticamente cuando la pasarela confirma el pago. El tiempo final depende del proveedor; puedes ver cada paso en tiempo real en el seguimiento de tu pedido.",
  },
  {
    id: "numero-de-pedido",
    group: "pedidos",
    q: "¿Dónde está mi número de pedido?",
    a: "Aparece al terminar la compra y en el correo de confirmación (revisa también spam o promociones). Tiene el formato VX-XXXX-XXXX. Si compraste con la sesión iniciada, también lo ves en «Mi cuenta».",
  },
  {
    id: "error-de-entrega",
    group: "pedidos",
    q: "Mi pedido dice «Error de entrega»",
    a: "Tu pago quedó registrado y nuestro equipo ya fue notificado. Revisamos la transacción con el proveedor y reintentamos la entrega de forma segura, sin riesgo de entregar dos veces. Si no se puede completar, se gestiona el reembolso.",
  },
  {
    id: "sin-cuenta",
    group: "pedidos",
    q: "¿Necesito crear una cuenta en la tienda?",
    a: "No. Puedes comprar como invitado y consultar tu pedido con el número y el correo. Crear una cuenta es opcional.",
  },
  // Cuentas
  {
    id: "entrega-cuenta",
    group: "cuentas",
    q: "¿Cómo se entrega una cuenta?",
    a: "Cuando el pago se confirma, se abre un chat en la página de tu pedido y por ahí te entregamos los datos de acceso. Cambia de inmediato la contraseña y los datos de recuperación.",
  },
  {
    id: "inventario-verificado",
    group: "cuentas",
    q: "¿Qué significa «Inventario revisado»?",
    a: "Que nuestro equipo revisó dentro de la cuenta que nivel, skins y objetos coinciden con lo publicado. Si la ficha no tiene ese sello, la información fue declarada por quien la vende.",
  },
  {
    id: "reserva",
    group: "cuentas",
    q: "¿Por qué una cuenta aparece como «Reservada»?",
    a: "Otra persona está completando el pago. La reserva dura unos minutos; si no se paga, la cuenta vuelve a estar disponible automáticamente.",
  },
  // Reembolsos
  {
    id: "cuando-reembolso",
    group: "reembolsos",
    q: "¿Cuándo tengo derecho a reembolso?",
    a: "Si pagaste y la entrega no se pudo completar, si la cuenta dejó de estar disponible antes de confirmarse el pago, si la cuenta no coincide con lo publicado (reportándolo dentro de 48 horas) o si hubo un cobro duplicado.",
  },
  {
    id: "como-reembolso",
    group: "reembolsos",
    q: "¿Cómo solicito un reembolso?",
    a: "Abre una solicitud desde este centro de ayuda con tu número de pedido y el tema «Reembolso». Los reembolsos aprobados se devuelven por el mismo medio de pago, en los plazos de la pasarela y tu banco.",
  },
  // Seguridad
  {
    id: "oficial",
    group: "seguridad",
    q: "¿Son una tienda oficial de Garena?",
    a: "No. Somos una tienda independiente de productos digitales. Free Fire es una marca de su titular y la mencionamos solo para identificar el juego.",
  },
  {
    id: "estafas",
    group: "seguridad",
    q: "¿Cómo sé que me escribe la tienda y no un estafador?",
    a: "Nunca te pediremos contraseñas, códigos que lleguen a tu celular ni pagos fuera de la página. Los únicos pagos válidos son los que haces en el checkout de la tienda. Ante la duda, escríbenos desde los canales de este centro de ayuda.",
  },
];
