import "server-only";
import { TOKEN_DELIVERY_MAX, TOKEN_DELIVERY_TIME } from "@/domain/delivery-time";
import { build, type Block, type Brand, type Email, type OrderEmailData, type OrderTemplate, type Steps } from "./email-templates";

/**
 * Correos de los fragmentos y cajas Evo («tokens»). Van completamente aparte de los de diamantes (email-templates.ts):
 * tienen sus propios asuntos y textos, nunca hablan de diamantes, llevan al cliente a /fragmentos y explican el plazo
 * de entrega de hasta 24 horas hábiles. En el registro de correos quedan con el prefijo «token_».
 */

/** Pedidos de premio (Top 3 del mes) son siempre de diamantes: no tienen versión de tokens. */
export type TokenOrderTemplate = Exclude<OrderTemplate, "ranking_prize">;

/** Nombre con el que queda cada correo de tokens en el registro (EmailLog). */
export const tokenTemplateName = (t: TokenOrderTemplate) => `token_${t}`;

export function tokenOrderEmail(b: Brand, t: TokenOrderTemplate, o: OrderEmailData): Email {
  const shopUrl = `${b.appUrl}/fragmentos`;
  const test = o.isTest ? "Pedido de prueba: no hubo cobro real ni entrega real." : undefined;
  const view = { label: "Ver mi pedido", url: o.link };
  const more = { label: "Comprar más fragmentos Evo", url: shopUrl };
  const labels = ["Pedido", "Pago", "Entregado"];
  const steps = (done: number, problem = false): Steps => ({ labels, done, problem });
  const sorry = o.late ? "Te pedimos disculpas por la demora: hubo un retraso en nuestro sistema, ya resuelto. Tu pago siempre estuvo seguro. " : "";
  const window = `Los pedidos de fragmentos y cajas Evo no llegan de manera instantánea: se procesan en un tiempo de hasta ${TOKEN_DELIVERY_MAX} desde el pago.`;

  const map: Record<TokenOrderTemplate, { subject: string; block: Omit<Block, "rows" | "tag" | "shop"> }> = {
    order_created: {
      subject: `Recibimos tu pedido de Armas Evo · ${o.number}`,
      block: { badge: "Pedido recibido", tone: "info", steps: steps(1), title: "Recibimos tu pedido", intro: `Tu pedido de ${o.item} quedó registrado. Apenas la pasarela confirme el pago empezamos la entrega.`, preheader: `Pedido ${o.number} · ${o.total}`, cta: view, note: test ?? window },
    },
    payment_reminder: {
      subject: `Tus fragmentos Evo te esperan · ${o.number}`,
      block: {
        badge: "Pago pendiente",
        tone: "warning",
        steps: steps(1),
        title: "Tu pedido te espera",
        intro: `Aún no recibimos el pago de ${o.item}.${o.expiresAt ? ` Puedes completarlo hasta las ${o.expiresAt}; después el pedido se cancela solo.` : ""}`,
        preheader: `Completa el pago de ${o.item}`,
        cta: { label: "Completar pago", url: o.link },
        note: test ?? "Si ya pagaste, ignora este correo: la confirmación de la pasarela puede tardar unos minutos.",
      },
    },
    payment_confirmed: {
      subject: `Pago confirmado: tu pedido Evo llega en ${TOKEN_DELIVERY_MAX} · ${o.number}`,
      block: {
        badge: "Pago confirmado",
        tone: "success",
        steps: steps(2),
        title: "¡Pago confirmado!",
        intro: `${sorry}Ya estamos procesando ${o.item} para tu ID. ${TOKEN_DELIVERY_TIME.processing}`,
        preheader: `Entrega en un plazo de hasta ${TOKEN_DELIVERY_MAX}`,
        cta: view,
        note: test ?? `Dentro de ese plazo no hace falta escribirnos: tu pago está seguro y la entrega sigue su curso.`,
      },
    },
    delivered: {
      subject: `¡Tu compra Evo llegó! · ${o.number}`,
      block: {
        badge: "Entregado",
        tone: "success",
        steps: steps(3),
        title: "¡Tu compra Evo llegó!",
        intro: `${sorry}Abre Free Fire: ${o.item} ya está en tu cuenta. Gracias por comprar con nosotros.`,
        preheader: "Tu compra Evo fue entregada",
        cta: more,
        secondary: { label: "Ver el detalle del pedido", url: o.link },
        note: test,
      },
    },
    // Sale cuando ya pasó el plazo de 24 horas hábiles (antes de eso, una entrega lenta es normal y no se avisa), o si el
    // proveedor no puede entregarla y el equipo tiene que revisarla.
    delivery_failed: {
      subject: `Estamos revisando tu compra Evo · ${o.number}`,
      block: { badge: "En revisión", tone: "warning", steps: steps(2, true), title: "Estamos revisando tu compra Evo", intro: TOKEN_DELIVERY_TIME.delayed, preheader: "Tu pago está seguro", cta: view, note: test },
    },
    refunded: {
      subject: `Reembolso procesado · ${o.number}`,
      block: { badge: "Reembolsado", tone: "neutral", title: "Reembolso procesado", intro: `Devolvimos el dinero de ${o.item} por el mismo medio de pago. Según tu banco puede tardar algunos días en verse.`, preheader: "Te devolvimos el dinero", cta: view, note: test },
    },
    delay_apology: {
      subject: `Te pedimos disculpas por la demora · ${o.number}`,
      block: {
        badge: "Disculpas",
        tone: "info",
        steps: steps(3),
        title: "Te pedimos disculpas por la demora",
        intro: `Tu ${o.item} llegó después del plazo de ${TOKEN_DELIVERY_MAX} que te prometimos. Ya lo resolvimos para que no vuelva a pasar. Gracias por tu paciencia y por confiar en nosotros.`,
        preheader: "Tu compra llegó más tarde de lo prometido",
        cta: more,
        secondary: view,
        note: test,
      },
    },
    order_recovery: {
      subject: `¿Aún quieres tus fragmentos Evo? · ${o.number}`,
      block: {
        badge: "Pedido sin pagar",
        tone: "info",
        title: `Tu ${o.item} te espera`,
        intro: `Tu pedido se canceló porque no se completó el pago, así que no se te cobró nada. Si todavía lo quieres, te dejamos ${o.playerId ? "tu ID listo" : "todo listo"}: es un minuto y pagas con Nequi, PSE o tarjeta.`,
        preheader: "Termina tu compra en un minuto",
        cta: { label: "Comprar de nuevo", url: o.buyAgainUrl ?? shopUrl },
        note: test ?? "No te enviaremos más recordatorios sobre este pedido. Antes de pagar ves el precio actual.",
      },
    },
    cancelled: {
      subject: `Pedido cancelado · ${o.number}`,
      block: { badge: "Cancelado", tone: "neutral", title: "Pedido cancelado", intro: "El pedido se canceló porque no se completó el pago. No se realizó ningún cobro.", preheader: "No se realizó ningún cobro", cta: { label: "Ver fragmentos y cajas Evo", url: shopUrl }, note: test },
    },
  };
  const m = map[t];
  const rows: Array<[string, string]> = [["Pedido", o.number], ["Producto", o.item], ...(o.playerId ? ([["ID de jugador", o.playerId]] as Array<[string, string]>) : []), ["Total", o.total]];
  return build(b, m.subject, {
    ...m.block,
    tag: o.number,
    shop: { label: "Fragmentos y cajas Evo", url: shopUrl },
    // En el recordatorio de un pedido vencido no se repite el total viejo: el precio puede haber cambiado.
    rows: t === "order_recovery" ? rows.filter(([k]) => k !== "Total") : rows,
  });
}

