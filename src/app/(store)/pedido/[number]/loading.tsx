import { Container, Skeleton } from "@/components/ui/primitives";

/**
 * Mientras carga el pedido. Con su propia zona de carga la página cambia al instante al llegar desde «Rastrear pedido»
 * (misma sección): sin ella, el cambio esperaba a que todo el pedido estuviera listo dentro de la zona ya mostrada.
 */
export default function Loading() {
  return (
    <Container className="max-w-5xl py-6 sm:py-8" aria-busy="true" aria-label="Cargando el pedido">
      <Skeleton className="h-28 w-full rounded-[18px]" />
      <Skeleton className="mt-4 h-52 w-full rounded-[18px]" />
      <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Skeleton className="h-64 w-full rounded-[18px]" />
        <Skeleton className="h-64 w-full rounded-[18px]" />
      </div>
    </Container>
  );
}
