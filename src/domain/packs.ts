/**
 * Tarjetas y pases de Free Fire (no son diamantes). En la tienda son paquetes sin diamantes (diamonds = 0)
 * cuyo nombre dice qué son; se compran con el ID del jugador igual que los diamantes.
 */
/** Niveles de los paquetes de nivel y días del acceso Evo que vende el proveedor. */
export const PASS_LEVELS = [6, 10, 15, 20, 25, 30] as const;
export const EVO_DAYS = [3, 7, 30] as const;
/** Armas Evo: fragmentos de arma y cajas de fragmentos que vende el proveedor (cantidades). */
export const EVO_FRAGMENTS = [10, 50, 100, 500] as const;
export const EVO_BOXES = [1, 5, 10, 50] as const;

export type PassKind =
  | "weekly-lite"
  | "weekly"
  | "monthly"
  | "booyah"
  | "booyah-basic"
  | "booyah-plus"
  | "bp-card"
  | `evo-${(typeof EVO_DAYS)[number]}`
  | `evo-frag-${(typeof EVO_FRAGMENTS)[number]}`
  | `evo-box-${(typeof EVO_BOXES)[number]}`
  | `level-${(typeof PASS_LEVELS)[number]}`;

/** Arte de la portada (public/portadas/pase-<arte>.svg): varios productos comparten dibujo. */
export type PassArt = "weekly-lite" | "weekly" | "monthly" | "booyah" | "booyah-basic" | "booyah-plus" | "evo" | "evo-frag" | "evo-box" | "level";

type PassInfo = { title: string; headline: string; caption: string; short: string; detail: string; sort: number; art: PassArt };

export const PASS_INFO: Record<PassKind, PassInfo> = {
  "weekly-lite": { title: "Tarjeta Semanal Básica", headline: "7 DÍAS", caption: "Semanal básica", short: "Membresía básica de 7 días", detail: "Membresía de 7 días: entra al juego cada día y reclama tus diamantes.", sort: 1, art: "weekly-lite" },
  weekly: { title: "Tarjeta Semanal", headline: "7 DÍAS", caption: "Tarjeta semanal", short: "Membresía de 7 días", detail: "Membresía de 7 días: entra al juego cada día y reclama tus diamantes.", sort: 2, art: "weekly" },
  monthly: { title: "Tarjeta Mensual", headline: "30 DÍAS", caption: "Tarjeta mensual", short: "Membresía de 30 días", detail: "Membresía de 30 días: entra al juego cada día y reclama tus diamantes.", sort: 3, art: "monthly" },
  "booyah-basic": { title: "Pase Booyah", headline: "PASE", caption: "Booyah", short: "Pase de la temporada", detail: "Pase Booyah de la temporada con sus recompensas.", sort: 4, art: "booyah-basic" },
  booyah: { title: "Pase Booyah Premium", headline: "PASE", caption: "Booyah premium", short: "Pase de la temporada", detail: "Pase Booyah de la temporada con sus recompensas premium.", sort: 5, art: "booyah" },
  "booyah-plus": { title: "Pase Booyah Premium Plus", headline: "PASE+", caption: "Booyah premium plus", short: "Pase premium plus de la temporada", detail: "Pase Booyah Premium Plus de la temporada: las recompensas premium y niveles extra.", sort: 6, art: "booyah-plus" },
  "bp-card": { title: "BP Card", headline: "BP", caption: "BP Card", short: "Tarjeta del Pase Booyah", detail: "BP Card de Free Fire: se activa en la cuenta con el ID del jugador.", sort: 7, art: "booyah-basic" },
  ...(Object.fromEntries(
    EVO_DAYS.map((d, i) => [
      `evo-${d}`,
      { title: `Acceso Evo ${d} días`, headline: `${d} DÍAS`, caption: "Acceso Evo", short: `Armas Evo durante ${d} días`, detail: `Acceso Evo de ${d} días: usa las armas Evo mientras dure.`, sort: 10 + i, art: "evo" },
    ]),
  ) as Record<`evo-${(typeof EVO_DAYS)[number]}`, PassInfo>),
  ...(Object.fromEntries(
    EVO_FRAGMENTS.map((n, i) => [
      `evo-frag-${n}`,
      {
        title: `${n} Fragmentos de arma Evo`,
        headline: `×${n}`,
        caption: "Fragmentos Evo",
        short: `${n} fragmentos para tus armas Evo`,
        detail: `${n} fragmentos de arma Evo de Free Fire: sirven para mejorar las armas evolutivas. Se entregan con el ID del jugador; el pedido se procesa en un plazo máximo de 24 horas (no es instantáneo); si no se entrega, se reembolsa.`,
        sort: 40 + i,
        art: "evo-frag",
      },
    ]),
  ) as Record<`evo-frag-${(typeof EVO_FRAGMENTS)[number]}`, PassInfo>),
  ...(Object.fromEntries(
    EVO_BOXES.map((n, i) => [
      `evo-box-${n}`,
      {
        title: `${n} ${n === 1 ? "Caja" : "Cajas"} de fragmentos Evo`,
        headline: `×${n}`,
        caption: n === 1 ? "Caja Evo" : "Cajas Evo",
        short: n === 1 ? "Caja con fragmentos de arma Evo" : `${n} cajas con fragmentos de arma Evo`,
        detail: `${n === 1 ? "Una caja" : `${n} cajas`} de fragmentos Evo de Free Fire: al abrirlas recibes fragmentos para tus armas evolutivas. Se entregan con el ID del jugador; el pedido se procesa en un plazo máximo de 24 horas (no es instantáneo); si no se entrega, se reembolsa.`,
        sort: 50 + i,
        art: "evo-box",
      },
    ]),
  ) as Record<`evo-box-${(typeof EVO_BOXES)[number]}`, PassInfo>),
  ...(Object.fromEntries(
    PASS_LEVELS.map((l, i) => [
      `level-${l}`,
      { title: `Paquete de Nivel ${l}`, headline: `NIVEL ${l}`, caption: "Paquete de nivel", short: `Recompensa del nivel ${l}`, detail: `Paquete de nivel ${l} de Free Fire: se entrega con el ID del jugador.`, sort: 20 + i, art: "level" },
    ]),
  ) as Record<`level-${(typeof PASS_LEVELS)[number]}`, PassInfo>),
};

