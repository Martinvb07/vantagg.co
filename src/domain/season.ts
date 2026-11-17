/**
 * Temporadas de la tienda: decoración que va ENCIMA del diseño de siempre (no reemplaza nada). Fuera de temporada la
 * tienda se ve exactamente igual que siempre.
 *  - Halloween: sola, del 20 de octubre al 2 de noviembre, hora de Colombia (UTC−5).
 *  - Navidad: a mano, en Panel → Ajustes → Temporada (seasonTheme = "navidad"); «Normal» la quita.
 * SEASON=halloween, SEASON=navidad u SEASON=off en el .env la fuerza a mano (por ejemplo, para apagarla antes).
 */
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

/** Temporada activa: la forzada en el .env, la elegida en Ajustes (Navidad) o la de la fecha (Halloween). */
export function currentSeason(seasonTheme: string | null | undefined, now = new Date()): Season | null {
  const forced = process.env.SEASON;
  if (forced === "halloween" || forced === "navidad") return forced;
  if (forced === "off") return null;
  if (seasonTheme === "navidad") return "navidad";
  return isHalloween(now) ? "halloween" : null;
}

/**
 * Texto de la barra navideña según el día en Colombia: cuenta regresiva a Navidad, Noche de Velitas (7 de diciembre),
 * Novena de Aguinaldos (16 al 23), Nochebuena, Navidad, fin de año y Año Nuevo (hasta Reyes, 6 de enero).
 */
export function christmasMessage(now = new Date()): string {
  const co = new Date(now.getTime() - 5 * 3600_000);
  const [y, m, d] = [co.getUTCFullYear(), co.getUTCMonth(), co.getUTCDate()];
  if (m === 0 && d <= 6) return "¡Feliz Año Nuevo!";
  if (m === 11 && d === 24) return "¡Hoy es Nochebuena!";
  if (m === 11 && d === 25) return "¡Feliz Navidad!";
  if (m === 11 && d > 25) return "¡Feliz fin de año!";
  if (m === 11 && d === 7) return "¡Feliz Noche de Velitas!";
  const days = Math.round((Date.UTC(y, 11, 25) - Date.UTC(y, m, d)) / 86_400_000);
  if (days <= 0) return "Temporada navideña";
  const left = days === 1 ? "Falta 1 día para Navidad" : `Faltan ${days} días para Navidad`;
  return m === 11 && d >= 16 ? `Novena de Aguinaldos · ${left.charAt(0).toLowerCase()}${left.slice(1)}` : left;
}

/** Banner de la temporada para el carrusel del inicio (va de primero; los del panel siguen igual detrás). */
export function seasonBanner(season: Season | null) {
  if (season === "halloween") return { id: "temporada-halloween", title: "Noche de Halloween: recarga tus diamantes", imageUrl: "/promo/hero-halloween.svg", imageMobileUrl: "/promo/m/hero-halloween.svg", href: "/recargas" };
  if (season === "navidad") return { id: "temporada-navidad", title: "Feliz Navidad: regala diamantes directo a su ID", imageUrl: "/promo/hero-navidad.svg", imageMobileUrl: "/promo/m/hero-navidad.svg", href: "/recargas" };
  return null;
}
