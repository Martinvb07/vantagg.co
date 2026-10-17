"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  Boxes,
  ChevronDown,
  ExternalLink,
  Flag,
  Gem,
  History,
  Home,
  Images,
  Inbox,
  LogOut,
  Mail,
  Menu,
  MessagesSquare,
  Plug,
  Receipt,
  Settings,
  ShieldCheck,
  Ticket,
  UserRound,
  Users,
  Warehouse,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/app/actions/auth";

type Badge = "orders" | "claims" | "tickets" | "chats";
type Item = { href: string; label: string; icon: typeof Home; admin: boolean; badge?: Badge };
type Group = { title?: string; items: Item[]; collapsible?: boolean };

/** Menú agrupado por tarea, con nombres simples. Configuración va plegada (se usa poco). */
const GROUPS: Group[] = [
  { items: [{ href: "/admin", label: "Inicio", icon: Home, admin: false }] },
  {
    title: "Ventas",
    items: [
      { href: "/admin/pedidos", label: "Pedidos", icon: Receipt, admin: false, badge: "orders" },
      { href: "/admin/chats", label: "Entregar cuentas", icon: MessagesSquare, admin: false, badge: "chats" },
      { href: "/admin/clientes", label: "Clientes", icon: UserRound, admin: false },
    ],
  },
  {
    title: "Tienda",
    items: [
      { href: "/admin/paquetes", label: "Diamantes y precios", icon: Gem, admin: true },
      { href: "/admin/cuentas", label: "Cuentas en venta", icon: Boxes, admin: true },
      { href: "/admin/proveedor", label: "Proveedor y saldo", icon: Warehouse, admin: true },
      { href: "/admin/codigos", label: "Descuentos", icon: Ticket, admin: true },
      { href: "/admin/banners", label: "Banners", icon: Images, admin: true },
    ],
  },
  {
    title: "Atención",
    items: [
      { href: "/admin/soporte", label: "Soporte", icon: Inbox, admin: false, badge: "tickets" },
      { href: "/admin/reclamos", label: "Reclamos", icon: Flag, admin: false, badge: "claims" },
    ],
  },
  {
    title: "Configuración",
    collapsible: true,
    items: [
      { href: "/admin/ajustes", label: "Ajustes de la tienda", icon: Settings, admin: true },
      { href: "/admin/integraciones", label: "Integraciones", icon: Plug, admin: true },
      { href: "/admin/correos", label: "Correos", icon: Mail, admin: true },
      { href: "/admin/usuarios", label: "Equipo", icon: Users, admin: true },
      { href: "/admin/auditoria", label: "Historial de cambios", icon: History, admin: true },
      { href: "/admin/seguridad", label: "Mi seguridad", icon: ShieldCheck, admin: false },
    ],
  },
];

