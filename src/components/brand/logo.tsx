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
        <Image src={logoUrl} alt={name} width={140} height={32} className="h-8 w-auto" priority />
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark className="size-9" />
      <Image src="/brand/vantagg.png" alt={name} width={358} height={57} priority className="h-[19px] w-auto sm:h-[21px]" />
    </span>
  );
}
