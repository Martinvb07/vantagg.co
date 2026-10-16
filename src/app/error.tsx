"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/button";

/** Errores de carga en el navegador (p. ej. archivos de una versión anterior justo después de actualizar la tienda). */
const isLoadError = (e: Error) => /ChunkLoadError|Loading (CSS )?chunk|dynamically imported module|Failed to fetch|NetworkError|Load failed/i.test(`${e.name} ${e.message}`);
const RELOAD_KEY = "vx_error_reload";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  useEffect(() => {
    console.error(error);
    // Un error de carga se arregla recargando con la versión actual; solo una vez por minuto para no entrar en bucle.
    if (!error.digest && isLoadError(error)) {
      try {
        const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
        if (Date.now() - last > 60_000) {
          sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
          window.location.reload();
        }
      } catch {
        /* sin sessionStorage: se queda el botón de reintentar */
      }
    }
  }, [error]);

  // Reintentar vuelve a pedir la página al servidor (reset() solo, repetiría el mismo fallo).
  const retry = () => {
    if (!error.digest) return window.location.reload();
    start(() => {
      router.refresh();
      reset();
    });
  };

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
          <Button onClick={retry} loading={pending}>
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
