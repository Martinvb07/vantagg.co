import type { Metadata } from "next";
import { Container } from "@/components/ui/primitives";
import { accountsVisible } from "@/server/catalog";
import { CartView } from "./cart-view";

export const metadata: Metadata = { title: "Carrito", robots: { index: false, follow: false } };

export default async function CartPage() {
  const showAccounts = await accountsVisible();
  return (
    <Container className="max-w-[900px] py-10 sm:py-12">
      <h1 className="font-display text-3xl font-semibold">Carrito</h1>
      <p className="mt-2 text-[15px] text-fg-muted">
        {showAccounts
          ? "Cada producto digital se paga por separado para garantizar su entrega: las recargas van a un ID específico y cada cuenta es una unidad única."
          : "Cada recarga se paga por separado para garantizar su entrega: va a un ID de jugador específico."}
      </p>
      <CartView showAccounts={showAccounts} />
    </Container>
  );
}
