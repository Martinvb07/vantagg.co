import Link from "next/link";
import { Gem } from "@/components/brand/gem";
import { LinkButton } from "@/components/ui/button";

export const metadata = { title: "Página no encontrada", robots: { index: false, follow: true } };

export default function NotFound() {
  return (
    <main id="contenido" className="grid min-h-dvh place-items-center px-4">
      <div className="max-w-md text-center">
        <Gem className="mx-auto w-20 opacity-80" />
        <p className="eyebrow mt-8">Error 404</p>
        <h1 className="mt-2 font-display text-3xl font-semibold">No encontramos esta página</h1>
        <p className="mt-3 text-[15px] text-fg-muted">Puede que el enlace haya cambiado o que el producto ya no esté publicado.</p>
        <div className="mt-8 flex justify-center gap-2">
          <LinkButton href="/">Ir al inicio</LinkButton>
          <LinkButton href="/pedido" variant="outline">
            Seguir un pedido
          </LinkButton>
        </div>
        <Link href="/ayuda" className="mt-6 inline-block text-[13px] text-fg-subtle hover:text-fg">
          Centro de ayuda →
        </Link>
      </div>
    </main>
  );
}
