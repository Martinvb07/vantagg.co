"use client";

import { useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="grid min-h-[70vh] place-items-center px-4">
      <div className="max-w-md text-center">
        <p className="eyebrow">Algo salió mal</p>
        <h1 className="mt-2 font-display text-2xl font-semibold">No pudimos cargar esta sección</h1>
        <p className="mt-3 text-[15px] text-fg-muted">
          Tus pedidos y pagos no se ven afectados. Intenta de nuevo; si el problema continúa, contáctanos
          {error.digest ? (
            <>
              {" "}
              con el código <span className="font-mono text-fg">{error.digest}</span>
            </>
          ) : null}
          .
        </p>
        <div className="mt-8 flex justify-center gap-2">
          <Button onClick={reset}>
            <RefreshCw className="size-4" /> Reintentar
          </Button>
          <LinkButton href="/" variant="outline">
            Ir al inicio
          </LinkButton>
        </div>
      </div>
    </main>
  );
}
