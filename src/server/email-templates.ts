import "server-only";

/**
 * Plantillas de correo transaccional: HTML con estilos en línea y tablas (compatible con
 * Gmail, Outlook, Apple Mail y móviles) + versión de texto plano. Todo dato variable se escapa.
 * Nunca incluyen el contenido del chat ni contraseñas: solo avisos y enlaces.
 */

export type Brand = { storeName: string; appUrl: string; supportEmail?: string; whatsapp?: string };
export type Email = { subject: string; html: string; text: string };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const C = {
  page: "#eef0f3",
  card: "#ffffff",
  ink: "#0f1116",
  text: "#1b1f27",
  muted: "#5f6675",
  faint: "#8a909c",
  line: "#e5e7eb",
  soft: "#f6f7f9",
  volt: "#c8f04f",
  voltInk: "#10140a",
};
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO = "'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace";

type Tone = "brand" | "success" | "info" | "warning" | "danger" | "neutral";
const TONE: Record<Tone, { bg: string; fg: string; dot: string }> = {
  brand: { bg: C.volt, fg: C.voltInk, dot: C.volt },
  success: { bg: "#d9f99d", fg: "#1f3a06", dot: "#65a30d" },
  info: { bg: "#dbeafe", fg: "#123a6b", dot: "#3b82f6" },
  warning: { bg: "#fef3c7", fg: "#6b4a06", dot: "#d97706" },
  danger: { bg: "#fee2e2", fg: "#7a1616", dot: "#dc2626" },
  neutral: { bg: "#e5e7eb", fg: "#374151", dot: "#6b7280" },
};

type Row = [label: string, value: string];
type Steps = { labels: string[]; done: number; problem?: boolean };
type Block = {
  title: string;
  intro: string;
  preheader: string;
  badge?: string; // etiqueta de estado arriba del título
  tone?: Tone;
  tag?: string; // dato a la derecha del encabezado (ej. número de pedido)
  steps?: Steps; // progreso del pedido
  rows?: Row[];
  cta?: { label: string; url: string };
  secondary?: { label: string; url: string };
  note?: string;
  code?: string;
  quote?: string;
  internal?: boolean; // aviso al equipo: pie distinto, sin ayuda al cliente
};

function stepsHtml(s: Steps): string {
  const cells = s.labels
    .map((label, i) => {
      const done = i < s.done;
      const current = i === s.done;
      const color = done ? C.volt : current ? (s.problem ? "#f59e0b" : "#93c5fd") : C.line;
      const mark = done ? "✓ " : current && s.problem ? "! " : "";
      const weight = done || current ? 700 : 500;
      const tc = done || current ? C.text : C.faint;
      return `<td width="${Math.floor(100 / s.labels.length)}%" style="padding:0 ${i < s.labels.length - 1 ? 6 : 0}px 0 0;vertical-align:top"><div style="height:6px;line-height:6px;font-size:0;border-radius:6px;background:${color}">&nbsp;</div><div style="padding-top:8px;font:${weight} 12px/1.3 ${FONT};color:${tc}">${mark}${esc(label)}</div></td>`;
    })
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 4px"><tr>${cells}</tr></table>`;
}

