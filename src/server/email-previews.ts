import "server-only";
import { env } from "@/lib/env";
import * as T from "./email-templates";

/** Plantillas con datos de ejemplo para la vista previa del panel. */
export const EMAIL_PREVIEWS: Array<{ key: string; label: string; group: string; render: (b: T.Brand) => T.Email }> = [
  { key: "login_code", label: "Código para ingresar", group: "Cuenta", render: (b) => T.codeEmail(b, { code: "482913", purpose: "LOGIN", minutes: 10 }) },
  { key: "verify_code", label: "Verificar correo", group: "Cuenta", render: (b) => T.codeEmail(b, { code: "771205", purpose: "VERIFY", minutes: 10 }) },
  { key: "password_reset", label: "Recuperar contraseña", group: "Cuenta", render: (b) => T.passwordResetEmail(b, { link: `${env.appUrl}/recuperar/nueva?t=EJEMPLO`, minutes: 30 }) },
  { key: "welcome", label: "Bienvenida", group: "Cuenta", render: (b) => T.welcomeEmail(b, { name: "Camila Torres" }) },
  { key: "password_changed", label: "Contraseña cambiada", group: "Cuenta", render: (b) => T.passwordChangedEmail(b, { when: "4 de octubre de 2026, 6:30 p. m.", how: "perfil" }) },
  ...(["order_created", "payment_confirmed", "delivered", "delivery_failed", "refunded", "cancelled"] as const).map((t) => ({
    key: `topup_${t}`,
    label: { order_created: "Pedido creado", payment_confirmed: "Pago confirmado", delivered: "Recarga entregada", delivery_failed: "Problema de entrega", refunded: "Reembolso", cancelled: "Pedido cancelado" }[t],
    group: "Pedidos de diamantes",
    render: (b: T.Brand) => T.orderEmail(b, t, { number: "VX-7K2M-9QHT", type: "TOPUP", item: "520 + 52 Bonus diamantes", total: "$ 16.000", playerId: "123456789", link: `${env.appUrl}/pedido/VX-7K2M-9QHT?t=EJEMPLO`, isTest: false }),
  })),
  { key: "account_paid", label: "Cuenta pagada (chat)", group: "Pedidos de cuentas", render: (b) => T.orderEmail(b, "payment_confirmed", { number: "VX-CY29-JZRW", type: "ACCOUNT", item: "Cuenta Heroico · Nivel 68", total: "$ 180.000", link: `${env.appUrl}/pedido/VX-CY29-JZRW?t=EJEMPLO`, isTest: false }) },
  { key: "account_delivered", label: "Cuenta entregada", group: "Pedidos de cuentas", render: (b) => T.orderEmail(b, "delivered", { number: "VX-CY29-JZRW", type: "ACCOUNT", item: "Cuenta Heroico · Nivel 68", total: "$ 180.000", link: `${env.appUrl}/pedido/VX-CY29-JZRW?t=EJEMPLO`, isTest: false }) },
  { key: "chat_message", label: "Mensaje nuevo en el chat", group: "Pedidos de cuentas", render: (b) => T.chatMessageEmail(b, { number: "VX-CY29-JZRW", link: `${env.appUrl}/pedido/VX-CY29-JZRW?t=EJEMPLO` }) },
  { key: "support_reply", label: "Respuesta de soporte", group: "Soporte", render: (b) => T.supportReplyEmail(b, { ref: "P8V6T6QH", body: "Hola, ya revisamos tu pedido. La recarga se acreditó hace unos minutos. Cualquier cosa, aquí estamos.", orderLink: `${env.appUrl}/pedido/VX-7K2M-9QHT?t=EJEMPLO`, accountLink: `${env.appUrl}/cuenta?seccion=soporte` }) },
  { key: "ticket_received", label: "Solicitud recibida", group: "Soporte", render: (b) => T.ticketReceivedEmail(b, { ref: "P8V6T6QH", topic: "Mi pedido", excerpt: "Hola, pagué una recarga y no me llegó. ¿Me ayudan?", accountLink: `${env.appUrl}/cuenta?seccion=soporte` }) },
  { key: "claim_received", label: "Reclamo recibido", group: "Soporte", render: (b) => T.claimReceivedEmail(b, { ref: "K2J7W9QX", listing: "Cuenta Heroico · Nivel 68" }) },
  { key: "staff_account_sold", label: "Aviso: cuenta vendida", group: "Avisos al equipo", render: (b) => T.staffAccountSoldEmail(b, { number: "VX-CY29-JZRW", item: "Cuenta Heroico · Nivel 68", total: "$ 180.000", adminLink: `${env.appUrl}/admin/chats` }) },
  { key: "staff_ticket", label: "Aviso: nueva solicitud", group: "Avisos al equipo", render: (b) => T.staffTicketEmail(b, { ref: "P8V6T6QH", topic: "reembolso", email: "cliente@example.com", excerpt: "Hola, pagué una recarga y no me llegó. ¿Me ayudan?", adminLink: `${env.appUrl}/admin/soporte` }) },
  { key: "staff_ticket_reply", label: "Aviso: el cliente respondió", group: "Avisos al equipo", render: (b) => T.staffTicketEmail(b, { ref: "P8V6T6QH", topic: "Mi pedido", email: "cliente@example.com", excerpt: "Gracias. Ya me llegó la recarga, pero me faltó el bonus.", adminLink: `${env.appUrl}/admin/soporte`, followUp: true }) },
  { key: "staff_server_error", label: "Aviso: error del servidor", group: "Avisos al equipo", render: (b) => T.staffServerErrorEmail(b, { path: "/recargas", method: "GET", message: "Can't reach database server at db:3306", digest: "2841977331", when: "5 de octubre de 2026, 3:10 p. m.", count: 3, adminLink: `${env.appUrl}/admin` }) },
  { key: "staff_chat", label: "Aviso: mensaje del cliente", group: "Avisos al equipo", render: (b) => T.staffChatEmail(b, { number: "VX-CY29-JZRW", adminLink: `${env.appUrl}/admin/chats` }) },
  { key: "staff_claim", label: "Aviso: reclamo de cuenta", group: "Avisos al equipo", render: (b) => T.staffClaimEmail(b, { ref: "K2J7W9QX", listing: "Cuenta Heroico · Nivel 68", email: "reclamante@example.com", excerpt: "Esta cuenta es mía, me la robaron en agosto. Tengo los correos de Garena.", adminLink: `${env.appUrl}/admin/reclamos` }) },
  { key: "staff_delivery_issue", label: "Aviso: recarga detenida", group: "Avisos al equipo", render: (b) => T.staffDeliveryIssueEmail(b, { number: "VX-7K2M-9QHT", item: "520 + 52 Bonus diamantes", reason: "Saldo insuficiente en el proveedor. Recarga saldo (USDT) y la entrega se reintenta sola en unos minutos.", adminLink: `${env.appUrl}/admin/pedidos` }) },
  { key: "staff_login", label: "Seguridad: nuevo ingreso al panel", group: "Seguridad del equipo", render: (b) => T.staffSecurityEmail(b, { event: "login", when: "4 de octubre de 2026, 6:30 p. m.", device: "Chrome en Windows", method: "App de autenticación" }) },
  { key: "staff_2fa_enabled", label: "Seguridad: 2FA activado", group: "Seguridad del equipo", render: (b) => T.staffSecurityEmail(b, { event: "2fa_enabled", when: "4 de octubre de 2026, 6:30 p. m.", device: "Chrome en Windows" }) },
  { key: "staff_2fa_reset", label: "Seguridad: 2FA restablecido", group: "Seguridad del equipo", render: (b) => T.staffSecurityEmail(b, { event: "2fa_reset", when: "4 de octubre de 2026, 6:30 p. m.", device: "Desconocido" }) },
  { key: "staff_recovery_regenerated", label: "Seguridad: códigos nuevos", group: "Seguridad del equipo", render: (b) => T.staffSecurityEmail(b, { event: "recovery_regenerated", when: "4 de octubre de 2026, 6:30 p. m.", device: "Chrome en Windows" }) },
];
