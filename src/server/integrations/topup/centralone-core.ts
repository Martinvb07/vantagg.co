/**
 * Central One (API v1): funciones puras para leer su catálogo, armar los datos del jugador y traducir el
 * estado de sus pedidos. Sin red ni base de datos: las cubre tests/centralone.test.ts.
 * Documentación: https://portal.centraloneglobal.com (Integración → API).
 */
import { sameRegion } from "@/domain/topup-regions";
import type { TopUpResult } from "./types";

export type CoTargetField = { key: string; label?: string | null; type: string; options?: Array<{ value: string; label?: string | null }> | null };

export type CoCatalogItem = {
  product_id: string;
  sku?: string | null;
  name: string;
  category?: string | null;
  product_type?: string | null;
  market?: string | null;
  region?: string | null;
  currency?: string | null;
  reseller_price: string;
  status?: string | null;
  product_family_id?: string | null;
  product_family_name?: string | null;
  requires_target?: boolean;
  target_fields?: string[] | null;
  target_schema?: CoTargetField[] | null;
  in_stock?: boolean;
  available_stock?: number | null;
};

export type CoFailure = { code?: string | null; message?: string | null; message_es?: string | null; action?: string | null } | null;

export type CoOrderItem = { id: string; product_name?: string | null; status: string; failure?: CoFailure; delivered_count?: number };

export type CoOrder = {
  id: string;
  reference_code?: string | null;
  status: string;
  total_sale_amount?: string | null;
  currency?: string | null;
  reseller_note?: string | null;
  created_at?: string | null;
  items?: CoOrderItem[];
  failure?: CoFailure;
  line_count?: number;
};

/** Producto del catálogo ya normalizado para la tienda (misma forma que usa la sincronización). */
export type NormalizedProduct = { name: string; amount: number | null; unit: string | null; price: number; delivery: string; product_key: string; out_of_stock: boolean };
export type NormalizedGroup = { key: string; slug: string; products: NormalizedProduct[] };

const num = (s: string) => Number(s.replace(/[.,](?=\d{3}(\D|$))/g, ""));
const NUMBER = String.raw`(\d{1,3}(?:[.,]\d{3})+|\d+)`;

/** ¿Es un producto de Free Fire? Se mira la familia y el nombre (Central One no da un id fijo del juego). */
export function isFreeFireItem(item: Pick<CoCatalogItem, "name" | "product_family_name" | "product_type" | "category">): boolean {
  const text = `${item.product_family_name ?? ""} ${item.name}`;
  if (!/free\s*-?\s*fire/i.test(text)) return false;
  const kind = `${item.product_type ?? ""} ${item.category ?? ""}`.toLowerCase();
  return !kind.trim() || /top\s*-?\s*up|recarga|gaming|game/.test(kind);
}

/**
 * Cantidad total de diamantes a partir del nombre ("Free Fire 100+10 Diamantes" → 110, "FF 1.060 💎" → 1060).
 * null si no es un paquete de diamantes (pases, membresías, tarjetas semanales…).
 */
export function parseDiamondAmount(name: string): number | null {
  if (/pase|pass\b|membres|member|semanal|weekly|mensual|monthly|nivel|level\s*up|evo|booyah/i.test(name)) return null;
  if (!/diamant|diamond|💎/i.test(name)) return null;
  // «100+10 Diamonds»: base + bonus justo antes de la palabra diamantes. No cuenta «(1060 + 10% de bono)».
  const withBonus = new RegExp(`${NUMBER}\\s*\\+\\s*${NUMBER}(?!\\s*%)\\s*(?:bonus\\s*)?(?:diamant|diamond|💎)`, "i").exec(name);
  if (withBonus) return num(withBonus[1]) + num(withBonus[2]);
  // «Free Fire 1166 Diamantes (1060 + 10% de bono)»: el número pegado a la palabra es el total.
  const near = new RegExp(`${NUMBER}\\s*(?:bonus\\s*)?(?:diamant|diamond|💎)`, "i").exec(name);
  const any = near ?? new RegExp(NUMBER).exec(name);
  const n = any ? num(any[1]) : NaN;
  return Number.isInteger(n) && n > 0 && n < 1_000_000 ? n : null;
}

const REGION_ALIASES: Record<string, string> = {
  latam: "latam",
  la: "latam",
  lat: "latam",
  latinoamerica: "latam",
  "latin-america": "latam",
  latino: "latam",
  co: "latam",
  colombia: "latam",
  br: "brazil",
  bra: "brazil",
  brasil: "brazil",
  brazil: "brazil",
  eu: "eu",
  europe: "eu",
  europa: "eu",
  global: "global",
  ww: "global",
  worldwide: "global",
};

/** Slug de región de la tienda a partir de la región de Central One ("LATAM" → "latam", "BR" → "brazil"). */
export function regionSlugOf(raw: string | null | undefined): string {
  const s = (raw ?? "global")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  if (REGION_ALIASES[s]) return REGION_ALIASES[s];
  // Variantes con más texto: «Latin America (LATAM)», «Free Fire Brasil», «Global / Worldwide».
  if (/(^|-)(latam|latin|latino|latinoamerica)(-|$)/.test(s)) return "latam";
  if (/(^|-)(brazil|brasil)(-|$)/.test(s)) return "brazil";
  if (/(^|-)(global|worldwide)(-|$)/.test(s)) return "global";
  return s || "global";
}

