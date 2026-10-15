import { Container, Skeleton } from "@/components/ui/primitives";

export default function Loading() {
  return (
    <Container className="py-12" aria-busy="true" aria-label="Cargando">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-4 h-10 w-80 max-w-full" />
      <Skeleton className="mt-3 h-4 w-[28rem] max-w-full" />
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-72 w-full rounded-[12px]" />
        ))}
      </div>
    </Container>
  );
}
