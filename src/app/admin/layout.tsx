import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, LogOut } from "lucide-react";
import { AdminNav } from "@/components/admin/admin-nav";
import { LogoMark } from "@/components/brand/logo";
import { requireStaff } from "@/lib/auth";
import { getAdminCounts } from "@/server/admin-counts";
import { AdminPulse } from "@/components/admin/admin-pulse";
import { logoutAction } from "@/app/actions/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { default: "Panel", template: "%s · Panel" }, robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();
  const counts = await getAdminCounts();

  return (
    <div className="min-h-dvh bg-ink-950">
      <AdminPulse initial={counts} />
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-white/[0.06] bg-ink-950/90 px-4 backdrop-blur lg:hidden">
        <AdminNav isAdmin={user.role === "ADMIN"} badges={counts} email={user.email} />
        <LogoMark className="size-7" />
        <span className="text-sm font-semibold">Panel</span>
      </header>
      <div className="mx-auto flex max-w-[1500px]">
        <aside aria-label="Menú del panel" className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-white/[0.06] p-4 lg:flex">
          <Link href="/admin" className="mb-6 flex items-center gap-2.5 px-2">
            <LogoMark className="size-7" />
            <span className="text-sm font-semibold tracking-wide">Panel de control</span>
          </Link>
          <form action="/admin/pedidos" method="get" role="search" className="mb-4 px-1">
            <input name="q" placeholder="Buscar pedido, correo o ID" aria-label="Buscar en pedidos" className="field h-9 text-[12.5px]" />
          </form>
          <AdminNav isAdmin={user.role === "ADMIN"} badges={counts} />
          <div className="mt-auto space-y-1 border-t border-white/[0.06] pt-4">
            <p className="truncate px-3 text-[12px] text-fg-muted">{user.email}</p>
            <p className="px-3 text-[11px] uppercase tracking-wider text-fg-subtle">{user.role === "ADMIN" ? "Administrador" : "Soporte"}</p>
            <Link href="/" className="flex h-9 items-center gap-2 rounded-lg px-3 text-[13px] text-fg-muted hover:bg-white/[0.04] hover:text-fg">
              <ExternalLink className="size-4" /> Ver tienda
            </Link>
            <form action={logoutAction}>
              <button type="submit" className="flex h-9 w-full items-center gap-2 rounded-lg px-3 text-[13px] text-fg-muted hover:bg-white/[0.04] hover:text-fg">
                <LogOut className="size-4" /> Cerrar sesión
              </button>
            </form>
          </div>
        </aside>
        <main id="contenido" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
