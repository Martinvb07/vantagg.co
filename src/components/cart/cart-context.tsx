"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/**
 * El carrito solo guarda referencias (tipo + id). Precios, disponibilidad y
 * descuentos se consultan al servidor cada vez que se muestran.
 */
export type CartRef = { kind: "account" | "package"; id: string };

type CartCtx = {
  items: CartRef[];
  ready: boolean;
  add: (ref: CartRef) => void;
  remove: (ref: CartRef) => void;
  has: (ref: CartRef) => boolean;
  clear: () => void;
};

const Ctx = createContext<CartCtx | null>(null);
const KEY = "vx_cart_v1";

const same = (a: CartRef, b: CartRef) => a.kind === b.kind && a.id === b.id;

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartRef[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CartRef[];
        if (Array.isArray(parsed)) setItems(parsed.filter((i) => (i.kind === "account" || i.kind === "package") && typeof i.id === "string").slice(0, 30));
      }
    } catch {
      /* almacenamiento no disponible */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch {
      /* ignorar */
    }
  }, [items, ready]);

  const add = useCallback((ref: CartRef) => setItems((cur) => (cur.some((i) => same(i, ref)) ? cur : [...cur, ref])), []);
  const remove = useCallback((ref: CartRef) => setItems((cur) => cur.filter((i) => !same(i, ref))), []);
  const has = useCallback((ref: CartRef) => items.some((i) => same(i, ref)), [items]);
  const clear = useCallback(() => setItems([]), []);

  const value = useMemo(() => ({ items, ready, add, remove, has, clear }), [items, ready, add, remove, has, clear]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCart debe usarse dentro de CartProvider");
  return ctx;
}
