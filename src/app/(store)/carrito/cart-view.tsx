"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ShoppingBag, Trash2 } from "lucide-react";
import { Gem } from "@/components/brand/gem";
import { useCart } from "@/components/cart/cart-context";
import { LinkButton } from "@/components/ui/button";
import { DemoBadge, EmptyState, Skeleton } from "@/components/ui/primitives";
import { formatMoney } from "@/lib/money";
import { getCartLinesAction, type CartLine } from "@/app/actions/store";

export function CartView({ showAccounts = true }: { showAccounts?: boolean }) {
  const { items, ready, remove } = useCart();
  const [lines, setLines] = useState<CartLine[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (items.length === 0) return setLines([]);
    let cancelled = false;
    getCartLinesAction(items)
      .then((r) => !cancelled && setLines(r))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [items, ready]);

  if (error) return <p className="mt-8 text-sm text-bad-400">No pudimos cargar el carrito. Recarga la página.</p>;

  if (!ready || lines === null) {
    return (
      <div className="mt-8 space-y-3">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="mt-8">
        <EmptyState
          icon={<ShoppingBag className="size-5" />}
          title="Tu carrito está vacío"
          description={showAccounts ? "Guarda cuentas o paquetes para revisarlos después." : "Guarda paquetes de diamantes para revisarlos después."}
          action={
            <div className="flex gap-2">
              <LinkButton href="/recargas">Recargar diamantes</LinkButton>
              {showAccounts && (
                <LinkButton href="/cuentas" variant="outline">
                  Ver cuentas
                </LinkButton>
              )}
            </div>
          }
        />
      </div>
    );
  }

  return (
    <ul className="mt-8 space-y-3">
      {lines.map((l) => (
        <li key={`${l.kind}-${l.id}`} className="surface flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
          <Link href={l.href} className="relative h-20 w-full shrink-0 overflow-hidden rounded-lg border border-white/[0.06] bg-ink-850 sm:w-32">
            {l.image ? (
              <Image src={l.image} alt="" fill sizes="128px" unoptimized={l.image.endsWith(".svg")} className="object-cover" />
            ) : (
              <div className="grid h-full place-items-center">
                <Gem className="w-10" />
              </div>
            )}
          </Link>
          <div className="min-w-0 flex-1">
            <Link href={l.href} className="flex items-center gap-2 font-medium hover:text-volt-300">
              <span className="truncate">{l.title}</span> {l.isDemo && <DemoBadge />}
            </Link>
            <p className="mt-1 text-[12.5px] text-fg-muted">
              {l.kind === "package" ? "Recarga por ID de jugador" : "Cuenta digital · unidad única"}
              {!l.available && <span className="ml-2 text-warn-400">No disponible ahora</span>}
            </p>
            <p className="mt-1.5 flex items-baseline gap-2">
              <span className="font-display font-semibold tabular-nums">{formatMoney(l.price, l.currency)}</span>
              {l.original != null && <span className="text-[12.5px] text-fg-subtle line-through">{formatMoney(l.original, l.currency)}</span>}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => remove({ kind: l.kind, id: l.id })}
              className="grid size-10 place-items-center rounded-lg text-fg-subtle hover:bg-white/5 hover:text-bad-400"
              aria-label={`Quitar ${l.title}`}
            >
              <Trash2 className="size-4" />
            </button>
            {l.available ? (
              <LinkButton href={l.checkoutHref}>Comprar</LinkButton>
            ) : (
              <span className="inline-flex h-10 items-center rounded-lg px-4 text-sm text-fg-subtle">No disponible</span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
