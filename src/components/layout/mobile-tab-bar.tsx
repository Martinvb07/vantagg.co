"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gem, Home, Radar, ShoppingBag, UserRound } from "lucide-react";
import { useCart } from "@/components/cart/cart-context";
import { cn } from "@/lib/utils";

/** Barra de navegación inferior estilo app, solo en celular y tablet. Se oculta cuando aparece la barra de pago. */
export function MobileTabBar({ loggedIn }: { loggedIn: boolean }) {
  const pathname = usePathname();
  const { items, ready } = useCart();
  const count = ready ? items.length : 0;

  const tabs = [
    { href: "/", label: "Inicio", icon: Home },
    { href: "/recargas", label: "Diamantes", icon: Gem },
    { href: "/pedido", label: "Pedido", icon: Radar },
    { href: "/carrito", label: "Carrito", icon: ShoppingBag, badge: count },
    loggedIn ? { href: "/cuenta", label: "Cuenta", icon: UserRound } : { href: "/ingresar", label: "Ingresar", icon: UserRound },
  ];
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <>
      {/* Reserva el espacio de la barra para que no tape el final de la página. */}
      <div aria-hidden className="tabbar-spacer h-[calc(4rem+env(safe-area-inset-bottom))] lg:hidden" />
      <nav
        aria-label="Navegación inferior"
        className="tabbar fixed inset-x-0 bottom-0 z-30 border-t border-white/[0.07] bg-ink-900/85 pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_30px_-18px_rgb(0_0_0/0.9)] backdrop-blur-xl backdrop-saturate-150 lg:hidden"
      >
        <ul className="mx-auto grid h-16 max-w-xl grid-cols-5">
          {tabs.map(({ href, label, icon: Icon, badge }) => {
            const active = isActive(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn("relative flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors", active ? "text-fg" : "text-fg-subtle active:text-fg-muted")}
                >
                  {active && <span aria-hidden className="absolute top-0 h-[3px] w-8 rounded-b-full bg-volt-400 shadow-[0_0_12px_rgb(200_240_79/0.7)]" />}
                  <span className={cn("relative grid h-7 w-12 place-items-center rounded-full transition-colors", active && "bg-volt-400/15 text-volt-300")}>
                    <Icon className="size-[19px]" strokeWidth={active ? 2.3 : 2} />
                    {!!badge && (
                      <span className="absolute -top-1 right-1.5 grid min-w-[17px] place-items-center rounded-full bg-volt-400 px-1 text-[10px] font-bold leading-[17px] text-volt-ink ring-2 ring-ink-900">{badge}</span>
                    )}
                  </span>
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
