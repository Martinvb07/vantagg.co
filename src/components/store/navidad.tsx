/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { Gift, Snowflake, TreePine } from "lucide-react";

/**
 * Decoración de Navidad para la tienda. Va encima del diseño (sin tocar nada) y solo se dibuja en temporada (ver
 * src/domain/season.ts y Panel → Ajustes → Temporada):
 *  - barra roja con la cuenta regresiva (ChristmasBar), arriba del encabezado;
 *  - guirnalda de pino con nieve debajo del encabezado y sus luces en 3 capas que titilan por turnos;
 *  - nieve que cae despacio y se mece (dos capas que solo se desplazan) y brillo de fondo;
 *  - pueblito nevado antes del pie de página (ChristmasVillage).
 * Liviano a propósito: la guirnalda, la nieve de las tarjetas, el gorro, el regalo y el acebo son imágenes de fondo
 * definidas en globals.css solo para [data-season="navidad"] (fuera de temporada no se descargan), y todas las
 * animaciones son de transform u opacity, que mueve la tarjeta gráfica sin trabajo para el procesador.
 * Con «reducir movimiento» no hay animaciones ni nieve.
 */

export function ChristmasDecor() {
  return (
    <>
      {/* Brillo navideño de fondo (rojo, verde y dorado), detrás de todo el contenido */}
      <div aria-hidden className="xmas-glow pointer-events-none fixed inset-0 -z-10" />
      {/* Guirnalda: el pino es el fondo y cada capa de luces titila por turnos */}
      <div aria-hidden className="xmas-garland pointer-events-none relative z-[5] -mb-2 h-[42px] sm:h-[50px]">
        <span className="xmas-lights xmas-lights-1" />
        <span className="xmas-lights xmas-lights-2" />
        <span className="xmas-lights xmas-lights-3" />
      </div>
      {/* Nieve: dos capas que bajan despacio y se mecen de lado a lado; solo se mueven, no se redibujan */}
      <div aria-hidden className="xmas-snow pointer-events-none fixed inset-0 z-[5] overflow-hidden">
        <div className="xmas-sway xmas-sway-a">
          <div className="xmas-snow-a" />
        </div>
        <div className="xmas-sway xmas-sway-b">
          <div className="xmas-snow-b" />
        </div>
      </div>
    </>
  );
}

/** Barra roja de temporada con la cuenta regresiva (o el saludo del día), arriba del encabezado. */
export function ChristmasBar({ message }: { message: string }) {
  return (
    <Link href="/recargas" className="group relative block overflow-hidden bg-[linear-gradient(90deg,#6d0c1a,#b3182d_50%,#6d0c1a)] text-center">
      <span aria-hidden className="block h-[4px] bg-[repeating-linear-gradient(135deg,#fff_0_7px,#e0293f_7px_14px)]" />
      <span className="flex items-center justify-center gap-2 whitespace-nowrap px-4 py-[7px] text-[12.5px] font-semibold text-[#ffe08a] sm:text-[13.5px]">
        <Snowflake aria-hidden className="size-3.5 shrink-0 text-white/80" />
        <TreePine aria-hidden className="size-4 shrink-0 text-[#7ee29c]" />
        {/* En el celular solo el mensaje (una línea); en pantallas grandes también el nombre y «Regala diamantes». */}
        <span className="hidden font-display font-black italic tracking-wide text-white sm:inline">NAVIDAD VANTAGG</span>
        <span aria-hidden className="hidden text-white/50 sm:inline">·</span>
        <span className="truncate">{message}</span>
        <span className="hidden items-center gap-1 text-white group-hover:underline sm:inline-flex">
          <span aria-hidden className="text-white/50">·</span> <Gift aria-hidden className="size-3.5" /> Regala diamantes →
        </span>
        <Snowflake aria-hidden className="size-3.5 shrink-0 text-white/80" />
      </span>
      <span aria-hidden className="block h-[4px] bg-[repeating-linear-gradient(135deg,#fff_0_7px,#e0293f_7px_14px)]" />
    </Link>
  );
}

/** Pueblito nevado (pinos, casitas con luz y el árbol de la plaza) justo encima del pie de página. */
export function ChristmasVillage() {
  return (
    <div aria-hidden className="pointer-events-none relative z-[1] mt-10 -mb-10 sm:mt-16 sm:-mb-16">
      <img src="/temporada/pueblo.svg" alt="" loading="lazy" decoding="async" draggable={false} className="block h-[86px] w-full object-cover object-bottom sm:h-[130px]" />
    </div>
  );
}
