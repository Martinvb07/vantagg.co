/* eslint-disable @next/next/no-img-element */
import { cn } from "@/lib/utils";

/**
 * Portada de «Armas Evo»: el token y la caja de fragmentos Evo (public/portadas/arte-evo-*.svg) sobre el fondo de la
 * marca, con rejilla de visor y brillo turquesa. `title`: el nombre de la sección abajo, como en las portadas de paquetes.
 */
export function EvoCover({ className, title = true }: { className?: string; title?: boolean }) {
  return (
    <div className={cn("relative aspect-square overflow-hidden bg-[#060a07]", className)} style={{ containerType: "inline-size" }} aria-hidden>
      <div className="absolute inset-0 bg-[linear-gradient(rgba(200,240,79,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(200,240,79,0.05)_1px,transparent_1px)] bg-[size:12%_12%] [mask-image:radial-gradient(75%_75%_at_55%_40%,black,transparent)]" />
      <div className="absolute inset-0 bg-[radial-gradient(55%_55%_at_62%_42%,rgba(47,208,224,0.32),transparent_70%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(40%_40%_at_25%_30%,rgba(200,240,79,0.14),transparent_70%)]" />
      <img src="/portadas/arte-evo-box.svg" alt="" decoding="async" draggable={false} className="absolute bottom-[10%] right-[-6%] w-[74%] drop-shadow-[0_10px_30px_rgba(47,208,224,0.3)]" />
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
