"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Boxes,
  ChevronDown,
  Flag,
  Gem,
  History,
  Home,
  Images,
  Inbox,
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

export function AdminNav({ isAdmin, badges }: { isAdmin: boolean; badges: Record<Badge, number> }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  const active = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

  const groups = GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => isAdmin || !i.admin) })).filter((g) => g.items.length > 0);
  const settingsActive = groups.some((g) => g.collapsible && g.items.some((i) => active(i.href)));
  const [showSettings, setShowSettings] = useState(settingsActive);
  useEffect(() => {
    if (settingsActive) setShowSettings(true);
  }, [settingsActive]);

  const link = ({ href, label, icon: Icon, badge }: Item) => {
    const count = badge ? badges[badge] : 0;
    const on = active(href);
    return (
      <li key={href}>
        <Link
          href={href}
          aria-current={on ? "page" : undefined}
          className={cn(
            "flex h-9 items-center gap-2.5 rounded-lg px-3 text-[13.5px] transition-colors",
            on ? "bg-white/[0.07] font-medium text-fg" : "text-fg-muted hover:bg-white/[0.04] hover:text-fg",
          )}
        >
          <Icon className={cn("size-4", on && "text-volt-300")} />
          {label}
          {count > 0 && <span className="ml-auto rounded-full bg-warn-400/15 px-1.5 text-[11px] font-semibold tabular-nums text-warn-400">{count}</span>}
        </Link>
      </li>
    );
  };

  const list = (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g.title ?? "inicio"}>
          {g.title &&
            (g.collapsible ? (
              <button
                type="button"
                onClick={() => setShowSettings((v) => !v)}
                aria-expanded={showSettings}
                className="mb-1 flex w-full items-center justify-between px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-subtle hover:text-fg-muted"
              >
                {g.title}
                <ChevronDown className={cn("size-3.5 transition-transform", showSettings && "rotate-180")} />
              </button>
            ) : (
              <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-subtle">{g.title}</p>
            ))}
          {(!g.collapsible || showSettings) && <ul className="space-y-0.5">{g.items.map(link)}</ul>}
        </div>
      ))}
    </div>
  );

  return (
    <>
      <button type="button" className="grid size-9 place-items-center rounded-lg border border-white/10 lg:hidden" onClick={() => setOpen((v) => !v)} aria-label="Menú del panel" aria-expanded={open}>
        {open ? <X className="size-4" /> : <Menu className="size-4" />}
      </button>
      <nav className="hidden lg:block" aria-label="Panel">
        {list}
      </nav>
      {open && (
        <nav className="fixed inset-x-0 bottom-0 top-14 z-40 overflow-y-auto border-t border-white/[0.06] bg-ink-900 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:hidden" aria-label="Panel móvil">
          <form action="/admin/pedidos" method="get" role="search" className="mb-4">
            <input name="q" placeholder="Buscar pedido, correo o ID" aria-label="Buscar en pedidos" className="field h-10" />
          </form>
          {list}
        </nav>
      )}
    </>
  );
}
