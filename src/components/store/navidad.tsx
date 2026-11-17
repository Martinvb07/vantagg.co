/* eslint-disable @next/next/no-img-element */

/**
 * Decoración de Navidad para la tienda. Va encima del diseño (sin tocar nada) y solo se dibuja en temporada (ver
 * src/domain/season.ts y Panel → Ajustes → Temporada):
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

/** Pueblito nevado (pinos, casitas con luz y el árbol de la plaza) justo encima del pie de página. */
export function ChristmasVillage() {
  return (
    <div aria-hidden className="pointer-events-none relative z-[1] mt-10 -mb-10 sm:mt-16 sm:-mb-16">
      <img src="/temporada/pueblo.svg" alt="" loading="lazy" decoding="async" draggable={false} className="block h-[86px] w-full object-cover object-bottom sm:h-[130px]" />
    </div>
  );
}
