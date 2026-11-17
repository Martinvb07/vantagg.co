/**
 * Banners de eventos de Free Fire (recargas acumuladas, eventos de la semana o del mes) para el carrusel del inicio.
 * Cada uno sale solo entre `from` y `to` (hora de Colombia, ambos incluidos) y se apaga solo al terminar: no hay que
 * borrarlo a mano. Las imágenes van en public/promo/eventos (1600 × 480) y public/promo/eventos/m (800 × 600).
 * Solo se publican eventos confirmados (anuncio oficial de Garena para Latinoamérica): un dato equivocado engaña al cliente.
 */
export type EventBanner = {
  id: string;
  title: string; // texto alternativo (accesibilidad y buscadores)
  imageUrl: string;
  imageMobileUrl: string;
  href: string;
  from: string; // «2026-11-20»
  to: string; // «2026-11-26»
};

export const EVENT_BANNERS: EventBanner[] = [
  // Semana del 17 de noviembre de 2026 (agenda de Free Fire Latinoamérica, pestaña «Obténlo ahora» del juego).
  // No se sabe aún cuándo terminan: se dejan una semana y se extienden si siguen. Arte propio, no de Garena.
  {
    id: "evo-awm-abismo-cosmico",
    title: "Nueva Evo AWM Abismo Cósmico en Free Fire: recarga tus diamantes",
    imageUrl: "/promo/eventos/awm-abismo-cosmico.svg",
    imageMobileUrl: "/promo/eventos/m/awm-abismo-cosmico.svg",
    href: "/recargas",
    from: "2026-11-17",
    to: "2026-11-23",
  },
  {
    id: "punos-cometa-cosmico",
    title: "Nuevos Puños Cometa Cósmico en Free Fire: consíguelos con diamantes",
    imageUrl: "/promo/eventos/punos-cometa-cosmico.svg",
    imageMobileUrl: "/promo/eventos/m/punos-cometa-cosmico.svg",
    href: "/recargas",
    from: "2026-11-17",
    to: "2026-11-23",
  },
];

/** Los que están vigentes hoy (hora de Colombia), en el orden de la lista. */
export function activeEventBanners(now = new Date(), list: EventBanner[] = EVENT_BANNERS) {
  const today = new Date(now.getTime() - 5 * 3600_000).toISOString().slice(0, 10);
  return list.filter((b) => b.from <= today && today <= b.to).map(({ id, title, imageUrl, imageMobileUrl, href }) => ({ id, title, imageUrl, imageMobileUrl, href }));
}
