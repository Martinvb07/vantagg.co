/**
 * Temporadas de la tienda: decoración que va ENCIMA del diseño de siempre (no reemplaza nada). Fuera de temporada la
 * tienda se ve exactamente igual que siempre.
 *  - Halloween: sola, del 20 de octubre al 2 de noviembre, hora de Colombia (UTC−5).
 *  - Navidad: a mano, en Panel → Ajustes → Temporada (seasonTheme = "navidad"); «Normal» la quita. El 1 de enero
 *    se apaga sola (ver christmasOver y el mantenimiento).
 * SEASON=halloween, SEASON=navidad u SEASON=off en el .env la fuerza a mano (por ejemplo, para apagarla antes).
 */
import { NAVIDAD_BANNERS } from "@/content/navidad-banners";

export type Season = "halloween" | "navidad";

export function isHalloween(now = new Date()): boolean {
  const forced = process.env.SEASON;
  if (forced === "halloween") return true;
  if (forced === "off" || forced === "navidad") return false;
  const co = new Date(now.getTime() - 5 * 3600_000);
  const month = co.getUTCMonth();
  const day = co.getUTCDate();
  return (month === 9 && day >= 20) || (month === 10 && day <= 2);
}

/**
 * ¿Ya terminó la Navidad? Desde el 1 de enero (hora de Colombia) y hasta agosto la decoración navideña no se muestra
 * aunque siga encendida en Ajustes, y el mantenimiento la apaga (vuelve a «Normal»). De septiembre a diciembre se
 * puede encender a mano.
 */
export function christmasOver(now = new Date()): boolean {
  return new Date(now.getTime() - 5 * 3600_000).getUTCMonth() <= 7;
}

/** Temporada activa: la forzada en el .env, la elegida en Ajustes (Navidad, hasta el 31 de diciembre) o la de la fecha (Halloween). */
export function currentSeason(seasonTheme: string | null | undefined, now = new Date()): Season | null {
  const forced = process.env.SEASON;
  if (forced === "halloween" || forced === "navidad") return forced;
  if (forced === "off") return null;
  if (seasonTheme === "navidad" && !christmasOver(now)) return "navidad";
  return isHalloween(now) ? "halloween" : null;
}

/**
 * Banners en temporada: en Navidad, los banners de la marca (public/promo) se cambian solos por su versión navideña
 * (public/promo/navidad, ver scripts/generar-banners.mjs). Lo guardado en el panel no cambia: fuera de temporada se
 * ven los de siempre. Los banners propios subidos al panel llevan nieve en el borde (season-cap en BannerPicture).
 */
export function seasonalBanner<T extends { imageUrl: string; imageMobileUrl?: string | null }>(b: T, season: Season | null): T {
  if (season !== "navidad") return b;
  const swap = (u: string | null | undefined) => (u && NAVIDAD_BANNERS.has(u) ? u.replace("/promo/", "/promo/navidad/") : u);
  return { ...b, imageUrl: swap(b.imageUrl) ?? b.imageUrl, imageMobileUrl: swap(b.imageMobileUrl) };
}

/** ¿La imagen ya es de temporada (versión navideña o banner de temporada)? Esas no llevan nieve en el borde. */
export const isSeasonalImage = (url: string) => /^\/promo\/navidad\/|^\/promo\/(m\/)?hero-(navidad|halloween)\.svg$/.test(url);

/** Banner de la temporada para el carrusel del inicio (va de primero; los del panel siguen igual detrás). */
export function seasonBanner(season: Season | null) {
  if (season === "halloween") return { id: "temporada-halloween", title: "Noche de Halloween: recarga tus diamantes", imageUrl: "/promo/hero-halloween.svg", imageMobileUrl: "/promo/m/hero-halloween.svg", href: "/recargas" };
  if (season === "navidad") return { id: "temporada-navidad", title: "Feliz Navidad: regala diamantes directo a su ID", imageUrl: "/promo/hero-navidad.svg", imageMobileUrl: "/promo/m/hero-navidad.svg", href: "/recargas" };
  return null;
}
