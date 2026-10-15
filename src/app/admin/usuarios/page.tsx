import { ActionForm, ConfirmSubmit, SubmitButton } from "@/components/admin/action-form";
import { Field, PageHeader, Panel, Table } from "@/components/admin/ui";
import { Badge } from "@/components/ui/primitives";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/money";
import { createStaffAction, userAction } from "@/app/actions/admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Equipo" };

const ROLE = { ADMIN: "Administrador", SUPPORT: "Soporte", CUSTOMER: "Cliente" } as const;

export default async function UsersAdmin({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const me = await requireAdmin();
  const { q } = await searchParams;
  const users = await db.user.findMany({
    where: q ? { email: { contains: q.slice(0, 80) } } : { role: { in: ["ADMIN", "SUPPORT"] } },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { _count: { select: { orders: true } } },
  });
  return (
    <>
      <PageHeader title="Equipo" description="Personas con acceso al panel. Soporte: pedidos, entregas, reclamos y mensajes. Administrador: además precios, catálogo y configuración." />
      <form method="get" className="mb-4 flex max-w-md gap-2">
        <input name="q" defaultValue={q} placeholder="Buscar por correo (incluye clientes)" className="field" />
        <button className="rounded-lg border border-white/10 px-3 text-sm">Buscar</button>
      </form>
      <Table>
        <thead>
          <tr>
            <th>Usuario</th>
            <th>Rol</th>
            <th>Pedidos</th>
            <th>Alta</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>
                {u.email}
                <span className="block text-[11.5px] text-fg-subtle">{u.name}</span>
              </td>
              <td>
                <Badge tone={u.role === "ADMIN" ? "accent" : u.role === "SUPPORT" ? "info" : "neutral"}>{ROLE[u.role]}</Badge>
                {u.disabled && <Badge tone="danger" className="ml-1.5">Deshabilitado</Badge>}
                {u.role !== "CUSTOMER" && (
                  <span className={`mt-1 block text-[11.5px] ${u.totpEnabledAt ? "text-ok-400" : "text-warn-400"}`}>{u.totpEnabledAt ? "2FA activo" : "2FA pendiente (al ingresar)"}</span>
                )}
              </td>
              <td>{u._count.orders}</td>
              <td className="text-fg-muted">{formatDate(u.createdAt, false)}</td>
              <td>
                {u.id === me.id ? (
                  <span className="text-[12px] text-fg-subtle">Tu usuario</span>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <ActionForm action={userAction} className="flex items-center gap-1.5">
                      <input type="hidden" name="id" value={u.id} />
                      <input type="hidden" name="op" value="role" />
                      <select name="role" defaultValue={u.role} aria-label={`Rol de ${u.email}`} className="field h-8 w-auto py-1 text-[12.5px]">
                        {Object.entries(ROLE).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                      <SubmitButton size="sm" variant="secondary">
                        Cambiar
                      </SubmitButton>
                    </ActionForm>
                    <ActionForm action={userAction}>
                      <input type="hidden" name="id" value={u.id} />
                      <input type="hidden" name="op" value="toggle" />
                      <ConfirmSubmit confirmText="Confirmar">{u.disabled ? "Habilitar" : "Deshabilitar"}</ConfirmSubmit>
                    </ActionForm>
                    {u.role !== "CUSTOMER" && u.totpEnabledAt && (
                      <ActionForm action={userAction}>
                        <input type="hidden" name="id" value={u.id} />
                        <input type="hidden" name="op" value="reset2fa" />
                        <ConfirmSubmit confirmText="Confirmar">Restablecer 2FA</ConfirmSubmit>
                      </ActionForm>
                    )}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

      <Panel title="Crear usuario del equipo" className="mt-8 max-w-2xl">
        <ActionForm action={createStaffAction} resetOnSuccess>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre">
              <input name="name" required className="field" />
            </Field>
            <Field label="Correo">
              <input name="email" type="email" required className="field" />
            </Field>
            <Field label="Contraseña temporal" hint="Mínimo 10 caracteres con letras y números. Al ingresar por la dirección secreta deberá activar su 2FA.">
              <input name="password" type="password" required minLength={10} autoComplete="new-password" className="field" />
            </Field>
            <Field label="Rol">
              <select name="role" defaultValue="SUPPORT" className="field">
                <option value="SUPPORT">Soporte</option>
                <option value="ADMIN">Administrador</option>
              </select>
            </Field>
          </div>
          <div className="mt-4">
            <SubmitButton size="sm">Crear usuario</SubmitButton>
          </div>
        </ActionForm>
      </Panel>
    </>
  );
}