export function AdminNav({ isAdmin, badges, email }: { isAdmin: boolean; badges: Record<Badge, number>; email?: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  // Menú del celular abierto: la página de atrás no se mueve (mismo enfoque que el menú de la tienda).
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    root.style.overflow = "hidden";
    const blockTouch = (e: TouchEvent) => {
      if (!(e.target as HTMLElement | null)?.closest("#admin-mobile-menu")) e.preventDefault();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const mq = window.matchMedia("(min-width: 1024px)");
    const onWide = () => mq.matches && setOpen(false);
    document.addEventListener("touchmove", blockTouch, { passive: false });
    document.addEventListener("keydown", onKey);
    mq.addEventListener("change", onWide);
    return () => {
      root.style.overflow = "";
      document.removeEventListener("touchmove", blockTouch);
      document.removeEventListener("keydown", onKey);
      mq.removeEventListener("change", onWide);
    };
  }, [open]);
  const active = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

  const groups = GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => isAdmin || !i.admin) })).filter((g) => g.items.length > 0);
  const settingsActive = groups.some((g) => g.collapsible && g.items.some((i) => active(i.href)));
  const [showSettings, setShowSettings] = useState(settingsActive);
  useEffect(() => {
    if (settingsActive) setShowSettings(true);
  }, [settingsActive]);

  const link = ({ href, label, icon: Icon, badge }: Item, big = false) => {
    const count = badge ? badges[badge] : 0;
    const on = active(href);
    return (
      <li key={href}>
        <Link
          href={href}
          aria-current={on ? "page" : undefined}
          onClick={() => setOpen(false)}
          className={cn(
            "flex items-center gap-2.5 rounded-lg px-3 transition-colors",
            big ? "h-12 text-[15px] active:bg-white/[0.06]" : "h-9 text-[13.5px]",
            on ? "bg-white/[0.07] font-medium text-fg" : "text-fg-muted hover:bg-white/[0.04] hover:text-fg",
          )}
        >
          <Icon className={cn(big ? "size-[18px]" : "size-4", on && "text-volt-300")} />
          {label}
          {count > 0 && <span className="ml-auto rounded-full bg-warn-400/15 px-1.5 text-[11px] font-semibold tabular-nums text-warn-400">{count}</span>}
        </Link>
      </li>
    );
  };

  const list = (big = false) => (
    <div className={big ? "space-y-5" : "space-y-4"}>
      {groups.map((g) => (
        <div key={g.title ?? "inicio"}>
          {g.title &&
            (g.collapsible ? (
              <button
                type="button"
                onClick={() => setShowSettings((v) => !v)}
                aria-expanded={showSettings}
                className={cn("mb-1 flex w-full items-center justify-between px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-subtle hover:text-fg-muted", big && "h-10")}
              >
                {g.title}
                <ChevronDown className={cn("size-3.5 transition-transform", showSettings && "rotate-180")} />
              </button>
            ) : (
              <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-subtle">{g.title}</p>
            ))}
          {(!g.collapsible || showSettings) && <ul className="space-y-0.5">{g.items.map((i) => link(i, big))}</ul>}
        </div>
      ))}
    </div>
  );

  return (
    <>
      <button type="button" className="grid size-10 place-items-center rounded-lg border border-white/10 lg:hidden" onClick={() => setOpen((v) => !v)} aria-label={open ? "Cerrar menú del panel" : "Abrir menú del panel"} aria-expanded={open} aria-controls="admin-mobile-menu">
        {open ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>
      <nav className="hidden lg:block" aria-label="Panel">
        {list()}
      </nav>
      {/* En un portal: el encabezado del celular usa backdrop-blur, que encierra a los hijos `fixed` en sus 56 px. */}
      {open &&
        createPortal(
          <nav
            id="admin-mobile-menu"
            className="fixed inset-x-0 bottom-0 top-14 z-50 flex animate-fade-in flex-col overflow-y-auto overscroll-contain border-t border-white/[0.06] bg-ink-950 lg:hidden"
            aria-label="Panel móvil"
          >
            <div className="flex-1 p-4">
              <form action="/admin/pedidos" method="get" role="search" className="mb-5">
                <input name="q" type="search" enterKeyHint="search" placeholder="Buscar pedido, correo o ID" aria-label="Buscar en pedidos" className="field h-11 text-[15px]" />
              </form>
              {list(true)}
            </div>
            <div className="space-y-1 border-t border-white/[0.06] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {email && (
                <p className="truncate px-3 pb-1 text-[12.5px] text-fg-muted">
                  {email} · {isAdmin ? "Administrador" : "Soporte"}
                </p>
              )}
              <Link href="/" className="flex h-12 items-center gap-2.5 rounded-lg px-3 text-[15px] text-fg-muted active:bg-white/[0.06]">
                <ExternalLink className="size-[18px]" /> Ver tienda
              </Link>
              <form action={logoutAction}>
                <button type="submit" className="flex h-12 w-full items-center gap-2.5 rounded-lg px-3 text-[15px] text-fg-muted active:bg-white/[0.06]">
                  <LogOut className="size-[18px]" /> Cerrar sesión
                </button>
              </form>
            </div>
          </nav>,
          document.body,
        )}
    </>
  );
}