// Nombres del campo del ID del jugador (Central One usa player_id en LATAM y game_user_id en GLOBAL/BR/EU).
const PLAYER_KEY = /^(game_?)?(player|user|account)?_?(id|uid)$|^player$|^uid$/i;

/** Campos que pide el producto: target_schema si viene, si no target_fields como texto libre. */
export function targetSchemaOf(item: Pick<CoCatalogItem, "requires_target" | "target_fields" | "target_schema">): CoTargetField[] {
  if (item.target_schema?.length) return item.target_schema;
  return (item.target_fields ?? []).map((key) => ({ key, type: "text", options: null }));
}

/**
 * Arma target_payload con el ID del jugador. Los campos «select» (p. ej. servidor) se llenan con su única
 * opción o con la que coincide con la región del producto. null si el producto pide algo que la tienda no
 * tiene (otro dato libre, o un servidor que no se puede deducir): ese producto no se ofrece.
 */
export function buildTargetPayload(schema: CoTargetField[], playerId: string, regionName?: string | null): Record<string, string> | null {
  const out: Record<string, string> = {};
  let hasPlayer = false;
  for (const f of schema) {
    if (f.type === "select") {
      const opts = f.options ?? [];
      const pick = opts.length === 1 ? opts[0] : opts.find((o) => sameRegion(o.value, regionName) || sameRegion(o.label, regionName) || regionSlugOf(o.value) === regionSlugOf(regionName));
      if (!pick) return null;
      out[f.key] = pick.value;
    } else if (PLAYER_KEY.test(f.key)) {
      out[f.key] = playerId;
      hasPlayer = true;
    } else {
      return null;
    }
  }
  return hasPlayer ? out : null;
}

/** Catálogo de Free Fire agrupado por región, en la forma que usa la sincronización de la tienda. */
export function normalizeCatalog(items: CoCatalogItem[]): { currency: string; groups: NormalizedGroup[] } {
  const groups = new Map<string, NormalizedGroup>();
  let currency = "USD";
  for (const it of items) {
    if (!isFreeFireItem(it) || (it.status && it.status !== "active")) continue;
    currency = it.currency || currency;
    const regionRaw = it.region || it.market || "GLOBAL";
    const slug = regionSlugOf(regionRaw);
    const amount = parseDiamondAmount(it.name);
    const deliverable = !!buildTargetPayload(targetSchemaOf(it), "123456789", regionRaw);
    const g = groups.get(slug) ?? { key: regionRaw, slug, products: [] };
    g.products.push({
      name: it.name,
      amount,
      unit: amount ? "Diamonds" : null,
      price: Number(it.reseller_price),
      delivery: deliverable ? "player_id" : "unsupported",
      product_key: it.product_id,
      out_of_stock: it.in_stock === false,
    });
    groups.set(slug, g);
  }
  return { currency, groups: [...groups.values()] };
}

/** Idempotency-Key válida para Central One (8-255 caracteres A-Z a-z 0-9 _ -). */
export function idempotencyKeyFor(key: string): string {
  const clean = key.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 255);
  return clean.length >= 8 ? clean : `${clean}-vantagg`.slice(0, 255);
}

const FAILURE_HINT: Record<string, string> = {
  invalid_player: "El ID del jugador no existe o es de otra región/servidor.",
  not_eligible: "La cuenta no puede recibir este producto.",
  quantity_not_supported: "El producto se compra de a una unidad.",
  price_changed: "El precio del proveedor cambió antes de completar la compra.",
  out_of_stock: "El proveedor tiene el producto agotado.",
  provider_unavailable: "El proveedor está en mantenimiento o con una falla temporal.",
  provider_rejected: "El proveedor rechazó la recarga.",
  cancelled: "La línea se canceló antes de comprarse.",
};

function failureText(f: CoFailure, ref: string | null | undefined): string {
  const code = f?.code ?? "unknown";
  const text = f?.message_es || FAILURE_HINT[code] || "El proveedor no pudo completar la recarga.";
  return `[${code}] ${text}${ref ? ` (ref. ${ref})` : ""}`;
}

/** Estado de un pedido de Central One → estado de la entrega en la tienda (se mira la línea del paquete). */
export function mapCoOrder(o: CoOrder): TopUpResult {
  const line = o.items?.[0];
  const status = (line?.status ?? o.status ?? "").toLowerCase();
  const ref = o.reference_code ?? null;
  if (status === "completed" || (!line && o.status === "completed")) {
    return { status: "SUCCESS", providerRef: o.id, simulated: false, message: ref ? `Central One ${ref}` : undefined };
  }
  if (status === "refunded") {
    return { status: "FAILED", providerRef: o.id, simulated: false, message: `[provider_rejected] El proveedor revirtió la entrega y devolvió el saldo${ref ? ` (ref. ${ref})` : ""}.` };
  }
  if (status === "failed" || status === "cancelled") {
    return { status: "FAILED", providerRef: o.id, simulated: false, message: failureText(line?.failure ?? o.failure ?? null, ref) };
  }
  return { status: "PENDING", providerRef: o.id, simulated: false };
}
