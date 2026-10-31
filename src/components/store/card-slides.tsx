"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Img = { url: string; alt: string };

/**
 * Fotos deslizables dentro de la tarjeta de una cuenta: con el dedo (o el trackpad) se pasan sin entrar a
 * la ficha; en computador aparecen flechas al pasar el cursor. Tocar la foto abre la ficha.
 * `fill`: ocupa el alto que le da la tarjeta (vista de lista); si no, el alto lo pone la primera foto.
 */
export function CardSlides({ href, images, sizes, priority = false, fill = false }: { href: string; images: Img[]; sizes: string; priority?: boolean; fill?: boolean }) {
  const track = useRef<HTMLDivElement>(null);
  const [i, setI] = useState(0);
  const n = images.length;

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setI(Math.round(el.scrollLeft / Math.max(1, el.clientWidth))));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("scroll", onScroll);
    };
  }, []);

  const go = (d: number) => {
    const el = track.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ left: ((i + d + n) % n) * el.clientWidth, behavior: reduce ? "auto" : "smooth" });
  };

  const arrow = "absolute top-1/2 z-[1] grid size-8 -translate-y-1/2 place-items-center rounded-full bg-ink-950/70 text-white ring-1 ring-white/15 backdrop-blur transition hover:bg-ink-950/90 opacity-0 [@media(hover:hover)]:group-hover:opacity-100";

  return (
    <>
      {/* Decorativas para lectores de pantalla: el título de la tarjeta ya es el enlace a la ficha. */}
      <div
        ref={track}
        aria-hidden
        className={cn("flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", fill && "absolute inset-0")}
      >
        {images.map((img, idx) => (
          <Link
            key={img.url}
            href={href}
            tabIndex={-1}
            draggable={false}
            className={cn("relative w-full shrink-0 snap-center snap-always overflow-hidden", fill && "h-full")}
          >
            {idx === 0 && !fill ? (
              // La primera foto define el alto de la tarjeta (proporción real del edit); las demás lo llenan.
              <Image
                src={img.url}
                alt=""
                width={0}
                height={0}
                sizes={sizes}
                quality={90}
                priority={priority}
                unoptimized={img.url.endsWith(".svg")}
                draggable={false}
                style={{ width: "100%", height: "auto" }}
                className="block transition-transform duration-500 group-hover:scale-[1.02]"
              />
            ) : (
              <Image
                src={img.url}
                alt=""
                fill
                sizes={sizes}
                quality={85}
                priority={priority && idx === 0}
                loading={idx === 0 ? undefined : "lazy"}
                unoptimized={img.url.endsWith(".svg")}
                draggable={false}
                className="object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]"
              />
            )}
          </Link>
        ))}
      </div>

      <button type="button" tabIndex={-1} aria-hidden onClick={() => go(-1)} className={cn(arrow, "left-2")}>
        <ChevronLeft className="size-4" />
      </button>
      <button type="button" tabIndex={-1} aria-hidden onClick={() => go(1)} className={cn(arrow, "right-2")}>
        <ChevronRight className="size-4" />
      </button>

      {/* Puntos: cuál foto se está viendo */}
      <div className="pointer-events-none absolute inset-x-0 bottom-2.5 z-[1] flex justify-center gap-1">
        {images.map((im, idx) => (
          <span key={im.url} className={cn("h-1.5 rounded-full shadow transition-all", idx === i ? "w-4 bg-volt-400" : "w-1.5 bg-white/60")} />
        ))}
      </div>
    </>
  );
}