function rowsHtml(rows: Row[]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 4px;border:1px solid ${C.line};border-radius:14px;border-collapse:separate;overflow:hidden">${rows
    .map(([l, v], i) => {
      const total = /^total$/i.test(l);
      const top = i ? `border-top:1px solid ${C.line};` : "";
      const bg = total ? `background:${C.soft};` : "";
      return `<tr><td style="padding:12px 16px;${top}${bg}font:${total ? 700 : 400} 13px ${FONT};color:${total ? C.text : C.muted}">${esc(l)}</td><td align="right" style="padding:12px 16px;${top}${bg}font:${total ? 800 : 600} ${total ? 17 : 13}px ${FONT};color:${C.text}">${esc(v)}</td></tr>`;
    })
    .join("")}</table>`;
}

function layout(b: Brand, k: Block): string {
  const tone = TONE[k.tone ?? "brand"];
  const code = k.code
    ? `<div style="margin:26px 0 6px;padding:20px 12px;border-radius:14px;background:${C.soft};border:1px dashed #cfd3da;text-align:center;font:800 36px/1 ${MONO};letter-spacing:12px;color:${C.ink}">${esc(k.code)}</div>`
    : "";
  const quote = k.quote
    ? `<div style="margin:22px 0 4px;padding:14px 16px;border-left:4px solid ${tone.dot};background:${C.soft};border-radius:0 12px 12px 0;font:14px/1.6 ${FONT};color:${C.text};white-space:pre-line">${esc(k.quote)}</div>`
    : "";
  const cta = k.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 4px"><tr><td style="border-radius:12px;background:${C.ink}"><a href="${esc(k.cta.url)}" style="display:inline-block;padding:15px 28px;font:700 15px ${FONT};color:#ffffff;text-decoration:none;border-radius:12px">${esc(k.cta.label)} &rarr;</a></td></tr></table>${
        k.secondary ? `<p style="margin:14px 0 0;font:600 13px ${FONT}"><a href="${esc(k.secondary.url)}" style="color:${C.text};text-decoration:underline">${esc(k.secondary.label)}</a></p>` : ""
      }<p style="margin:14px 0 0;font:12px/1.5 ${FONT};color:${C.faint}">¿El botón no funciona? Copia este enlace:<br><a href="${esc(k.cta.url)}" style="color:${C.faint};word-break:break-all">${esc(k.cta.url)}</a></p>`
    : "";
  const note = k.note ? `<p style="margin:24px 0 0;padding-top:18px;border-top:1px solid ${C.line};font:12.5px/1.65 ${FONT};color:${C.muted}">${esc(k.note)}</p>` : "";

  const help = k.internal
    ? ""
    : `<tr><td style="padding:18px 28px;background:${C.soft};border-top:1px solid ${C.line};font:13px/1.6 ${FONT};color:${C.muted}"><strong style="color:${C.text}">¿Necesitas ayuda?</strong> Entra al <a href="${esc(b.appUrl)}/ayuda" style="color:${C.text}">Centro de ayuda</a>${
        b.supportEmail ? ` o escríbenos a <a href="mailto:${esc(b.supportEmail)}" style="color:${C.text}">${esc(b.supportEmail)}</a>` : ""
      }${b.whatsapp ? ` · WhatsApp ${esc(b.whatsapp)}` : ""}. Ten a mano tu número de pedido.</td></tr>`;

  const host = esc(b.appUrl.replace(/^https?:\/\//, ""));
  const footer = k.internal
    ? `Aviso interno de ${esc(b.storeName)} para el equipo. No lo reenvíes a clientes.`
    : `<a href="${esc(b.appUrl)}/recargas" style="color:${C.muted};text-decoration:none">Recargar diamantes</a> &nbsp;·&nbsp; <a href="${esc(b.appUrl)}/pedido" style="color:${C.muted};text-decoration:none">Seguimiento</a> &nbsp;·&nbsp; <a href="${esc(b.appUrl)}/ayuda" style="color:${C.muted};text-decoration:none">Ayuda</a><br><br>
🔒 Nunca te pediremos contraseñas, códigos de tu banco ni pagos fuera de <a href="${esc(b.appUrl)}" style="color:${C.muted}">${host}</a>.<br>
${esc(b.storeName)} es una tienda independiente. Free Fire es una marca de Garena; no estamos afiliados.<br>Recibes este correo por tu actividad en ${esc(b.storeName)}.`;

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light"><title>${esc(k.title)}</title></head>
<body style="margin:0;padding:0;background:${C.page};-webkit-text-size-adjust:100%">
<div style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;max-height:0;overflow:hidden;mso-hide:all">${esc(k.preheader)}&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.page}"><tr><td align="center" style="padding:32px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:${C.card};border-radius:20px;border:1px solid ${C.line};border-collapse:separate;overflow:hidden">
<tr><td style="background:${C.ink};padding:20px 28px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
    <td style="vertical-align:middle"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td style="width:34px;height:34px;border-radius:9px;background:${C.volt};text-align:center;font:900 19px/34px ${FONT};color:${C.voltInk}">${esc(b.storeName.charAt(0).toUpperCase())}</td>
      <td style="padding-left:11px;font:800 15px ${FONT};letter-spacing:4px;color:#ffffff">${esc(b.storeName.toUpperCase())}</td>
    </tr></table></td>
    ${k.tag ? `<td align="right" style="vertical-align:middle;font:600 12px ${MONO};letter-spacing:1px;color:#9aa3b2">${esc(k.tag)}</td>` : ""}
  </tr></table>
</td></tr>
<tr><td style="height:4px;line-height:4px;font-size:0;background:${C.volt}">&nbsp;</td></tr>
<tr><td style="padding:32px 28px 30px">
  ${k.badge ? `<span style="display:inline-block;padding:5px 11px;border-radius:999px;background:${tone.bg};font:800 10.5px ${FONT};letter-spacing:1.4px;text-transform:uppercase;color:${tone.fg}">${esc(k.badge)}</span>` : ""}
  <h1 style="margin:${k.badge ? 14 : 0}px 0 0;font:800 25px/1.25 ${FONT};letter-spacing:-0.3px;color:${C.ink}">${esc(k.title)}</h1>
  <p style="margin:12px 0 0;font:15.5px/1.6 ${FONT};color:${C.text}">${esc(k.intro)}</p>
  ${k.steps ? stepsHtml(k.steps) : ""}${code}${quote}${k.rows?.length ? rowsHtml(k.rows) : ""}${cta}${note}
</td></tr>
${help}
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px"><tr><td style="padding:22px 16px 0;text-align:center;font:12px/1.7 ${FONT};color:${C.faint}">${footer}</td></tr></table>
</td></tr></table></body></html>`;
}

function plain(b: Brand, k: Block): string {
  return [
    k.badge ? `[${k.badge.toUpperCase()}]` : "",
    k.title,
    "",
    k.intro,
    k.steps ? `\nProgreso: ${k.steps.labels.map((l, i) => `${i < k.steps!.done ? "✓" : i === k.steps!.done ? "→" : "·"} ${l}`).join("  ")}` : "",
    k.code ? `\nCódigo: ${k.code}` : "",
    k.quote ? `\n${k.quote}` : "",
    k.rows?.length ? `\n${k.rows.map(([l, v]) => `${l}: ${v}`).join("\n")}` : "",
    k.cta ? `\n${k.cta.label}: ${k.cta.url}` : "",
    k.secondary ? `${k.secondary.label}: ${k.secondary.url}` : "",
    k.note ? `\n${k.note}` : "",
    "",
    k.internal ? `— Aviso interno de ${b.storeName}` : `¿Ayuda? ${b.appUrl}/ayuda${b.supportEmail ? ` · ${b.supportEmail}` : ""}\n— ${b.storeName}`,
  ]
    .filter((x) => x !== "")
    .join("\n");
}

const build = (b: Brand, subject: string, k: Block): Email => ({ subject, html: layout(b, k), text: plain(b, k) });

// ---------------------------------------------------------------------
// Cuenta
// ---------------------------------------------------------------------

export function codeEmail(b: Brand, p: { code: string; purpose: "LOGIN" | "VERIFY"; minutes: number }): Email {
  const login = p.purpose === "LOGIN";
  return build(b, `${p.code} es tu código de ${b.storeName}`, {
    badge: login ? "Código de acceso" : "Verificación",
    tone: "brand",
    title: login ? "Tu código para ingresar" : "Confirma tu correo",
    intro: login ? `Escribe este código en ${b.storeName} para entrar a tu cuenta.` : "Escribe este código para confirmar que este correo es tuyo.",
    preheader: `${p.code} · vence en ${p.minutes} minutos`,
    code: p.code,
    note: `Vence en ${p.minutes} minutos y sirve una sola vez. Si no lo pediste, ignora este correo: nadie puede entrar sin el código. Nunca lo compartas, ni siquiera con nuestro equipo.`,
  });
}

export function passwordResetEmail(b: Brand, p: { link: string; minutes: number }): Email {
  return build(b, `Crea una nueva contraseña · ${b.storeName}`, {
    badge: "Seguridad",
    tone: "info",
    title: "Crea una nueva contraseña",
    intro: "Recibimos una solicitud para cambiar la contraseña de tu cuenta. Usa el botón para elegir una nueva.",
    preheader: "Enlace para crear una nueva contraseña",
    cta: { label: "Crear nueva contraseña", url: p.link },
    note: `El enlace vence en ${p.minutes} minutos y se usa una sola vez. Si no fuiste tú, ignora este correo: tu contraseña no cambia.`,
  });
}

export function welcomeEmail(b: Brand, p: { name?: string | null }): Email {
  return build(b, `Bienvenido a ${b.storeName}`, {
    badge: "Bienvenida",
    tone: "brand",
    title: `¡Bienvenido${p.name ? `, ${p.name.split(" ")[0]}` : ""}!`,
    intro: "Tu cuenta está lista. Recarga diamantes con tu ID en minutos y sigue cada pedido desde Mi cuenta.",
    preheader: "Tu cuenta está lista",
    rows: [
      ["Recargas", "Directo a tu ID, sin contraseñas"],
      ["Pagos", "En pesos colombianos"],
      ["Seguimiento", "Estado real de cada pedido"],
    ],
    cta: { label: "Recargar diamantes", url: `${b.appUrl}/recargas` },
    secondary: { label: "Ir a Mi cuenta", url: `${b.appUrl}/cuenta` },
  });
}

export function passwordChangedEmail(b: Brand, p: { when: string; how: "reset" | "perfil" }): Email {
  return build(b, `Tu contraseña fue cambiada · ${b.storeName}`, {
    badge: "Aviso de seguridad",
    tone: "warning",
    title: "Tu contraseña fue cambiada",
    intro: p.how === "reset" ? "Creaste una nueva contraseña con el enlace de recuperación y cerramos las demás sesiones abiertas." : "Cambiaste la contraseña desde Mi cuenta y cerramos las demás sesiones abiertas.",
    preheader: "Aviso de seguridad de tu cuenta",
    rows: [["Fecha", p.when]],
    cta: { label: "No fui yo: recuperar mi cuenta", url: `${b.appUrl}/recuperar` },
    note: "Si fuiste tú, no tienes que hacer nada. Si no reconoces este cambio, recupera tu cuenta de inmediato y escríbenos.",
  });
}

// ---------------------------------------------------------------------
// Pedidos
// ---------------------------------------------------------------------

export type OrderTemplate = "order_created" | "payment_confirmed" | "delivered" | "delivery_failed" | "refunded" | "cancelled";
export type OrderEmailData = { number: string; type: "TOPUP" | "ACCOUNT"; item: string; total: string; playerId?: string | null; link: string; isTest: boolean };

export function orderEmail(b: Brand, t: OrderTemplate, o: OrderEmailData): Email {
  const account = o.type === "ACCOUNT";
  const rows: Row[] = [["Pedido", o.number], ["Producto", o.item], ...(o.playerId ? ([["ID de jugador", o.playerId]] as Row[]) : []), ["Total", o.total]];
  const test = o.isTest ? "Pedido de prueba: no hubo cobro real ni entrega real." : undefined;
  const view = { label: "Ver mi pedido", url: o.link };
  const chat = { label: "Abrir chat de entrega", url: `${o.link}#chat` };
  const labels = account ? ["Pedido", "Pago", "Cuenta entregada"] : ["Pedido", "Pago", "Diamantes entregados"];
  const steps = (done: number, problem = false): Steps => ({ labels, done, problem });

  const map: Record<OrderTemplate, { subject: string; block: Omit<Block, "rows"> }> = {
    order_created: {
      subject: `Recibimos tu pedido ${o.number}`,
      block: { badge: "Pedido recibido", tone: "info", steps: steps(1), title: "Recibimos tu pedido", intro: "Tu pedido quedó registrado. Apenas la pasarela confirme el pago empezamos la entrega.", preheader: `Pedido ${o.number} · ${o.total}`, cta: view, note: test },
    },
    payment_confirmed: {
      subject: `Pago confirmado · ${o.number}`,
      block: account
        ? { badge: "Pago confirmado", tone: "success", steps: steps(2), title: "¡Pago confirmado! La cuenta ya es tuya", intro: "Te entregamos los datos de acceso por el chat de tu pedido. Te avisamos por correo cuando te escribamos.", preheader: "Abre el chat de entrega de tu cuenta", cta: chat, note: test }
        : { badge: "Pago confirmado", tone: "success", steps: steps(2), title: "¡Pago confirmado!", intro: "Estamos enviando los diamantes a tu ID. Normalmente tarda pocos minutos.", preheader: "Estamos enviando tus diamantes", cta: view, note: test },
    },
    delivered: {
      subject: account ? `Entrega completada · ${o.number}` : `¡Tus diamantes llegaron! · ${o.number}`,
      block: account
        ? { badge: "Entregado", tone: "success", steps: steps(3), title: "Entrega completada", intro: "Cambia la contraseña y el correo de recuperación de la cuenta si aún no lo hiciste. El chat sigue abierto 7 días por si necesitas algo.", preheader: "Tu cuenta fue entregada", cta: view, note: test }
        : { badge: "Entregado", tone: "success", steps: steps(3), title: "¡Tus diamantes llegaron!", intro: "Abre Free Fire y revisa tu saldo. Gracias por comprar con nosotros.", preheader: "Recarga entregada", cta: { label: "Volver a recargar", url: `${b.appUrl}/recargas` }, secondary: { label: "Ver el detalle del pedido", url: o.link }, note: test },
    },
    delivery_failed: {
      subject: `Estamos revisando tu entrega · ${o.number}`,
      block: { badge: "En revisión", tone: "warning", steps: steps(2, true), title: "Estamos revisando tu entrega", intro: "Hubo un inconveniente con la entrega. Tu pago está seguro: lo resolvemos o te devolvemos el dinero.", preheader: "Tu pago está seguro", cta: view, note: test },
    },
    refunded: {
      subject: `Reembolso procesado · ${o.number}`,
      block: { badge: "Reembolsado", tone: "neutral", title: "Reembolso procesado", intro: "Devolvimos el dinero por el mismo medio de pago. Según tu banco puede tardar algunos días en verse.", preheader: "Te devolvimos el dinero", cta: view, note: test },
    },
    cancelled: {
      subject: `Pedido cancelado · ${o.number}`,
      block: { badge: "Cancelado", tone: "neutral", title: "Pedido cancelado", intro: "El pedido se canceló porque no se completó el pago. No se realizó ningún cobro.", preheader: "No se realizó ningún cobro", cta: { label: "Hacer un nuevo pedido", url: `${b.appUrl}/recargas` }, note: test },
    },
  };
  const m = map[t];
  return build(b, m.subject, { ...m.block, tag: o.number, rows });
}

export function chatMessageEmail(b: Brand, p: { number: string; link: string }): Email {
  return build(b, `Tienes un mensaje nuevo · pedido ${p.number}`, {
    badge: "Mensaje nuevo",
    tone: "info",
    tag: p.number,
    title: "Te escribimos en el chat de tu pedido",
    intro: `Hay un mensaje nuevo en el chat de entrega del pedido ${p.number}. Por seguridad, el mensaje solo se ve dentro de la tienda.`,
    preheader: "Abre el chat de tu pedido",
    cta: { label: "Abrir chat de entrega", url: `${p.link}#chat` },
  });
}

// ---------------------------------------------------------------------
// Soporte y reclamos
// ---------------------------------------------------------------------

export function supportReplyEmail(b: Brand, p: { ref: string; body: string; orderLink?: string; accountLink?: string }): Email {
  const order = p.orderLink ? { label: "Ver mi pedido", url: p.orderLink } : undefined;
  return build(b, `Re: tu solicitud #${p.ref} · ${b.storeName}`, {
    badge: "Respuesta de soporte",
    tone: "info",
    tag: `#${p.ref}`,
    title: "Respondimos tu solicitud",
    intro: `Esta es la respuesta a tu caso #${p.ref}:`,
    preheader: p.body.slice(0, 90),
    quote: p.body,
    cta: p.accountLink ? { label: "Ver y responder", url: p.accountLink } : order,
    secondary: p.accountLink ? order : undefined,
    note: p.accountLink ? "Puedes contestar desde tu cuenta (Mi cuenta → Soporte) o respondiendo este correo." : "Puedes responder este correo si necesitas algo más.",
  });
}

export function ticketReceivedEmail(b: Brand, p: { ref: string; topic: string; excerpt: string; accountLink?: string }): Email {
  return build(b, `Recibimos tu solicitud #${p.ref} · ${b.storeName}`, {
    badge: "Caso abierto",
    tone: "info",
    tag: `#${p.ref}`,
    title: "Recibimos tu solicitud",
    intro: `Tu caso quedó registrado con el número #${p.ref}. Te responderemos a este correo lo antes posible${p.accountLink ? " y también lo verás en tu cuenta" : ""}.`,
    cta: p.accountLink ? { label: "Ver mi solicitud", url: p.accountLink } : undefined,
    preheader: `Caso #${p.ref} · ${p.topic}`,
    rows: [["Caso", `#${p.ref}`], ["Tema", p.topic]],
    quote: p.excerpt,
    note: "Si es sobre un pedido, ten a mano su número (VX-…). No compartas contraseñas ni códigos por ningún medio.",
  });
}

export function claimReceivedEmail(b: Brand, p: { ref: string; listing: string }): Email {
  return build(b, `Recibimos tu reclamo #${p.ref} · ${b.storeName}`, {
    badge: "Reclamo recibido",
    tone: "neutral",
    tag: `#${p.ref}`,
    title: "Recibimos tu reclamo",
    intro: `Revisaremos tu reclamo sobre la publicación «${p.listing}». Mientras lo revisamos, la publicación puede quedar pausada.`,
    preheader: `Reclamo #${p.ref}`,
    rows: [["Reclamo", `#${p.ref}`], ["Publicación", p.listing]],
    note: "Te escribiremos a este correo con el resultado. Si tienes pruebas de propiedad (correos de Garena, compras), tenlas a mano.",
  });
}

// ---------------------------------------------------------------------
// Avisos al equipo
// ---------------------------------------------------------------------

export function staffAccountSoldEmail(b: Brand, p: { number: string; item: string; total: string; adminLink: string }): Email {
  return build(b, `Cuenta vendida: entrega pendiente · ${p.number}`, {
    internal: true,
    badge: "Venta · entregar",
    tone: "success",
    tag: p.number,
    title: "Vendiste una cuenta",
    intro: "El pago fue confirmado por la pasarela. Entrega los datos por el chat del pedido.",
    preheader: `${p.item} · ${p.total}`,
    rows: [["Pedido", p.number], ["Cuenta", p.item], ["Total", p.total]],
    cta: { label: "Abrir chat de entrega", url: p.adminLink },
  });
}

export function staffTicketEmail(b: Brand, p: { ref: string; topic: string; email: string; excerpt: string; adminLink: string; followUp?: boolean }): Email {
  return build(b, p.followUp ? `El cliente respondió la solicitud #${p.ref}` : `Nueva solicitud de soporte #${p.ref}`, {
    internal: true,
    badge: p.followUp ? "Respuesta del cliente" : "Soporte",
    tone: p.followUp ? "warning" : "info",
    tag: `#${p.ref}`,
    title: p.followUp ? "El cliente respondió" : "Nueva solicitud de soporte",
    intro: p.followUp ? `${p.email} respondió en su solicitud sobre «${p.topic}»:` : `${p.email} escribió sobre «${p.topic}»:`,
    preheader: p.excerpt.slice(0, 90),
    quote: p.excerpt,
    cta: { label: "Responder desde el panel", url: p.adminLink },
  });
}

export function staffClaimEmail(b: Brand, p: { ref: string; listing: string; email: string; excerpt: string; adminLink: string }): Email {
  return build(b, `Nuevo reclamo de cuenta #${p.ref}`, {
    internal: true,
    badge: "Reclamo",
    tone: "warning",
    tag: `#${p.ref}`,
    title: "Nuevo reclamo sobre una cuenta",
    intro: `${p.email} dice ser dueño de «${p.listing}»:`,
    preheader: p.excerpt.slice(0, 90),
    quote: p.excerpt,
    cta: { label: "Revisar reclamo", url: p.adminLink },
  });
}

export function staffChatEmail(b: Brand, p: { number: string; adminLink: string }): Email {
  return build(b, `Mensaje nuevo del cliente · ${p.number}`, {
    internal: true,
    badge: "Chat de entrega",
    tone: "info",
    tag: p.number,
    title: "El cliente te escribió",
    intro: `Hay un mensaje nuevo en el chat de entrega del pedido ${p.number}. Por seguridad, el contenido solo se ve en el panel.`,
    preheader: `Chat del pedido ${p.number}`,
    cta: { label: "Responder en el panel", url: p.adminLink },
  });
}

export function staffDeliveryIssueEmail(b: Brand, p: { number: string; item: string; reason: string; adminLink: string }): Email {
  return build(b, `Recarga detenida · ${p.number}`, {
    internal: true,
    badge: "Recarga detenida",
    tone: "danger",
    tag: p.number,
    title: "Una recarga necesita tu atención",
    intro: "El pago está confirmado pero la recarga no se completó.",
    preheader: p.reason.slice(0, 90),
    rows: [["Pedido", p.number], ["Producto", p.item]],
    quote: p.reason,
    cta: { label: "Abrir el pedido", url: p.adminLink },
    note: "Si el motivo es saldo del proveedor o paquete agotado, la tienda reintenta sola cada 5 minutos con la misma referencia (no cobra dos veces).",
  });
}

export type StaffSecurityEvent = "login" | "2fa_enabled" | "2fa_reset" | "recovery_regenerated" | "password_changed";

export function staffSecurityEmail(b: Brand, p: { event: StaffSecurityEvent; when: string; device: string; method?: string }): Email {
  const T: Record<StaffSecurityEvent, { subject: string; title: string; intro: string }> = {
    login: { subject: "Nuevo ingreso al panel", title: "Nuevo ingreso al panel", intro: "Alguien entró al panel de control con tu cuenta del equipo." },
    "2fa_enabled": { subject: "Verificación en dos pasos activada", title: "Verificación en dos pasos activada", intro: "Activaste la verificación en dos pasos de tu cuenta del equipo." },
    "2fa_reset": { subject: "Tu verificación en dos pasos fue restablecida", title: "Verificación en dos pasos restablecida", intro: "Un administrador restableció tu verificación en dos pasos. En tu próximo ingreso tendrás que configurarla de nuevo." },
    recovery_regenerated: { subject: "Códigos de recuperación nuevos", title: "Generaste códigos de recuperación nuevos", intro: "Los códigos anteriores ya no sirven." },
    password_changed: { subject: "Cambiaste la contraseña del panel", title: "Cambiaste la contraseña del panel", intro: "Se cerraron las demás sesiones abiertas con tu cuenta del equipo." },
  };
  const t = T[p.event];
  const rows: Row[] = [["Fecha", p.when], ["Dispositivo", p.device]];
  if (p.method) rows.push(["Método", p.method]);
  return build(b, `${t.subject} · ${b.storeName}`, {
    internal: true,
    badge: "Seguridad del panel",
    tone: p.event === "2fa_reset" ? "danger" : "warning",
    title: t.title,
    intro: t.intro,
    preheader: "Aviso de seguridad del panel",
    rows,
    note: "Si no fuiste tú, cambia tu contraseña de inmediato y pide a un administrador que restablezca tu verificación en dos pasos.",
  });
}

/** Error del servidor en producción (se agrupan: un aviso por tipo de error cada cierto tiempo). */
export function staffServerErrorEmail(b: Brand, p: { path: string; method: string; message: string; digest?: string; when: string; count: number; adminLink: string }): Email {
  const rows: Row[] = [["Fecha", p.when], ["Página", `${p.method} ${p.path}`]];
  if (p.digest) rows.push(["Código", p.digest]);
  if (p.count > 1) rows.push(["Repeticiones", `${p.count} desde el último aviso`]);
  return build(b, `Error en la tienda: ${p.path}`, {
    internal: true,
    badge: "Error del servidor",
    tone: "danger",
    title: "La tienda tuvo un error",
    intro: "Un cliente vio una página de error. Revisa el registro del servidor con el código de abajo.",
    preheader: p.message.slice(0, 90),
    rows,
    quote: p.message.slice(0, 600),
    cta: { label: "Abrir el panel", url: p.adminLink },
    note: "Recibes como máximo un aviso por error cada 30 minutos.",
  });
}

export function testEmail(b: Brand): Email {
  return build(b, `Correo de prueba · ${b.storeName}`, {
    badge: "Prueba",
    tone: "success",
    title: "El correo funciona",
    intro: "Si lees esto, los correos de la tienda están configurados correctamente: códigos, pedidos, soporte y avisos.",
    preheader: "Prueba de configuración",
    cta: { label: "Ir a la tienda", url: b.appUrl },
  });
}
