"use client";

import { Check, ShoppingBag } from "lucide-react";
import { useCart, type CartRef } from "@/components/cart/cart-context";
import { buttonClass } from "@/components/ui/button";

export function AddToCartButton({ item, className }: { item: CartRef; className?: string }) {
  const { has, add, remove, ready } = useCart();
  const inCart = ready && has(item);
  return (
    <button
      type="button"
      className={buttonClass("outline", "lg", className)}
      onClick={() => (inCart ? remove(item) : add(item))}
      aria-pressed={inCart}
    >
      {inCart ? <Check className="size-4 text-volt-300" /> : <ShoppingBag className="size-4" />}
      {inCart ? "Guardado en el carrito" : "Guardar en el carrito"}
    </button>
  );
}
