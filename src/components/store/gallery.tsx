"use client";

import Image from "next/image";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AccountPlaceholder } from "@/components/brand/illustrations";
import { cn } from "@/lib/utils";

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
  return (
    <div>
      <div
        className="surface group relative aspect-video overflow-hidden"
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") go(-1);
          if (e.key === "ArrowRight") go(1);
        }}
        tabIndex={0}
        role="region"
        aria-roledescription="carrusel"
        aria-label={`Imágenes de ${title}`}
      >
        <Image src={images[i].url} alt="" aria-hidden fill sizes="64px" quality={40} unoptimized={images[i].url.endsWith(".svg")} className="scale-110 object-cover opacity-50 blur-2xl" />
        <Image
          key={images[i].url}
          src={images[i].url}
          alt={images[i].alt}
          fill
          priority
          quality={92}
          sizes="(min-width:1024px) 760px, 100vw"
          unoptimized={images[i].url.endsWith(".svg")}
          className="animate-fade-up object-contain"
        />
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Imagen anterior"
              className="absolute left-3 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full border border-white/10 bg-ink-900/70 text-fg opacity-0 backdrop-blur transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Imagen siguiente"
              className="absolute right-3 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full border border-white/10 bg-ink-900/70 text-fg opacity-0 backdrop-blur transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
            >
              <ChevronRight className="size-4" />
            </button>
            <span className="absolute bottom-3 right-3 rounded-md bg-ink-900/75 px-2 py-0.5 font-mono text-[11px] text-fg-muted backdrop-blur">
              {i + 1}/{images.length}
            </span>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-6">
          {images.map((img, idx) => (
            <button
              key={img.url}
              type="button"
              onClick={() => setI(idx)}
              aria-label={`Ver imagen ${idx + 1}`}
              aria-current={idx === i}
              className={cn(
                "relative aspect-video overflow-hidden rounded-md border transition-[border-color,opacity]",
                idx === i ? "border-volt-400/80" : "border-white/[0.08] opacity-60 hover:opacity-100",
              )}
            >
              <Image src={img.url} alt="" fill sizes="120px" unoptimized={img.url.endsWith(".svg")} className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
