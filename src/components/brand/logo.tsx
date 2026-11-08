import Image from "next/image";
import { cn } from "@/lib/utils";

/** Isotipo: la V verde con brillo (public/brand/vanta-v.png, fondo transparente). */
export function LogoMark({ className }: { className?: string }) {
  return <Image src="/brand/vanta-v.png" alt="" width={96} height={96} aria-hidden className={cn("size-8 object-contain", className)} />;
}

/** Logo completo: V + palabra VANTAGG. Si en Ajustes hay un logotipo propio (logoUrl), se usa ese. */
export function Logo({ name, logoUrl, className }: { name: string; logoUrl?: string; className?: string }) {
  if (logoUrl) {
    return (
      <span className={cn("inline-flex items-center", className)}>
        <Image src={logoUrl} alt={name} width={140} height={32} className="h-8 w-auto" priority unoptimized={/\.svg($|\?)/i.test(logoUrl)} />
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      {/* La V trae brillo alrededor: un poco más grande para que pese igual que la palabra. */}
      {/* Celulares de menos de 360 px (iPhone SE): un poco más chico para que quepan los botones del encabezado. */}
      <LogoMark className="size-9 drop-shadow-[0_0_10px_rgb(200_240_79/0.25)] min-[360px]:size-10 sm:size-11" />
      <Image src="/brand/vantagg.png" alt={name} width={358} height={57} priority className="h-[17px] w-auto min-[360px]:h-[20px] sm:h-[23px]" />
    </span>
  );
}
