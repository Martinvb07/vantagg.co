import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";

/**
 * Configuración editable de la tienda (marca, contacto, textos legales básicos).
 * Los valores vacíos se ocultan en la interfaz en lugar de mostrar datos inventados.
 */
export const SETTING_DEFAULTS = {
  storeName: "VANTAGG",
  storeTagline: "Recargas y cuentas Free Fire",
  logoUrl: "",
  orderPrefix: "VX",
  legalName: "",
  taxId: "",
  city: "Colombia",
  address: "",
  supportEmail: "",
  staffAlertEmail: "", // avisos internos (ventas, chats, reclamos, recargas detenidas); no se muestra en la tienda
  whatsapp: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "",
  instagram: process.env.NEXT_PUBLIC_INSTAGRAM_URL ?? "",
  supportHours: "",
  showGarenaDisclaimer: "true",
  announcement: "",
  paymentMethods: "debito,credito,nequi,pse",
  accountsMode: "auto", // sección de cuentas: auto (solo si hay cuentas publicadas) | on | off
  maintenanceMode: "false", // "true": la tienda se ve, pero no acepta compras nuevas ni pagos de pedidos pendientes
  maintenanceMessage: "", // texto para los clientes durante el mantenimiento (vacío: uno genérico)
  googleTagId: "", // etiqueta de Google para medir campañas: AW-… (Google Ads) y/o G-… (Analytics), separados por coma
  googleAdsPurchase: "", // conversión de compra de Google Ads: AW-…/etiqueta
  metaPixelId: "", // Meta Pixel (Facebook e Instagram Ads): el número del píxel
  // Correos automáticos (Panel → Ajustes → Correos automáticos)
  autoRecovery: "true", // «¿Aún quieres tus diamantes?» solo, 1 hora después de que un pedido vence sin pagar
  mktFirstPurchase: "true", // «Tu primera recarga te espera» a registrados sin compras (solo si aceptaron ofertas)
  mktWinbackDays: "21", // «¿Te quedaste sin diamantes?» tras N días sin comprar (0 = apagado; solo si aceptaron ofertas)
  marketingPromoCode: "", // código de descuento opcional para esos correos
  emailAutomationsAt: "", // última ejecución de los correos automáticos (ISO)
  purgeCancelled: "false", // "true": borra los pedidos cancelados sin pago 24 h después del correo «comprar de nuevo»
  orderLimitOpen: "2", // pedidos esperando pago a la vez por correo / ID de jugador (0 = sin límite)
  orderLimitUnpaid: "5", // pedidos sin pagar en 24 h por correo / ID de jugador (0 = sin límite)
  // Precios por país (fuera de Colombia: dólares con recargo y la moneda local como referencia)
  foreignPricing: "reference", // "reference": se cobra en pesos y se muestra el precio en dólares como referencia; "usd": se cobra en dólares (con ePayco)
  foreignSurchargePct: "5", // recargo (%) sobre el precio de Colombia para clientes de otros países
  fxRates: "", // tasas del día (JSON), las actualiza el mantenimiento
  topupCoverUrl: "",
  // Proveedor de recargas (se gestionan en Panel → Proveedor)
  topupRegions: "latam", // regiones visibles en la tienda (slugs del proveedor, separados por coma)
  topupRegionsOff: "", // regiones apagadas a mano (p. ej. "id"): «Activar todo» no las vuelve a mostrar
  usdtCop: "3400", // pesos por 1 USDT, para calcular costos y márgenes
  topupMargin: "30", // % de margen para precios sugeridos de regiones nuevas
  minMarginPct: "0", // ganancia mínima (% del precio de venta) de todos los paquetes; 0 = sin mínimo
  minMarginSmallPct: "0", // ganancia mínima de los paquetes de 100 diamantes o menos; 0 = la general
  supplierSyncedAt: "", // última sincronización del catálogo (ISO)
  // Top 3 del mes (Panel → Ranking y premios)
  rankingMode: "on", // "on": se muestra en el inicio; "off": oculto
  rankingMinCop: "120000", // gasto mínimo en el mes (pesos) para ganar
  rankingPrizes: "2180,1060,520", // diamantes del paquete de premio de los puestos 1, 2 y 3
} as const;

/** Claves que no se editan en Ajustes (tienen su propia pantalla). */
export const MANAGED_SETTING_KEYS = new Set<string>(["topupCoverUrl", "topupRegions", "topupRegionsOff", "usdtCop", "topupMargin", "minMarginPct", "minMarginSmallPct", "supplierSyncedAt", "emailAutomationsAt", "fxRates", "rankingMode", "rankingMinCop", "rankingPrizes"]);

export type SettingKey = keyof typeof SETTING_DEFAULTS;
export type StoreSettings = Record<SettingKey, string>;

export const getSettings = cache(async (): Promise<StoreSettings> => {
  const out: StoreSettings = { ...SETTING_DEFAULTS };
  try {
    const rows = await db.setting.findMany();
    for (const r of rows) {
      if (r.key in out) out[r.key as SettingKey] = r.value;
    }
  } catch (err) {
    console.error("[settings] no se pudo leer la configuración:", (err as Error).message);
  }
  return out;
});

export async function saveSettings(values: Partial<StoreSettings>) {
  const entries = Object.entries(values).filter(([k]) => k in SETTING_DEFAULTS);
  await db.$transaction(
    entries.map(([key, value]) =>
      db.setting.upsert({ where: { key }, create: { key, value: value ?? "" }, update: { value: value ?? "" } }),
    ),
  );
}
