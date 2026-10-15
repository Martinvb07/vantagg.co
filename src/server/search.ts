import "server-only";
import { db } from "@/lib/db";
import { formatMoney, formatNumber, packageTitle } from "@/lib/money";
import { FAQ } from "@/content/faq";
import { FF_RANKS, FF_REGIONS, rankLabel, regionInfo } from "@/domain/freefire";
import { quotePrice } from "@/domain/pricing";
import { accountsVisible, listingAvailability, getPackages } from "./catalog";

/**
 * Búsqueda en vivo por palabras clave. Entiende intención ("cuentas", "nequi",
 * "reembolso"), rangos, servidores, características, cantidades de diamantes
 * y preguntas de ayuda. Sin acentos ni mayúsculas, tolera palabras a medio escribir.
 */

export type SearchIcon = "gem" | "users" | "radar" | "list" | "card" | "help" | "refund" | "tag" | "globe" | "sparkles";

export type SearchHit = {
  key: string;
  title: string;
  subtitle?: string;
  href: string;
  icon?: SearchIcon;
  rank?: string | null;
  image?: string | null;
  price?: string;
  badge?: string;
  demo?: boolean;
};

export type SearchGroup = { label: string; hits: SearchHit[] };
export type SearchResult = { q: string; groups: SearchGroup[]; total: number };

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

const STOP = new Set(["de", "del", "la", "el", "los", "las", "en", "y", "a", "al", "para", "con", "un", "una", "unos", "por", "mi", "mis", "me", "quiero", "comprar", "compra", "busco", "free", "fire", "ff", "freefire", "que", "como", "donde"]);

/** "5.600 diamantes" → ["5600", "diamantes"] */
function tokenize(q: string) {
  return norm(q)
    .replace(/(\d)[.,](\d{3})/g, "$1$2")
    .split(/[^a-z0-9]+/)
    .filter((t) => t && !STOP.has(t));
}

const words = (s: string) => norm(s).split(/[^a-z0-9]+/).filter(Boolean);

/** El token coincide con una palabra si es su comienzo (búsqueda mientras se escribe). */
const tokenHits = (token: string, ws: string[]) => ws.some((w) => w.startsWith(token) || (token.length >= 5 && w.length >= 4 && token.startsWith(w)));

const SECTIONS: Array<{ title: string; subtitle: string; href: string; icon: SearchIcon; kw: string[] }> = [
  { title: "Recargar diamantes", subtitle: "Directo a tu ID · bonus en todos los paquetes", href: "/recargas", icon: "gem", kw: ["diamantes", "diamante", "recarga", "recargar", "recargas", "dimas", "paquete", "paquetes", "bonus"] },
  { title: "Cuentas Free Fire", subtitle: "Rango, nivel y skins a la vista", href: "/cuentas", icon: "users", kw: ["cuentas", "cuenta", "perfil", "perfiles", "skins", "nivel", "rango", "rangos"] },
  { title: "Rastrear pedido", subtitle: "Estado del pago y la entrega", href: "/pedido", icon: "radar", kw: ["rastrear", "rastreo", "seguimiento", "pedido", "pedidos", "orden", "estado", "entrega", "llego"] },
  { title: "Mis pedidos", subtitle: "Historial de compras con tu sesión", href: "/cuenta", icon: "list", kw: ["historial", "compras", "pedidos", "sesion"] },
  { title: "Medios de pago", subtitle: "Bold: tarjeta, Nequi, PSE y Bancolombia", href: "/medios-de-pago", icon: "card", kw: ["pago", "pagos", "pagar", "nequi", "pse", "tarjeta", "debito", "credito", "bancolombia", "medios", "bold", "bre-b", "breb", "llave", "transferencia"] },
  { title: "Centro de ayuda", subtitle: "Preguntas frecuentes y contacto", href: "/ayuda", icon: "help", kw: ["ayuda", "soporte", "contacto", "whatsapp", "preguntas", "problema", "duda"] },
  { title: "Solicitar reembolso", subtitle: "Por el mismo medio de pago", href: "/ayuda?tema=reembolso#contacto", icon: "refund", kw: ["reembolso", "reembolsos", "devolucion", "devolver", "garantia"] },
  { title: "Códigos promocionales", subtitle: "Aplícalo en el último paso", href: "/ayuda#codigo-promocional", icon: "tag", kw: ["codigo", "codigos", "cupon", "cupones", "promo", "descuento", "oferta"] },
];

