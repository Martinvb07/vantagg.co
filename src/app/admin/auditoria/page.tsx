import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { PageHeader, Table } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/money";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Historial de cambios" };

const PAGE = 50;

const GROUPS = [
  { k: "", l: "Todo" },
  { k: "order.", l: "Pedidos" },
  { k: "chat.", l: "Chats" },
  { k: "account", l: "Cuentas" },
  { k: "package.", l: "Paquetes" },
  { k: "supplier.", l: "Proveedor" },
  { k: "promo.", l: "Códigos" },
  { k: "banner.", l: "Banners" },
  { k: "ticket.", l: "Soporte" },
  { k: "claim.", l: "Reclamaciones" },
  { k: "export.", l: "Exportaciones" },
  { k: "auth.", l: "Accesos" },
  { k: "user.", l: "Usuarios" },
  { k: "settings.", l: "Ajustes" },
] as const;

const LABELS: Record<string, string> = {
  "auth.login": "Inicio de sesión",
  "auth.login_failed": "Inicio de sesión fallido",
  "auth.password_changed": "Cambio de contraseña",
  "auth.register": "Registro de cliente",
  "auth.reset_requested": "Solicitud de recuperación de contraseña",
  "auth.password_reset": "Contraseña restablecida con enlace",
  "auth.password_created": "Contraseña creada",
  "auth.login_code": "Ingreso con código por correo",
  "auth.register_code": "Cuenta creada con código por correo",
  "auth.email_verified": "Correo verificado",
  "auth.login_google": "Ingreso con Google",
  "auth.google_linked": "Google vinculado a una cuenta existente",
  "auth.register_google": "Cuenta creada con Google",
  "email.test": "Correo de prueba",
  "profile.update": "Cliente actualizó su perfil",
  "profile.avatar_upload": "Cliente subió foto de perfil",
  "auth.logout_all": "Cerró sesión en todos los dispositivos",
  "auth.staff_login": "Ingreso al panel con 2FA",
  "auth.staff_login_recovery": "Ingreso al panel con código de recuperación",
  "auth.staff_login_failed": "Contraseña incorrecta en el panel",
  "auth.staff_2fa_failed": "Código 2FA incorrecto",
  "auth.staff_2fa_enabled": "2FA activado",
  "auth.staff_recovery_regenerated": "Códigos de recuperación regenerados",
  "auth.staff_2fa_reset_cli": "2FA restablecido desde la consola",
  "user.reset2fa": "2FA restablecido por un administrador",
  "order.reconcile": "Conciliación con la pasarela",
  "order.retry": "Reintento de entrega",
  "order.delivered": "Entrega de cuenta registrada",
  "order.transition": "Cambio de estado del pedido",
  "chat.message": "Mensaje en chat de entrega",
  "chat.image": "Imagen en chat de entrega",
  "ticket.reply": "Respuesta a soporte",
  "ticket.status": "Estado de solicitud de soporte",
  "export.orders": "Exportación de pedidos",
  "export.customers": "Exportación de clientes",
  "package.create": "Paquete creado",
  "package.update": "Paquete editado",
  "package.delete": "Paquete eliminado",
  "package.deactivate": "Paquete desactivado",
  "supplier.sync": "Catálogo del proveedor sincronizado",
  "supplier.rates": "Tasa o margen del proveedor cambiados",
  "supplier.region_on": "Región de recargas activada",
  "supplier.region_off": "Región de recargas ocultada",
  "supplier.reprice": "Precios de una región recalculados",
  "package.bonus_all": "Bonus aplicado a todos los paquetes",
  "account.create": "Cuenta creada",
  "account.update": "Cuenta editada",
  "account.status": "Estado de cuenta",
  "account.images_upload": "Imágenes de cuenta subidas",
  "promo.deactivate": "Código desactivado",
  "banner.create": "Banner publicado",
  "settings.update": "Ajustes guardados",
  "integration.test": "Prueba de integración",
  "user.create": "Usuario del equipo creado",
};

