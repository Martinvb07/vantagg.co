"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AccountPlaceholder } from "@/components/brand/illustrations";
import { cn } from "@/lib/utils";

type Img = { url: string; alt: string };

const smooth = () => (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");

/**
 * Galería de la ficha en carrusel: se desliza con el dedo, con el mouse (arrastrando), con las flechas
 * del teclado o con los botones; las miniaturas y los puntos siguen a la foto visible. Cada foto se ve
 * completa (sin recortes) sobre un fondo difuminado de la misma imagen, así el alto no salta entre fotos.
 * No abre la imagen en tamaño completo.
 */
export function Gallery({ images, title }: { images: Img[]; title: string }) {
  const track = useRef<HTMLDivElement>(null);
  const thumbs = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; left: number } | null>(null);
  const [i, setI] = useState(0);
  // Proporción del carrusel: la de la primera foto (entre 4:5 vertical y 16:9 horizontal); las demás se
  // ajustan dentro sin recortarse, así el alto no salta al pasar de foto.
  const [ratio, setRatio] = useState(1);
  const n = images.length;

  const goTo = useCallback(
    (idx: number, behavior: ScrollBehavior = smooth()) => {
      const el = track.current;
      if (!el || n === 0) return;
      const next = (idx + n) % n;
      el.scrollTo({ left: next * el.clientWidth, behavior });
      setI(next);
    },
    [n],
  );

  // La foto activa sale del desplazamiento (sirve igual para dedo, trackpad, mouse o botones).
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setI(Math.round(el.scrollLeft / Math.max(1, el.clientWidth))));
    };
    // Al cambiar el ancho (girar el teléfono) se mantiene la misma foto.
    const ro = new ResizeObserver(() => el.scrollTo({ left: Math.round(el.scrollLeft / Math.max(1, el.clientWidth)) * el.clientWidth }));
    el.addEventListener("scroll", onScroll, { passive: true });
    ro.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, []);

  // La miniatura activa siempre queda a la vista.
  useEffect(() => {
    const strip = thumbs.current;
    const active = strip?.children[i] as HTMLElement | undefined;
    if (!strip || !active) return;
    const left = active.offsetLeft - strip.clientWidth / 2 + active.clientWidth / 2;
    strip.scrollTo({ left, behavior: smooth() });
  }, [i]);

  // Arrastre con mouse (en táctil el desplazamiento nativo ya desliza).
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (n < 2 || e.pointerType !== "mouse" || e.button !== 0 || !track.current) return;
    drag.current = { x: e.clientX, left: track.current.scrollLeft };
    track.current.setPointerCapture(e.pointerId);
    track.current.style.scrollSnapType = "none";
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || !track.current) return;
    track.current.scrollLeft = d.left - (e.clientX - d.x);
  };
  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = track.current;
    if (!d || !el) return;
    drag.current = null;
    el.releasePointerCapture(e.pointerId);
    const dx = e.clientX - d.x;
    const from = Math.round(d.left / el.clientWidth);
    // Basta un arrastre corto para pasar de foto.
    const to = Math.abs(dx) > el.clientWidth * 0.12 ? from + (dx < 0 ? 1 : -1) : from;
    el.style.scrollSnapType = "";
    goTo(Math.max(0, Math.min(n - 1, to)));
  };

  if (n === 0) {
    return (
      <div className="surface aspect-[16/10] overflow-hidden">
        <AccountPlaceholder title={title} />
      </div>
    );
  }

  return (
    <div className="select-none [-webkit-touch-callout:none]">
      <div
        className="surface group relative overflow-hidden"
        role="region"
        aria-roledescription="carrusel"
        aria-label={`Imágenes de ${title}`}
        tabIndex={0}
        onKeyDown={(e) => {
          const to = { ArrowLeft: i - 1, ArrowRight: i + 1, Home: 0, End: n - 1 }[e.key];
          if (to === undefined) return;
          e.preventDefault();
          goTo(to);
        }}
        // Sin menú de «abrir imagen» ni vista ampliada del navegador.
        onContextMenu={(e) => e.preventDefault()}
      >
        <div
          ref={track}
          className={cn("flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", n > 1 && "cursor-grab active:cursor-grabbing")}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          {images.map((img, idx) => (
            <div
              key={img.url}
              role="group"
              aria-roledescription="diapositiva"
              aria-label={`${idx + 1} de ${n}`}
              aria-hidden={idx !== i}
              className="relative w-full shrink-0 snap-center snap-always overflow-hidden bg-ink-950"
              style={{ aspectRatio: ratio }}
            >
              {/* Fondo: la misma foto difuminada, para que las fotos verticales o anchas no dejen franjas vacías */}
              <Image src={img.url} alt="" fill sizes="80px" quality={30} unoptimized={img.url.endsWith(".svg")} className="scale-110 object-cover opacity-50 blur-2xl" draggable={false} aria-hidden />
              <Image
                src={img.url}
                alt={img.alt}
                fill
                priority={idx === 0}
                loading={idx === 0 ? "eager" : "lazy"}
                quality={90}
                sizes="(min-width:1280px) 760px, (min-width:1024px) 58vw, 100vw"
                unoptimized={img.url.endsWith(".svg")}
                draggable={false}
                onLoad={idx === 0 ? (e) => {
                  const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
                  if (w && h) setRatio(Math.min(16 / 9, Math.max(4 / 5, w / h)));
                } : undefined}
                className="pointer-events-none object-contain"
              />
            </div>
          ))}
        </div>

        {n > 1 && (
          <>
            <button
              type="button"
              onClick={() => goTo(i - 1)}
              aria-label="Imagen anterior"
              className="absolute left-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full border border-white/10 bg-ink-950/70 text-white backdrop-blur transition hover:border-volt-400/50 hover:bg-ink-950/90 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => goTo(i + 1)}
              aria-label="Imagen siguiente"
              className="absolute right-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full border border-white/10 bg-ink-950/70 text-white backdrop-blur transition hover:border-volt-400/50 hover:bg-ink-950/90 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
            >
              <ChevronRight className="size-5" />
            </button>
            <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-ink-950/75 px-2.5 py-1 text-[11.5px] font-semibold tabular-nums text-white ring-1 ring-white/10 backdrop-blur">
              {i + 1} / {n}
            </span>
            {/* Puntos */}
            <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
              {images.map((im, idx) => (
                <button
                  key={im.url}
                  type="button"
                  onClick={() => goTo(idx)}
                  aria-label={`Ir a la imagen ${idx + 1}`}
                  className={cn("h-1.5 rounded-full transition-all", idx === i ? "w-5 bg-volt-400" : "w-1.5 bg-white/45 hover:bg-white/70")}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {n > 1 && (
        <div ref={thumbs} className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {images.map((im, idx) => (
            <button
              key={im.url}
              type="button"
              onClick={() => goTo(idx)}
              aria-label={`Ver imagen ${idx + 1}`}
              aria-current={idx === i}
              className={cn(
                "relative aspect-square w-[18%] max-w-[88px] shrink-0 overflow-hidden rounded-lg transition sm:w-[15%]",
                idx === i ? "ring-2 ring-volt-400" : "opacity-55 ring-1 ring-white/[0.08] hover:opacity-100",
              )}
            >
              <Image src={im.url} alt="" fill sizes="88px" unoptimized={im.url.endsWith(".svg")} draggable={false} className="object-cover object-top" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
