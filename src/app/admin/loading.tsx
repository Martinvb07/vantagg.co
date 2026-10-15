import { Skeleton } from "@/components/ui/primitives";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Cargando">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="mt-3 h-4 w-80 max-w-full" />
      <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-[12px]" />
        ))}
      </div>
      <div className="mt-6 space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-[10px]" />
        ))}
      </div>
    </div>
  );
}