export default async function AuditAdmin({ searchParams }: { searchParams: Promise<{ g?: string; p?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const group = GROUPS.find((g) => g.k === sp.g)?.k ?? "";
  const page = Math.max(1, Number(sp.p) || 1);
  const where: Prisma.AuditLogWhereInput = group ? { action: { startsWith: group } } : {};
  const [logs, total, webhooks] = await Promise.all([
    db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, take: PAGE, skip: (page - 1) * PAGE, include: { actor: { select: { email: true } } } }),
    db.auditLog.count({ where }),
    db.webhookEvent.findMany({ orderBy: { createdAt: "desc" }, take: 30 }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const link = (g: string, p = 1) => `/admin/auditoria?${new URLSearchParams({ ...(g ? { g } : {}), ...(p > 1 ? { p: String(p) } : {}) })}`;

  return (
    <>
      <PageHeader title="Historial de cambios" description={`Quién cambió qué y cuándo (no se puede borrar) · ${total} registro(s)`} />
      <nav className="mb-4 flex flex-wrap gap-1" aria-label="Categoría">
        {GROUPS.map((g) => (
          <Link key={g.k || "all"} href={link(g.k)} className={cn("rounded-full px-3 py-1.5 text-[12.5px] font-medium", group === g.k ? "bg-white/[0.09] text-fg" : "text-fg-muted hover:text-fg")}>
            {g.l}
          </Link>
        ))}
      </nav>
      <Table>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Usuario</th>
            <th>Acción</th>
            <th>Entidad</th>
            <th>Detalle</th>
          </tr>
        </thead>
        <tbody>
          {logs.length === 0 && (
            <tr>
              <td colSpan={5} className="py-10 text-center text-fg-muted">
                Sin registros en esta categoría.
              </td>
            </tr>
          )}
          {logs.map((l) => (
            <tr key={l.id}>
              <td className="whitespace-nowrap text-fg-muted">{formatDate(l.createdAt)}</td>
              <td>{l.actor?.email ?? "Sistema"}</td>
              <td>
                <span className="block text-[13px]">{LABELS[l.action] ?? l.action}</span>
                <span className="font-mono text-[11px] text-fg-subtle">{l.action}</span>
              </td>
              <td className="text-fg-muted">
                {l.entity}
                {l.entityId && (
                  <span className="block font-mono text-[11px] text-fg-subtle">
                    {l.entity === "Order" ? (
                      <Link href={`/admin/pedidos/${l.entityId}`} className="hover:text-fg">
                        {l.entityId}
                      </Link>
                    ) : (
                      l.entityId
                    )}
                  </span>
                )}
              </td>
              <td className="max-w-[340px] truncate font-mono text-[11px] text-fg-subtle" title={l.data ? JSON.stringify(l.data) : undefined}>
                {l.data ? JSON.stringify(l.data) : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      {pages > 1 && (
        <nav className="mt-4 flex items-center justify-between text-[13px]" aria-label="Paginación">
          <span className="text-fg-muted">
            Página {page} de {pages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={link(group, page - 1)} className="rounded-md border border-white/10 px-3 py-1.5 hover:border-white/20">
                Anterior
              </Link>
            )}
            {page < pages && (
              <Link href={link(group, page + 1)} className="rounded-md border border-white/10 px-3 py-1.5 hover:border-white/20">
                Siguiente
              </Link>
            )}
          </div>
        </nav>
      )}

      <h2 className="eyebrow mb-3 mt-10">Webhooks recibidos</h2>
      <Table>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Proveedor</th>
            <th>Evento</th>
            <th>Firma</th>
            <th>Procesado</th>
          </tr>
        </thead>
        <tbody>
          {webhooks.length === 0 && (
            <tr>
              <td colSpan={5} className="py-8 text-center text-fg-muted">
                Aún no llegan webhooks. Llegarán cuando conectes Bold y el webhook del proveedor de recargas.
              </td>
            </tr>
          )}
          {webhooks.map((w) => (
            <tr key={w.id}>
              <td className="whitespace-nowrap text-fg-muted">{formatDate(w.createdAt)}</td>
              <td>{w.provider}</td>
              <td className="font-mono text-[11.5px]">{w.externalId}</td>
              <td className={w.signatureValid ? "text-ok-400" : "text-bad-400"}>{w.signatureValid ? "Válida" : "Inválida"}</td>
              <td className={w.error ? "text-bad-400" : "text-fg-muted"}>{w.error ?? (w.processedAt ? formatDate(w.processedAt) : "Pendiente")}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}
