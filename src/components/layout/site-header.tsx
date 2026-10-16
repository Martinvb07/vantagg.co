"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, Gem, Home, LayoutDashboard, LifeBuoy, LogIn, Menu, Radar, Search, ShoppingBag, Users, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { useCart } from "@/components/cart/cart-context";
import { cn } from "@/lib/utils";
import { SearchBox } from "./search-box";
import { UserAvatar } from "@/components/account/user-avatar";

const NAV = [
  { href: "/recargas", label: "Diamantes", icon: Gem },
  { href: "/cuentas", label: "Cuentas", icon: Users },
  { href: "/pedido", label: "Seguimiento", icon: Radar },
  { href: "/ayuda", label: "Ayuda", icon: LifeBuoy },
];

type Props = {
  storeName: string;
  logoUrl?: string;
  user: { name: string | null; email: string; staff: boolean; avatarUrl: string | null; avatarPreset: string | null } | null;
  /** false: la sección de cuentas está oculta (sin cuentas publicadas o desactivada). */
  showAccounts?: boolean;
};

export function SiteHeader({ storeName, logoUrl, user, showAccounts = true }: Props) {
  const nav = showAccounts ? NAV : NAV.filter((n) => n.href !== "/cuentas");
  const pathname = usePathname();
  const { items, ready } = useCart();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const mobileSearchRef = useRef<HTMLInputElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const [menuTop, setMenuTop] = useState(68);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (open && headerRef.current) setMenuTop(Math.max(0, headerRef.current.getBoundingClientRect().bottom));
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (searchOpen) mobileSearchRef.current?.focus();
  }, [searchOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setSearchOpen(false);
      }
      if (e.key === "/" && !(e.target as HTMLElement)?.closest("input,textarea,select")) {
        e.preventDefault();
        if (window.matchMedia("(min-width: 768px)").matches) searchRef.current?.focus();
        else setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const count = ready ? items.length : 0;

  return (
    <header
      ref={headerRef}
      className={cn(
        "sticky top-0 z-40 transition-[background,box-shadow,backdrop-filter] duration-300",
        scrolled || open ? "bg-ink-900/80 shadow-[0_1px_0_0_rgb(255_255_255/0.06),0_12px_30px_-18px_rgb(0_0_0/0.8)] backdrop-blur-xl backdrop-saturate-150" : "bg-transparent",
      )}
    >
      <div className="mx-auto flex h-[60px] max-w-[1240px] sm:h-[68px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="shrink-0 rounded-lg" aria-label={`${storeName} — inicio`}>
          <Logo name={storeName} logoUrl={logoUrl} />
        </Link>

        {/* Navegación principal en cápsula */}
        <nav className="ml-4 hidden items-center gap-0.5 rounded-full bg-white/[0.035] p-1 ring-1 ring-white/[0.07] lg:flex" aria-label="Principal">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-[13.5px] font-medium transition-[background,color,box-shadow] duration-200",
                  active ? "bg-white/[0.09] text-fg shadow-[0_1px_0_0_rgb(255_255_255/0.08)_inset]" : "text-fg-muted hover:bg-white/[0.05] hover:text-fg",
                )}
              >
                <Icon className={cn("size-4 transition-colors", active ? "text-volt-300" : "text-fg-subtle group-hover:text-fg-muted")} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {/* Búsqueda escritorio */}
          <SearchBox variant="desktop" inputRef={searchRef} showAccounts={showAccounts} />

          <button
            type="button"
            className="grid size-10 place-items-center rounded-full text-fg-muted transition-colors hover:bg-white/[0.06] hover:text-fg md:hidden"
            aria-label="Buscar"
            aria-expanded={searchOpen}
            onClick={() => setSearchOpen((v) => !v)}
          >
            <Search className="size-[18px]" />
          </button>

          {/* Carrito */}
          <Link
            href="/carrito"
            className={cn(
              "relative hidden size-10 place-items-center rounded-full ring-1 transition-colors lg:grid",
              isActive("/carrito") ? "bg-white/[0.09] text-fg ring-white/15" : "text-fg-muted ring-white/[0.08] hover:bg-white/[0.06] hover:text-fg",
            )}
            aria-label={`Carrito (${count})`}
          >
            <ShoppingBag className="size-[18px]" />
            {count > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid min-w-[18px] place-items-center rounded-full bg-volt-400 px-1 text-[10px] font-bold leading-[18px] text-volt-ink ring-2 ring-ink-900">{count}</span>
            )}
          </Link>

          {user?.staff && (
            <Link
              href="/admin"
              className="hidden h-10 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium text-fg-muted ring-1 ring-white/[0.08] transition-colors hover:bg-white/[0.06] hover:text-fg sm:inline-flex"
            >
              <LayoutDashboard className="size-4" /> Panel
            </Link>
          )}

          {user ? (
            <Link href="/cuenta" className="hidden h-10 items-center gap-2 rounded-full bg-white/[0.06] pl-1 pr-3.5 text-[13px] font-medium ring-1 ring-white/10 transition-colors hover:bg-white/10 sm:inline-flex">
              <UserAvatar user={user} size={32} ring={false} />
              <span className="max-w-28 truncate">{user.name && user.name !== "No Name" ? user.name.split(" ")[0] : "Mi cuenta"}</span>
            </Link>
          ) : (
            <Link
              href="/ingresar"
              className="hidden h-10 items-center gap-2 rounded-full bg-volt-400 px-4 text-[13.5px] font-semibold text-volt-ink shadow-[0_1px_0_0_rgb(255_255_255/0.35)_inset,0_6px_20px_-8px_rgb(200_240_79/0.6)] transition-colors hover:bg-volt-300 sm:inline-flex"
            >
              <LogIn className="size-4" /> Ingresar
            </Link>
          )}

          <button
            type="button"
            className="grid size-10 place-items-center rounded-full text-fg ring-1 ring-white/[0.08] transition-colors hover:bg-white/[0.06] lg:hidden"
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {/* Búsqueda móvil */}
      {searchOpen && (
        <div className="px-4 pb-3 md:hidden">
          <SearchBox variant="mobile" inputRef={mobileSearchRef} onNavigate={() => setSearchOpen(false)} showAccounts={showAccounts} />
        </div>
      )}

      {/* Menú móvil */}
      {open &&
        typeof document !== "undefined" &&
        createPortal(
        <div id="mobile-menu" style={{ top: menuTop }} className="fixed inset-x-0 bottom-0 z-50 overflow-y-auto border-t border-white/[0.06] bg-ink-900 pb-[env(safe-area-inset-bottom)] lg:hidden">
          <nav className="flex flex-col gap-1.5 px-4 py-4" aria-label="Menú móvil">
            {[{ href: "/", label: "Inicio", icon: Home }, ...nav].map(({ href, label, icon: Icon }, i) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  style={{ animationDelay: `${i * 30}ms` }}
                  className={cn(
                    "flex animate-fade-up items-center gap-3.5 rounded-[14px] px-4 py-3.5 text-[16px] font-semibold ring-1 transition-colors",
                    active ? "bg-white/[0.07] ring-white/12" : "ring-white/[0.05] hover:bg-white/[0.04]",
                  )}
                >
                  <span className={cn("grid size-9 place-items-center rounded-xl", active ? "bg-volt-400/15 text-volt-300" : "bg-white/[0.05] text-fg-muted")}>
                    <Icon className="size-[18px]" />
                  </span>
                  {label}
                  <ChevronRight className="ml-auto size-4 text-fg-subtle" />
                </Link>
              );
            })}
            <div className="mt-4 grid grid-cols-2 gap-2">
              {user ? (
                <Link href="/cuenta" className="flex h-12 items-center justify-center gap-2 rounded-full bg-white/[0.06] text-sm font-semibold ring-1 ring-white/10">
                  <UserAvatar user={user} size={26} ring={false} /> Mi cuenta
                </Link>
              ) : (
                <Link href="/ingresar" className="flex h-12 items-center justify-center gap-2 rounded-full bg-volt-400 text-sm font-semibold text-volt-ink">
                  <LogIn className="size-4" /> Ingresar
                </Link>
              )}
              {user?.staff ? (
                <Link href="/admin" className="flex h-12 items-center justify-center gap-2 rounded-full bg-white/[0.06] text-sm font-semibold ring-1 ring-white/10">
                  <LayoutDashboard className="size-4" /> Panel
                </Link>
              ) : (
                <Link href="/carrito" className="flex h-12 items-center justify-center gap-2 rounded-full bg-white/[0.06] text-sm font-semibold ring-1 ring-white/10">
                  <ShoppingBag className="size-4" /> Carrito{count ? ` (${count})` : ""}
                </Link>
              )}
            </div>
          </nav>
        </div>,
          document.body,
        )}
    </header>
  );
}
