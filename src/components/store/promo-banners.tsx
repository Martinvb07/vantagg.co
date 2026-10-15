"use client";

import Image, { getImageProps } from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type Banner = { id: string; title: string; imageUrl: string; imageMobileUrl?: string | null; href: string | null };

const isSvg = (u: string) => u.endsWith(".svg");

/** Hay versión para celular en todos los banners del grupo (si falta en uno, todos usan la ancha para igualar alturas). */
export const allMobile = (banners: Banner[]) => banners.length > 0 && banners.every((b) => !!b.imageMobileUrl);

/**
 * Imagen del banner. Con versión para celular usa <picture>: la ancha desde 640 px y la vertical en teléfonos,
 * así el texto del banner se lee en pantallas pequeñas.
 */
export function BannerPicture({ b, sizes, priority, mobile, className }: { b: Banner; sizes: string; priority?: boolean; mobile: boolean; className?: string }) {
  if (!mobile || !b.imageMobileUrl) {
    return <Image src={b.imageUrl} alt={b.title} fill priority={priority} sizes={sizes} unoptimized={isSvg(b.imageUrl)} className={className} />;
  }
  const desk = getImageProps({ src: b.imageUrl, alt: "", fill: true, sizes, unoptimized: isSvg(b.imageUrl) }).props;
  const { props: mob } = getImageProps({ src: b.imageMobileUrl, alt: b.title, fill: true, sizes: "100vw", priority, unoptimized: isSvg(b.imageMobileUrl) });
  return (
    <picture>
      <source media="(min-width: 640px)" srcSet={desk.srcSet ?? desk.src} sizes={desk.srcSet ? desk.sizes : undefined} />
      {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
      <img {...mob} className={className} />
    </picture>
  );
}

function BannerLink({ b, className, sizes, priority, mobile = false }: { b: Banner; className: string; sizes: string; priority?: boolean; mobile?: boolean }) {
  const img = <BannerPicture b={b} sizes={sizes} priority={priority} mobile={mobile} className="object-cover transition-transform duration-500 group-hover:scale-[1.03]" />;
  const cls = cn("group relative block shrink-0 overflow-hidden rounded-[18px] ring-1 ring-white/[0.08] transition-shadow hover:ring-white/20", className);
  if (!b.href) return <div className={cls}>{img}</div>;
  if (b.href.startsWith("http"))
    return (
      <a href={b.href} target="_blank" rel="noopener noreferrer" className={cls}>
        {img}
      </a>
    );
  return (
    <Link href={b.href} className={cls}>
      {img}
    </Link>
  );
}

function Arrows({ onPrev, onNext }: { onPrev: () => void; onNext: () => void }) {
  const btn =
    "absolute top-1/2 hidden size-10 -translate-y-1/2 place-items-center rounded-full bg-ink-800/90 text-fg shadow-lg ring-1 ring-white/15 backdrop-blur transition-opacity hover:bg-ink-700 sm:grid sm:opacity-0 sm:group-hover/row:opacity-100";
  return (
    <>
      <button type="button" onClick={onPrev} aria-label="Anterior" className={cn(btn, "-left-4")}>
        <ChevronLeft className="size-5" />
      </button>
      <button type="button" onClick={onNext} aria-label="Siguiente" className={cn(btn, "-right-4")}>
        <ChevronRight className="size-5" />
      </button>
    </>
  );
}

/**
 * Banners promocionales.
 *  - "carousel": fila deslizable, 2 visibles en escritorio, avance automático.
 *  - "rail": igual, con 3 visibles en escritorio grande.
 *  - "pair": 2 columnas (apilados en móvil), sin desplazamiento.
 *  - "stack": columna lateral, uno debajo de otro.
 *  - "wide": franja a todo lo ancho (1600×400), rota si hay varias.
 */
export function PromoBanners({ banners, variant = "carousel", label = "Promociones" }: { banners: Banner[]; variant?: "carousel" | "rail" | "pair" | "wide" | "stack"; label?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);

  const scroll = (dir: number) => {
    const el = ref.current;
    if (!el) return;
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 8;
    if (dir > 0 && atEnd) el.scrollTo({ left: 0, behavior: "smooth" });
    else el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: "smooth" });
  };

  // Avance automático (carrusel y ancho), pausado al interactuar o con movimiento reducido.
  useEffect(() => {
    if (variant === "pair" || variant === "stack" || paused || banners.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => scroll(1), 5500);
    return () => clearInterval(t);
  }, [variant, paused, banners.length]);

  if (!banners.length) return null;
  const wideMobile = variant === "wide" && allMobile(banners);

  const row = "-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto scroll-smooth px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:scroll-px-0 sm:gap-4 sm:px-0 [&::-webkit-scrollbar]:hidden";

  // Franjas anchas: de borde a borde en móvil para que el texto se lea.
  const wideRow = "-mx-4 flex snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] sm:mx-0 sm:gap-4 [&::-webkit-scrollbar]:hidden";

  if (variant === "pair" || variant === "stack") {
    return (
      <section aria-label={label} className={cn("grid gap-3 sm:gap-4", variant === "pair" && banners.length > 1 && "sm:grid-cols-2")}>
        {banners.map((b) => (
          <BannerLink key={b.id} b={b} sizes={variant === "pair" ? "(min-width:640px) 600px, 100vw" : "(min-width:1024px) 380px, 100vw"} className="aspect-[1200/630] w-full" />
        ))}
      </section>
    );
  }

  return (
    <section aria-label={label} className="group/row relative" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onTouchStart={() => setPaused(true)}>
      <div ref={ref} className={variant === "wide" ? wideRow : row}>
        {banners.map((b, i) =>
          variant === "wide" ? (
            <BannerLink key={b.id} b={b} priority={i === 0} mobile={wideMobile} sizes="(min-width:1280px) 1200px, 100vw" className={cn("w-full snap-start rounded-none ring-0 sm:rounded-[18px] sm:ring-1", wideMobile ? "aspect-[800/520] sm:aspect-[1600/400]" : "aspect-[1600/400]")} />
          ) : (
            <BannerLink key={b.id} b={b} priority={i < 2} sizes="(min-width:1024px) 600px, 88vw" className={cn("aspect-[1200/630] w-[88%] snap-start sm:w-[calc(50%-8px)]", variant === "rail" && "lg:w-[calc((100%-32px)/3)]")} />
          ),
        )}
      </div>
      {banners.length > (variant === "wide" ? 1 : variant === "rail" ? 3 : 2) && <Arrows onPrev={() => scroll(-1)} onNext={() => scroll(1)} />}
    </section>
  );
}