const PACKAGE_KW = ["diamantes", "diamante", "recarga", "recargar", "paquete", "paquetes", "dimas", "bonus"];
const ACCOUNT_KW = ["cuentas", "cuenta", "perfil", "perfiles"];

export async function smartSearch(raw: string): Promise<SearchResult> {
  const q = raw.trim().slice(0, 60);
  const tokens = tokenize(q);
  if (!tokens.length) return { q, groups: [], total: 0 };

  const numbers = tokens.filter((t) => /^\d{2,}$/.test(t));
  const wantsPackages = tokens.some((t) => tokenHits(t, PACKAGE_KW));
  const wantsAccounts = tokens.some((t) => tokenHits(t, ACCOUNT_KW));
  // Palabras que describen contenido (no la intención general).
  const content = tokens.filter((t) => !tokenHits(t, ACCOUNT_KW) && !tokenHits(t, PACKAGE_KW));

  const showAccounts = await accountsVisible();
  const [packages, listings] = await Promise.all([
    getPackages(),
    !showAccounts ? Promise.resolve([]) : db.accountListing
      .findMany({
        where: { status: { in: ["PUBLISHED", "RESERVED"] } },
        orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
        take: 300,
        select: { id: true, slug: true, title: true, description: true, rank: true, region: true, level: true, skinsCount: true, price: true, compareAtPrice: true, currency: true, isDemo: true, status: true, reservedUntil: true, images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } }, tags: { select: { tag: true } } },
      })
      .catch(() => []),
  ]);
  const visible = listings.filter((l) => {
    const a = listingAvailability(l);
    return a.available || a.reservedTemporarily;
  });

  // Secciones
  const sections = SECTIONS.filter((s) => showAccounts || s.href !== "/cuentas").map((s) => ({ s, score: tokens.filter((t) => tokenHits(t, s.kw) || tokenHits(t, words(s.title))).length }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ s }): SearchHit => ({ key: `s:${s.href}`, title: s.title, subtitle: s.subtitle, href: s.href, icon: s.icon }));

  // Paquetes: por cantidad ("520", "5600") o por intención ("diamantes")
  const pkgHits = packages
    .filter((p) => !wantsAccounts && (numbers.length ? numbers.some((n) => String(p.diamonds).startsWith(n) || String(p.diamonds + p.bonusDiamonds).startsWith(n)) : wantsPackages && !content.length))
    .slice(0, 6)
    .map(
      (p): SearchHit => ({
        key: `p:${p.slug}`,
        title: packageTitle(p.diamonds, p.bonusDiamonds),
        subtitle: `Recibes ${formatNumber(p.diamonds + p.bonusDiamonds)} diamantes`,
        href: `/recargas?paquete=${p.slug}`,
        icon: "gem",
        price: formatMoney(p.quote.price, p.currency),
        badge: p.label === "RECOMMENDED" ? "Recomendado" : p.label === "BEST_SELLER" ? "Más vendido" : undefined,
        demo: p.isDemo,
      }),
    );

  // Filtros de cuentas: rangos, servidores y características con resultados
  const rankCount = new Map<string, number>();
  const regionCount = new Map<string, number>();
  const tagCount = new Map<string, number>();
  for (const l of visible) {
    if (l.rank) rankCount.set(l.rank, (rankCount.get(l.rank) ?? 0) + 1);
    regionCount.set(l.region, (regionCount.get(l.region) ?? 0) + 1);
    for (const t of l.tags) tagCount.set(t.tag, (tagCount.get(t.tag) ?? 0) + 1);
  }
  // Con intención de cuentas, "diamante" se entiende como rango y no como paquete.
  const textTokens = tokens.filter((t) => !/^\d+$/.test(t) && t.length >= 2 && !tokenHits(t, ACCOUNT_KW) && (wantsAccounts || !tokenHits(t, PACKAGE_KW)));
  const plural = (n: number) => `${n} ${n === 1 ? "cuenta" : "cuentas"}`;
  const filters: SearchHit[] = [];
  if (textTokens.length) {
    for (const r of [...FF_RANKS].reverse()) {
      const n = rankCount.get(r.id);
      if (n && textTokens.every((t) => tokenHits(t, words(r.label)))) filters.push({ key: `r:${r.id}`, title: `Cuentas ${r.label}`, subtitle: plural(n), href: `/cuentas?rango=${r.id}`, rank: r.id });
    }
    for (const g of FF_REGIONS) {
      const n = regionCount.get(g.code);
      if (n && textTokens.every((t) => tokenHits(t, [...words(g.label), norm(g.code)]))) filters.push({ key: `g:${g.code}`, title: `Servidor ${g.label}`, subtitle: plural(n), href: `/cuentas?servidor=${g.code}`, icon: "globe" });
    }
    for (const [tag, n] of tagCount) {
      if (textTokens.every((t) => tokenHits(t, words(tag)))) filters.push({ key: `t:${tag}`, title: `Cuentas con ${tag.toLowerCase()}`, subtitle: plural(n), href: `/cuentas?caract=${encodeURIComponent(tag)}`, icon: "sparkles" });
    }
  }

  // Cuentas: todas las palabras de contenido deben aparecer en la ficha
  const accContent = wantsAccounts ? tokens.filter((t) => !tokenHits(t, ACCOUNT_KW)) : content;
  const accHits = visible
    .filter((l) => {
      if (!accContent.length) return wantsAccounts;
      const hay = words([l.title, l.description, rankLabel(l.rank) ?? "", regionInfo(l.region)?.label ?? l.region, l.region, ...l.tags.map((t) => t.tag), l.level ? `nivel ${l.level}` : "", l.skinsCount ? `${l.skinsCount} skins` : ""].join(" "));
      return accContent.every((t) => (/^\d+$/.test(t) ? hay.includes(t) : tokenHits(t, hay)));
    })
    .slice(0, 4)
    .map((l): SearchHit => {
      const quote = quotePrice(l.price, l.compareAtPrice);
      return {
        key: `a:${l.slug}`,
        title: l.title,
        subtitle: [rankLabel(l.rank), l.level ? `Nivel ${l.level}` : null, l.skinsCount ? `${l.skinsCount} skins` : null].filter(Boolean).join(" · "),
        href: `/cuentas/${l.slug}`,
        image: l.images[0]?.url ?? null,
        rank: l.rank,
        price: formatMoney(quote.price, l.currency),
        demo: l.isDemo,
      };
    });

  // Ayuda: preguntas cuyo texto contiene todas las palabras
  const helpTokens = tokens.filter((t) => t.length >= 3 && !/^\d+$/.test(t));
  const help = helpTokens.length
    ? FAQ.filter((f) => showAccounts || f.group !== "cuentas").map((f) => {
        const qw = words(f.q);
        const aw = words(f.a);
        const all = helpTokens.every((t) => tokenHits(t, qw) || tokenHits(t, aw));
        const score = helpTokens.filter((t) => tokenHits(t, qw)).length;
        return { f, all, score };
      })
        .filter((x) => x.all && x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map(({ f }): SearchHit => ({ key: `h:${f.id}`, title: f.q, href: `/ayuda#${f.id}`, icon: "help" }))
    : [];

  const groups: SearchGroup[] = [];
  const addPackages = () => pkgHits.length && groups.push({ label: "Diamantes", hits: pkgHits });
  if (numbers.length) addPackages();
  if (sections.length) groups.push({ label: "Secciones", hits: sections });
  if (!numbers.length) addPackages();
  if (filters.length || accHits.length) groups.push({ label: "Cuentas", hits: [...filters.slice(0, 4), ...accHits] });
  if (help.length) groups.push({ label: "Ayuda", hits: help });

  return { q, groups, total: groups.reduce((n, g) => n + g.hits.length, 0) };
}
