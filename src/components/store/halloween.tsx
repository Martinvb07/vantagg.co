/* eslint-disable @next/next/no-img-element */
/**
 * Decoración de Halloween para la tienda: telarañas en las esquinas, una araña colgando y murciélagos.
 * Va encima del diseño (sin tocar nada) y solo se dibuja en temporada (ver src/domain/season.ts).
 * Las piezas son archivos de public/temporada, generados con scripts/generar-banners.mjs.
 */
export function HalloweenDecor() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-[5] h-[320px] overflow-hidden">
      {/* Telarañas en las dos esquinas */}
      <img src="/temporada/telarana.svg" alt="" className="absolute left-0 top-0 w-12 opacity-50 sm:w-36 sm:opacity-70" />
      <img src="/temporada/telarana.svg" alt="" className="absolute right-0 top-0 w-14 -scale-x-100 opacity-50 sm:w-44 sm:opacity-70" />
      {/* Araña colgando de su hilo */}
      <div className="halloween-spider absolute right-[30%] top-0 hidden w-8 sm:block">
        <img src="/temporada/arana.svg" alt="" className="w-full" />
      </div>
      {/* Murciélagos */}
      <div className="halloween-bat absolute right-[8%] top-16 w-8 opacity-70 sm:w-14 sm:opacity-80">
        <img src="/temporada/murcielago.svg" alt="" className="w-full" />
      </div>
      <div className="halloween-bat absolute left-[22%] top-28 hidden w-9 opacity-60 [animation-delay:-6s] sm:block">
        <img src="/temporada/murcielago.svg" alt="" className="w-full" />
      </div>
    </div>
  );
}