/**
 * Aviso al equipo: un pedido de fragmentos o cajas Evo pasó el plazo de 24 horas hábiles sin entregarse. Es el único aviso
 * de demora de estos pedidos (dentro del plazo la tienda espera y reintenta sola, sin correos).
 */
export function staffTokenOverdueEmail(b: Brand, p: { number: string; item: string; hours: number; state: string; lastError?: string | null; adminLink: string }): Email {
  return build(b, `Tokens Evo sin entregar tras ${TOKEN_DELIVERY_MAX} · ${p.number}`, {
    internal: true,
    badge: "Tokens Evo · plazo vencido",
    tone: "danger",
    tag: p.number,
    title: "Un pedido de fragmentos o cajas Evo pasó su plazo",
    intro: `El cliente pagó hace ${p.hours} h y la entrega todavía no se completa (${p.state}). El plazo prometido es de ${TOKEN_DELIVERY_MAX}.`,
    preheader: `${p.item} · ${p.hours} h sin entregar`,
    rows: [["Pedido", p.number], ["Producto", p.item]],
    ...(p.lastError ? { quote: p.lastError.slice(0, 500) } : {}),
    cta: { label: "Abrir el pedido", url: p.adminLink },
    note: "El pedido no se canceló. Verifícalo en el proveedor: si allá figura completado, márcalo entregado; si no, reintenta la entrega o reembolsa.",
  });
}
