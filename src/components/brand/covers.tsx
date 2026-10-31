import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/money";
import { PASS_INFO, type PassKind } from "@/domain/packs";
import { coverFile, type CoverArtKey } from "./cover-art";

/**
 * Portadas de los paquetes: el arte es un archivo (public/portadas, ver cover-art.tsx) y la cantidad, el
 * bonus o el nombre van en HTML encima para que se lean nítidos. Así el arte se descarga una vez y queda
 * en caché, en vez de repetirse dentro de cada página.
 */

/** Nivel visual según la cantidad de diamantes (misma portada en toda la tienda). */
export function tierFor(diamonds: number): number {
  return [200, 450, 800, 1800, 4000].filter((t) => diamonds >= t).length + 1;
}

/**
 * `plain`: solo la ilustración. Para tarjetas y pases: `art` con su tipo, `headline` (ej. «7 DÍAS») y
 * `caption` (ej. «Tarjeta semanal») en lugar de la cantidad de diamantes.
 */
export function DiamondCover({
  tier,
  diamonds,
  bonus = 0,
  plain = false,
  className,
  art,
  headline,
  caption,
}: {
  tier: number;
  diamonds: number;
  bonus?: number;
  plain?: boolean;
  className?: string;
  art?: CoverArtKey;
  headline?: string;
  caption?: string;
}) {
  return (
    <div className={cn("relative aspect-square overflow-hidden bg-[#060a07]", className)} style={{ containerType: "inline-size" }} aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={coverFile(art ?? Math.max(1, Math.min(tier, 6)))} alt="" decoding="async" draggable={false} className="absolute inset-0 size-full" />

      {/* Bonus: etiqueta verde de la marca, arriba a la izquierda */}
      {!plain && bonus > 0 && (
        <span
          className="absolute left-[6%] top-[6%] bg-[#c8f04f] px-[0.55em] py-[0.2em] font-display font-black italic leading-none text-[#0b0f14]"
          style={{ fontSize: "6.6cqw", clipPath: "polygon(0 0, 100% 0, 92% 100%, 0 100%)" }}
        >
          +{formatNumber(bonus)} BONUS
        </span>
      )}

      {/* Cantidad (o nombre de la tarjeta) abajo, sobre un degradado para que siempre se lea */}
      {!plain && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/45 to-transparent px-[7%] pb-[6%] pt-[16%]">
          <p className="font-display font-black italic leading-none tracking-tight text-white" style={{ fontSize: headline ? "15cqw" : "18cqw" }}>
            {headline ?? formatNumber(diamonds)}
          </p>
          <p className="mt-[2.5%] flex items-center gap-[0.4em] font-bold uppercase tracking-[0.16em] text-[#c8f04f]" style={{ fontSize: "5.6cqw" }}>
            <span className="inline-block h-[0.18em] w-[1.2em] bg-[#c8f04f]" />
            {caption ?? "Diamantes"}
          </p>
        </div>
      )}
    </div>
  );
}

/** Portada de un paquete de la tienda: diamantes según su nivel, o la tarjeta/pase con su nombre. */
export function PackCover({ p, plain, className }: { p: { diamonds: number; bonusDiamonds: number; pass?: PassKind | null }; plain?: boolean; className?: string }) {
  if (p.pass) {
    const info = PASS_INFO[p.pass];
    return <DiamondCover tier={1} diamonds={0} art={p.pass} headline={info.headline} caption={info.caption} plain={plain} className={className} />;
  }
  return <DiamondCover tier={tierFor(p.diamonds)} diamonds={p.diamonds} bonus={p.bonusDiamonds} plain={plain} className={className} />;
}

/** Solo el objeto del paquete, sin fondo (para banners armados en HTML sobre fondo de la marca). */
export function CoverArt({ tier, className }: { tier: number; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={coverFile(Math.max(1, Math.min(tier, 6)), true)} alt="" aria-hidden decoding="async" draggable={false} className={className} />;
}