const plain = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/** Nombre del producto (del proveedor o de la tienda) → tarjeta o pase que se vende, o null. */
export function passKindOf(name: string): PassKind | null {
  const n = plain(name);
  if (/\bpin\b/.test(n)) return null; // los códigos PIN no se entregan con el ID
  // Armas Evo: «1 Caja de fragmentos Evo», «10 Cajas de fragmentos Evo», «100 Fragmentos de arma Evo».
  const box = /(\d{1,3})\s*cajas?\s+de\s+fragmentos?\s+evo\b/.exec(n);
  if (box) return (EVO_BOXES as readonly number[]).includes(Number(box[1])) ? (`evo-box-${box[1]}` as PassKind) : null;
  const frag = /(\d{1,4})\s*fragmentos?\s+de\s+armas?\s+evo\b/.exec(n);
  if (frag) return (EVO_FRAGMENTS as readonly number[]).includes(Number(frag[1])) ? (`evo-frag-${frag[1]}` as PassKind) : null;
  if (/semanal\s+b.{0,3}sica/.test(n)) return "weekly-lite"; // tolera tildes mal codificadas («BÃ¡sica»)
  if (/semanal/.test(n)) return "weekly";
  if (/mensual/.test(n)) return "monthly";
  const level = /\b(?:nivel|level(?:\s*up)?)\s*(\d{1,2})\b/.exec(n);
  if (level) return (PASS_LEVELS as readonly number[]).includes(Number(level[1])) ? (`level-${level[1]}` as PassKind) : null;
  const evo = /\bevo\b\D*(\d{1,2})\s*(?:dias?|d\b|days?)/.exec(n);
  if (evo) return (EVO_DAYS as readonly number[]).includes(Number(evo[1])) ? (`evo-${evo[1]}` as PassKind) : null;
  if (/\bbp\s*card\b/.test(n)) return "bp-card";
  if (/booyah/.test(n)) return /premium/.test(n) ? (/\bplus\b/.test(n) ? "booyah-plus" : "booyah") : "booyah-basic";
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

/** Categorías de la tienda para lo que no son diamantes. «evo»: Armas Evo (fragmentos, cajas y acceso Evo). */
export type PassGroup = "evo-frag" | "evo-box" | "evo-access" | "pass";

export function passGroup(kind: PassKind): PassGroup {
  if (kind.startsWith("evo-frag-")) return "evo-frag";
  if (kind.startsWith("evo-box-")) return "evo-box";
  if (/^evo-\d+$/.test(kind)) return "evo-access";
  return "pass";
}

/** ¿Va en «Armas Evo»? (fragmentos, cajas de fragmentos y acceso Evo). */
export const isEvoKind = (kind: PassKind | null | undefined): boolean => !!kind && passGroup(kind) !== "pass";

/**
 * «Tokens» Evo: fragmentos de arma y cajas de fragmentos (lo nuevo de la tienda). Van aparte de los diamantes:
 * tienen sus propios correos y un plazo de entrega más largo (ver TOKEN_DELIVERY en delivery-time.ts).
 */
export const isTokenKind = (kind: PassKind | null | undefined): boolean => !!kind && (passGroup(kind) === "evo-frag" || passGroup(kind) === "evo-box");

/** ¿El producto de un pedido (su copia guardada) es un fragmento o caja Evo? */
export function isTokenItem(snapshot: unknown): boolean {
  const s = (snapshot ?? {}) as { diamonds?: number; name?: string; pass?: string | null };
  if ((s.diamonds ?? 0) > 0) return false;
  return isTokenKind((s.pass as PassKind | null | undefined) ?? null) || isTokenKind(passKindOf(s.name ?? ""));
}

/** Subtítulo de cada grupo en la lista de compra. */
export const PASS_GROUP_TITLE: Record<PassGroup, string> = {
  "evo-frag": "Fragmentos de arma Evo",
  "evo-box": "Cajas de fragmentos Evo",
  "evo-access": "Acceso Evo",
  pass: "Tarjetas, pases y más",
};

/** Página donde se compra un paquete: las Armas Evo en /fragmentos, lo demás en /recargas. */
export function packPath(p: { slug: string; pass: PassKind | null }): string {
  return `${isEvoKind(p.pass) ? "/fragmentos" : "/recargas"}?paquete=${p.slug}`;
}
