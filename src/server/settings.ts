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
  topupCoverUrl: "",
  // Proveedor de recargas (se gestionan en Panel → Proveedor)
  topupRegions: "latam", // regiones visibles en la tienda (slugs del proveedor, separados por coma)
  usdtCop: "3400", // pesos por 1 USDT, para calcular costos y márgenes
  topupMargin: "30", // % de margen para precios sugeridos de regiones nuevas
  supplierSyncedAt: "", // última sincronización del catálogo (ISO)
} as const;

/** Claves que no se editan en Ajustes (tienen su propia pantalla). */
export const MANAGED_SETTING_KEYS = new Set<string>(["topupCoverUrl", "topupRegions", "usdtCop", "topupMargin", "supplierSyncedAt"]);

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
