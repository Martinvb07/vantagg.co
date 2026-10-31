/**
 * Temporada de Halloween: del 20 de octubre al 2 de noviembre, hora de Colombia (UTC−5). Fuera de esas
 * fechas la tienda se ve exactamente igual que siempre (la decoración va encima, no reemplaza nada).
 * SEASON=halloween u SEASON=off en el .env la fuerza a mano (por ejemplo, para apagarla antes).
 */
export function isHalloween(now = new Date()): boolean {
  const forced = process.env.SEASON;
  if (forced === "halloween") return true;
  if (forced === "off") return false;
  const co = new Date(now.getTime() - 5 * 3600_000);
  const month = co.getUTCMonth();
  const day = co.getUTCDate();
  return (month === 9 && day >= 20) || (month === 10 && day <= 2);
}
