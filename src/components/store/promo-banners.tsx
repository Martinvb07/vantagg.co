"use client";

import Image, { getImageProps } from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
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

function BannerLink({ b, className, sizes, priority, mobile = false, hidden = false }: { b: Banner; className: string; sizes: string; priority?: boolean; mobile?: boolean; hidden?: boolean }) {
  const img = <BannerPicture b={b} sizes={sizes} priority={priority} mobile={mobile} className="pointer-events-none select-none object-cover transition-transform duration-500 group-hover:scale-[1.03]" />;
  const cls = cn("group relative block shrink-0 overflow-hidden rounded-[18px] ring-1 ring-white/[0.08] transition-shadow hover:ring-white/20", className);
  // Banners fuera de vista en un carrusel: no se enfocan con el teclado ni los lee el lector de pantalla.
  const a11y = hidden ? { "aria-hidden": true, tabIndex: -1 } : {};
  if (!b.href) return <div className={cls} {...a11y}>{img}</div>;
  if (b.href.startsWith("http"))
    return (
      <a href={b.href} target="_blank" rel="noopener noreferrer" className={cls} draggable={false} {...a11y}>
        {img}
      </a>
    );
  return (
    <Link href={b.href} className={cls} draggable={false} {...a11y}>
      {img}
    </Link>
  );
}

/** Al tocar o arrastrar, el avance automático espera esto antes de seguir. */
const IDLE_AFTER_TOUCH_MS = 8000;
const AUTO_MS = 6000;

/**
 * Franjas anchas (varias): una a la vez. En el celular el banner sigue al dedo y encaja al soltar (sin pelear con el
 * desplazamiento vertical ni con el gesto de «atrás» del navegador); en escritorio, flechas y puntos. Avanza solo cada
 * 6 s, pero no mientras el mouse está encima, recién se tocó, la pestaña está oculta o el banner no está en pantalla.
 */
