/**
 * Etiqueta de Google (Google Ads y Google Analytics 4) para medir las campañas. Los códigos se pegan en
 * Panel → Ajustes → Publicidad; aquí se validan para que solo entren identificadores, nunca código.
 */

/** «AW-123456789» (Google Ads), «G-ABC123XYZ» (Analytics 4) o «GT-…» (etiqueta de Google). Separados por coma. */
export function parseGoogleTagIds(value: string | null | undefined): string[] {
  const ids = (value ?? "")
    .split(/[\s,;]+/)
    .map((s) => s.trim().toUpperCase())
    .filter((s) => /^(AW|G|GT|DC)-[A-Z0-9]{4,20}$/.test(s));
  return [...new Set(ids)].slice(0, 4);
}

/** Acción de conversión de compra de Google Ads: «AW-123456789/AbCdEfGhIjKlMn». */
export function parseConversionLabel(value: string | null | undefined): string | null {
  const v = (value ?? "").trim();
  const m = /^(AW)-(\d{6,15})\/([A-Za-z0-9_-]{4,64})$/i.exec(v);
  return m ? `AW-${m[2]}/${m[3]}` : null;
}

/** Configuración pública (los códigos de la etiqueta son visibles en cualquier página que la usa: no son secretos). */
export type GoogleTagConfig = { ids: string[]; purchase: string | null };

export function googleTagConfig(s: { googleTagId?: string; googleAdsPurchase?: string }): GoogleTagConfig | null {
  const purchase = parseConversionLabel(s.googleAdsPurchase);
  const ids = parseGoogleTagIds(s.googleTagId);
  // La conversión de compra ya trae el ID de Google Ads: basta con pegar esa.
  if (purchase && !ids.includes(purchase.split("/")[0])) ids.unshift(purchase.split("/")[0]);
  return ids.length ? { ids, purchase } : null;
}

/** Clave del consentimiento guardado en el navegador: "granted" (aceptó) o "denied" (solo necesarias). */
export const CONSENT_KEY = "vx_consent";

/**
 * Script inicial (se ejecuta antes que la página): modo de consentimiento v2 de Google con todo denegado
 * salvo que la persona ya haya aceptado, y la configuración de cada ID. Sin consentimiento, Google solo
 * recibe señales sin cookies (para modelar conversiones), como pide la Ley 1581.
 */
export function googleTagInitScript(cfg: GoogleTagConfig): string {
  const ids = JSON.stringify(cfg.ids);
  return `(function(){window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}window.gtag=gtag;
var c=null;try{c=localStorage.getItem(${JSON.stringify(CONSENT_KEY)})}catch(e){}var g=c==="granted"?"granted":"denied";
gtag("consent","default",{ad_storage:g,ad_user_data:g,ad_personalization:g,analytics_storage:g,wait_for_update:500});
gtag("set","ads_data_redaction",g!=="granted");gtag("js",new Date());
${ids}.forEach(function(id){gtag("config",id)})})();`;
}
