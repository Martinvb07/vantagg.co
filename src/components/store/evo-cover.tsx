/* eslint-disable @next/next/no-img-element */
import { cn } from "@/lib/utils";

/**
 * Portada de «Armas Evo»: el cristal y la caja de fragmentos Evo (public/portadas/arte-evo-*.svg) sobre el fondo de la
 * marca, con rejilla de visor y brillo violeta. `title`: el nombre de la sección abajo, como en las portadas de paquetes.
 */
export function EvoCover({ className, title = true }: { className?: string; title?: boolean }) {
  return (
    <div className={cn("relative aspect-square overflow-hidden bg-[#060a07]", className)} style={{ containerType: "inline-size" }} aria-hidden>
      <div className="absolute inset-0 bg-[linear-gradient(rgba(200,240,79,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(200,240,79,0.05)_1px,transparent_1px)] bg-[size:12%_12%] [mask-image:radial-gradient(75%_75%_at_55%_40%,black,transparent)]" />
      <div className="absolute inset-0 bg-[radial-gradient(55%_55%_at_62%_42%,rgba(143,77,255,0.38),transparent_70%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(40%_40%_at_25%_30%,rgba(200,240,79,0.14),transparent_70%)]" />
      <img src="/portadas/arte-evo-box.svg" alt="" decoding="async" draggable={false} className="absolute bottom-[10%] right-[-6%] w-[74%] drop-shadow-[0_10px_30px_rgba(143,77,255,0.35)]" />
      <img src="/portadas/arte-evo-frag.svg" alt="" decoding="async" draggable={false} className="absolute left-[-8%] top-[-2%] w-[60%] -rotate-[8deg]" />
      {title && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent px-[7%] pb-[6%] pt-[18%]">
          <p className="font-display font-black italic leading-none tracking-tight text-white" style={{ fontSize: "13cqw" }}>
            ARMAS EVO
          </p>
          <p className="mt-[2.5%] flex items-center gap-[0.4em] font-bold uppercase tracking-[0.16em] text-[#c8f04f]" style={{ fontSize: "5.2cqw" }}>
            <span className="inline-block h-[0.18em] w-[1.2em] bg-[#c8f04f]" />
            Fragmentos y cajas
          </p>
        </div>
      )}
    </div>
  );
}

/** Banner de «Armas Evo» para el inicio: visor de la marca, brillo violeta, el cristal y la caja. */
export function EvoBanner({ href, from }: { href: string; from: string | null }) {
  return (
    <a href={href} className="group relative block overflow-hidden rounded-[22px] bg-ink-900 ring-1 ring-white/[0.07] transition hover:ring-volt-400/30">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(200,240,79,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(200,240,79,0.045)_1px,transparent_1px)] bg-[size:34px_34px] [mask-image:radial-gradient(80%_80%_at_75%_45%,black,transparent)]" />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(45%_70%_at_76%_45%,rgba(143,77,255,0.3),transparent_70%)]" />
      <div className="relative grid min-h-[200px] grid-cols-[minmax(0,1fr)_42%] items-center gap-2 px-5 py-6 sm:min-h-[220px] sm:px-8 sm:py-7">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-subtle">
            <span className="rounded-full bg-volt-400 px-2 py-0.5 font-sans text-[10px] font-bold tracking-wide text-volt-ink">Nuevo</span>
            Free Fire
          </p>
          <h2 className="mt-2.5 font-display font-black uppercase italic leading-[0.92] tracking-tight">
            <span className="text-[34px] text-volt-400 drop-shadow-[0_0_22px_rgb(200_240_79/0.3)] sm:text-[50px]">Armas Evo</span>
          </h2>
          <p className="mt-2 max-w-[340px] text-[13px] leading-relaxed text-fg-muted sm:text-[14px]">Fragmentos y cajas Evo directo a tu ID{from ? ` · desde ${from}` : ""}.</p>
          <span className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-full bg-volt-400 pl-4 pr-3 text-[13.5px] font-semibold text-volt-ink transition group-hover:bg-volt-300 sm:h-11 sm:pl-5 sm:text-[14px]">
            Ver Armas Evo
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="m9 18 6-6-6-6" />
            </svg>
          </span>
        </div>
        <div aria-hidden className="relative aspect-square w-full max-w-[260px] justify-self-end">
          <img src="/portadas/arte-evo-box.svg" alt="" decoding="async" draggable={false} className="absolute bottom-0 right-0 w-[82%] transition-transform duration-300 group-hover:-translate-y-1" />
          <img src="/portadas/arte-evo-frag.svg" alt="" decoding="async" draggable={false} className="absolute left-[-6%] top-[-4%] w-[62%] -rotate-[10deg] transition-transform duration-300 group-hover:-rotate-[4deg]" />
        </div>
      </div>
    </a>
  );
}