function WideSlider({ banners, label }: { banners: Banner[]; label: string }) {
  const n = banners.length;
  const mobile = allMobile(banners);
  const [i, setI] = useState(0);
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const g = useRef<{ x: number; y: number; t: number; axis: "x" | "y" | null; id: number } | null>(null);
  const moved = useRef(false);
  const idleUntil = useRef(0);
  const hovering = useRef(false);
  const onScreen = useRef(true);

  const go = useCallback((d: number) => setI((c) => (c + d + n) % n), [n]);
  const rest = () => (idleUntil.current = Date.now() + IDLE_AFTER_TOUCH_MS);

  useEffect(() => {
    const el = box.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => (onScreen.current = e.intersectionRatio >= 0.5), { threshold: [0, 0.5, 1] });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (n < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => {
      if (hovering.current || g.current || document.hidden || !onScreen.current || Date.now() < idleUntil.current) return;
      setI((c) => (c + 1) % n);
    }, AUTO_MS);
    return () => clearInterval(t);
  }, [n]);

  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse") return;
    g.current = { x: e.clientX, y: e.clientY, t: Date.now(), axis: null, id: e.pointerId };
    moved.current = false;
    rest();
  };
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    const s = g.current;
    if (!s || e.pointerId !== s.id) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (!s.axis && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      s.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (s.axis === "x") {
        setDragging(true);
        e.currentTarget.setPointerCapture?.(e.pointerId);
      }
    }
    if (s.axis !== "x") return;
    moved.current = true;
    // En los extremos el banner se resiste (no se pasa del primero ni del último al arrastrar).
    const edge = (i === 0 && dx > 0) || (i === n - 1 && dx < 0);
    setDrag(edge ? dx / 3 : dx);
  };
  const up = (e: ReactPointerEvent<HTMLDivElement>) => {
    const s = g.current;
    g.current = null;
    if (!s || e.pointerId !== s.id) return;
    if (s.axis === "x") {
      const dx = e.clientX - s.x;
      const w = box.current?.clientWidth ?? 1;
      const v = dx / Math.max(1, Date.now() - s.t); // px por ms
      if ((dx < -w * 0.18 || v < -0.45) && i < n - 1) setI(i + 1);
      else if ((dx > w * 0.18 || v > 0.45) && i > 0) setI(i - 1);
    }
    setDrag(0);
    setDragging(false);
    rest();
  };

  return (
    <section aria-label={label} aria-roledescription="carrusel" className="group/row">
      <div
        ref={box}
        className="relative -mx-4 touch-pan-y select-none overflow-hidden overscroll-x-contain sm:mx-0 sm:rounded-[18px] sm:ring-1 sm:ring-white/[0.08]"
        onMouseEnter={() => (hovering.current = true)}
        onMouseLeave={() => (hovering.current = false)}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onDragStart={(e) => e.preventDefault()}
        // Un arrastre no abre el enlace del banner.
        onClickCapture={(e) => {
          if (moved.current) {
            e.preventDefault();
            e.stopPropagation();
            moved.current = false;
          }
        }}
      >
        <div
          className="flex"
          style={{ transform: `translate3d(calc(${-i * 100}% + ${drag}px), 0, 0)`, transition: dragging ? "none" : "transform 550ms cubic-bezier(0.3, 0.7, 0.2, 1)" }}
        >
          {banners.map((b, idx) => (
            <BannerLink
              key={b.id}
              b={b}
              hidden={idx !== i}
              priority={idx === 0}
              mobile={mobile}
              sizes="(min-width:1280px) 1200px, 100vw"
              className={cn("w-full rounded-none ring-0 hover:ring-0", mobile ? "aspect-[800/520] sm:aspect-[1600/400]" : "aspect-[1600/400]")}
            />
          ))}
        </div>
        {[
          { d: -1, icon: ChevronLeft, side: "left-3", text: "Banner anterior" },
          { d: 1, icon: ChevronRight, side: "right-3", text: "Banner siguiente" },
        ].map(({ d, icon: Icon, side, text }) => (
          <button
            key={d}
            type="button"
            onClick={() => {
              go(d);
              rest();
            }}
            aria-label={text}
            className={cn("absolute top-1/2 hidden size-10 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white ring-1 ring-white/20 backdrop-blur transition hover:bg-black/70 focus-visible:opacity-100 sm:grid sm:opacity-0 sm:group-hover/row:opacity-100", side)}
          >
            <Icon className="size-5" />
          </button>
        ))}
      </div>
      <div className="mt-1.5 flex justify-center">
        {banners.map((b, idx) => (
          <button
            key={b.id}
            type="button"
            onClick={() => {
              setI(idx);
              rest();
            }}
            aria-label={`Ir al banner ${idx + 1}`}
            aria-current={idx === i}
            className="group flex items-center px-[5px] py-[9px]"
          >
            <span className={cn("block h-1.5 rounded-full transition-all duration-300", idx === i ? "w-6 bg-white" : "w-1.5 bg-white/25 group-hover:bg-white/50")} />
          </button>
        ))}
      </div>
    </section>
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
  if (variant === "wide" && banners.length > 1) return <WideSlider banners={banners} label={label} />;
  return <ScrollBanners banners={banners} variant={variant} label={label} />;
}

function ScrollBanners({ banners, variant, label }: { banners: Banner[]; variant: "carousel" | "rail" | "pair" | "wide" | "stack"; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const idleUntil = useRef(0);

  const scroll = (dir: number) => {
    const el = ref.current;
    if (!el) return;
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 8;
    if (dir > 0 && atEnd) el.scrollTo({ left: 0, behavior: "smooth" });
    else el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: "smooth" });
  };

  // Avance automático (carrusel), pausado con el mouse encima, unos segundos después de tocarlo o con movimiento reducido.
  useEffect(() => {
    if (variant === "pair" || variant === "stack" || paused || banners.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => {
      if (document.hidden || Date.now() < idleUntil.current) return;
      scroll(1);
    }, 5500);
    return () => clearInterval(t);
  }, [variant, paused, banners.length]);

  if (!banners.length) return null;
  const wideMobile = variant === "wide" && allMobile(banners);

  // Sin «scroll-smooth» en CSS (pelea con el encaje al deslizar con el dedo) y sin el gesto de «atrás» en los extremos.
  const row = "-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto overscroll-x-contain px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:scroll-px-0 sm:gap-4 sm:px-0 [&::-webkit-scrollbar]:hidden";

  // Franjas anchas: de borde a borde en móvil para que el texto se lea.
  const wideRow = "-mx-4 flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] sm:mx-0 sm:gap-4 [&::-webkit-scrollbar]:hidden";

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
    <section
      aria-label={label}
      className="group/row relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => (idleUntil.current = Date.now() + IDLE_AFTER_TOUCH_MS)}
      onWheel={() => (idleUntil.current = Date.now() + IDLE_AFTER_TOUCH_MS)}
    >
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
