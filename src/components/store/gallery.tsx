"use client";

import Image from "next/image";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Expand } from "lucide-react";
import { AccountPlaceholder } from "@/components/brand/illustrations";
import { cn } from "@/lib/utils";

/**
 * Galería de la ficha. Cada foto se muestra completa con su proporción real (los edits suelen ser
 * verticales o cuadrados): ancho total de la columna, alto según la imagen, sin franjas ni recortes.
 */
export function Gallery({ images, title }: { images: Array<{ url: string; alt: string }>; title: string }) {
  const [i, setI] = useState(0);
  if (images.length === 0) {
    return (
      <div className="surface aspect-[16/10] overflow-hidden">
        <AccountPlaceholder title={title} />
      </div>
    );
  }
  const go = (d: number) => setI((cur) => (cur + d + images.length) % images.length);
  const img = images[i];
  return (
    <div>
      <div
        className="surface group relative overflow-hidden"
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") go(-1);
          if (e.key === "ArrowRight") go(1);
        }}
        tabIndex={0}
        role="region"
        aria-roledescription="carrusel"
        aria-label={`Imágenes de ${title}`}
      >
        <Image
          key={img.url}
          src={img.url}
          alt={img.alt}
          width={0}
          height={0}
          priority
          quality={95}
          sizes="(min-width:1280px) 760px, (min-width:1024px) 60vw, 100vw"
          unoptimized={img.url.endsWith(".svg")}
          style={{ width: "100%", height: "auto" }}
          className="block animate-fade-up"
        />
        <a
          href={img.url}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute right-3 top-3 inline-flex h-9 items-center gap-1.5 rounded-full bg-ink-950/75 px-3 text-[12.5px] font-medium text-white ring-1 ring-white/15 backdrop-blur transition hover:bg-ink-950/90"
        >
          <Expand className="size-3.5" /> Ver en tamaño completo
        </a>
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Imagen anterior"
              className="absolute left-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full border border-white/10 bg-ink-900/75 text-fg backdrop-blur transition hover:bg-ink-900/95 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Imagen siguiente"
              className="absolute right-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full border border-white/10 bg-ink-900/75 text-fg backdrop-blur transition hover:bg-ink-900/95 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
            >
              <ChevronRight className="size-5" />
            </button>
            <span className="absolute bottom-3 right-3 rounded-md bg-ink-900/80 px-2 py-0.5 font-mono text-[11px] text-fg backdrop-blur">
              {i + 1}/{images.length}
            </span>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-6">
          {images.map((im, idx) => (
            <button
              key={im.url}
              type="button"
              onClick={() => setI(idx)}
              aria-label={`Ver imagen ${idx + 1}`}
              aria-current={idx === i}
              className={cn(
                "relative aspect-square overflow-hidden rounded-md border transition-[border-color,opacity]",
                idx === i ? "border-volt-400/80" : "border-white/[0.08] opacity-60 hover:opacity-100",
              )}
            >
              <Image src={im.url} alt="" fill sizes="120px" unoptimized={im.url.endsWith(".svg")} className="object-cover object-top" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
