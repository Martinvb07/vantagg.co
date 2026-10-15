"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { allMobile, BannerPicture, type Banner } from "./promo-banners";

/** Carrusel principal: un banner a la vez (1600×480; en celular 800×600 si todos tienen esa versión), se desliza solo. */
export function HeroCarousel({ banners }: { banners: Banner[] }) {
  const n = banners.length;
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const touch = useRef<number | null>(null);
  const go = useCallback((d: number) => setI((c) => (c + d + n) % n), [n]);

  useEffect(() => {
    if (paused || n < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setTimeout(() => go(1), 5000);
    return () => clearTimeout(t);
  }, [i, paused, n, go]);

  if (!n) return null;
  const mobile = allMobile(banners);

  return (
    <section aria-roledescription="carrusel" aria-label="Promociones">
      <div
        className="group relative overflow-hidden rounded-[18px] shadow-[0_24px_60px_-30px_rgba(0,0,0,0.9)] ring-1 ring-white/10"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={(e) => {
          setPaused(true);
          touch.current = e.touches[0].clientX;
        }}
        onTouchEnd={(e) => {
          if (touch.current == null) return;
          const dx = e.changedTouches[0].clientX - touch.current;
          if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
          touch.current = null;
        }}
      >
        <div className="flex transition-transform duration-700 ease-[cubic-bezier(0.3,0.7,0.2,1)]" style={{ transform: `translateX(-${i * 100}%)` }}>
          {banners.map((b, idx) => {
            const img = <BannerPicture b={b} sizes="(min-width:1280px) 1200px, 100vw" priority={idx === 0} mobile={mobile} className="object-cover" />;
            const cls = cn("relative block w-full shrink-0", mobile ? "aspect-[4/3] sm:aspect-[1600/480]" : "aspect-[1600/480]");
            const common = { "aria-hidden": idx !== i, tabIndex: idx === i ? 0 : -1 };
            if (!b.href) return <div key={b.id} className={cls} aria-hidden={idx !== i}>{img}</div>;
            return b.href.startsWith("http") ? (
              <a key={b.id} href={b.href} target="_blank" rel="noopener noreferrer" className={cls} {...common}>
                {img}
              </a>
            ) : (
              <Link key={b.id} href={b.href} className={cls} {...common}>
                {img}
              </Link>
            );
          })}
        </div>

        {n > 1 &&
          [
            { d: -1, icon: ChevronLeft, side: "left-3", label: "Banner anterior" },
            { d: 1, icon: ChevronRight, side: "right-3", label: "Banner siguiente" },
          ].map(({ d, icon: Icon, side, label }) => (
            <button
              key={d}
              type="button"
              onClick={() => go(d)}
              aria-label={label}
              className={cn("absolute top-1/2 hidden size-10 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white ring-1 ring-white/20 backdrop-blur transition hover:bg-black/70 sm:grid sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100", side)}
            >
              <Icon className="size-5" />
            </button>
          ))}
      </div>

      {n > 1 && (
        <div className="mt-3 flex justify-center gap-1.5">
          {banners.map((b, idx) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setI(idx)}
              aria-label={`Ir al banner ${idx + 1}`}
              aria-current={idx === i}
              className={cn("h-1.5 rounded-full transition-all duration-300", idx === i ? "w-6 bg-white" : "w-1.5 bg-white/25 hover:bg-white/50")}
            />
          ))}
        </div>
      )}
    </section>
  );
}
