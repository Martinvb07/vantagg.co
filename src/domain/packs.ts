/**
 * Tarjetas y pases de Free Fire (no son diamantes). En la tienda son paquetes sin diamantes (diamonds = 0)
 * cuyo nombre dice qué son; se compran con el ID del jugador igual que los diamantes.
 */
export type PassKind = "weekly-lite" | "weekly" | "monthly" | "booyah";

export const PASS_INFO: Record<PassKind, { title: string; headline: string; caption: string; short: string; detail: string; sort: number }> = {
  "weekly-lite": { title: "Tarjeta Semanal Básica", headline: "7 DÍAS", caption: "Semanal básica", short: "Membresía básica de 7 días", detail: "Membresía de 7 días: entra al juego cada día y reclama tus diamantes.", sort: 1 },
  weekly: { title: "Tarjeta Semanal", headline: "7 DÍAS", caption: "Tarjeta semanal", short: "Membresía de 7 días", detail: "Membresía de 7 días: entra al juego cada día y reclama tus diamantes.", sort: 2 },
  monthly: { title: "Tarjeta Mensual", headline: "30 DÍAS", caption: "Tarjeta mensual", short: "Membresía de 30 días", detail: "Membresía de 30 días: entra al juego cada día y reclama tus diamantes.", sort: 3 },
  booyah: { title: "Pase Booyah Premium", headline: "PASE", caption: "Booyah premium", short: "Pase de la temporada", detail: "Pase Booyah de la temporada con sus recompensas premium.", sort: 4 },
};

const plain = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Nombre del producto (del proveedor o de la tienda) → tarjeta o pase que se vende, o null. */
export function passKindOf(name: string): PassKind | null {
  const n = plain(name);
  if (/\bpin\b/.test(n) || /\bplus\b/.test(n)) return null; // códigos PIN y el Booyah Premium Plus no se venden
  if (/semanal\s+b.{0,3}sica/.test(n)) return "weekly-lite"; // tolera tildes mal codificadas («BÃ¡sica»)
  if (/semanal/.test(n)) return "weekly";
  if (/mensual/.test(n)) return "monthly";
  if (/booyah/.test(n) && /premium/.test(n)) return "booyah";
  return null;
}

/** Paquete de la tienda → tarjeta o pase (null si es de diamantes). */
export function passOf(p: { diamonds: number; name: string }): PassKind | null {
  return p.diamonds > 0 ? null : passKindOf(p.name);
}

type PackLike = { diamonds: number; bonusDiamonds: number; pass?: PassKind | null };

/** Título del paquete: «100 + 10 Bonus» o el nombre de la tarjeta. */
export function packTitle(p: PackLike, diamondsTitle: (diamonds: number, bonus: number) => string): string {
  return p.pass ? PASS_INFO[p.pass].title : diamondsTitle(p.diamonds, p.bonusDiamonds);
}

/** Línea corta de detalle: «Recibes 110 diamantes» o «Membresía de 7 días». */
export function packDetail(p: PackLike, format: (n: number) => string): string {
  return p.pass ? PASS_INFO[p.pass].short : `Recibes ${format(p.diamonds + p.bonusDiamonds)} diamantes`;
}
