/**
 * Eventos para la etiqueta de Google (solo en el navegador). Si la tienda no tiene la etiqueta configurada,
 * no hace nada. El consentimiento lo maneja el modo de consentimiento (ver src/domain/google-tag.ts).
 */
type Gtag = (...args: unknown[]) => void;

export function gtagEvent(name: string, params: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const g = (window as unknown as { gtag?: Gtag }).gtag;
  if (typeof g === "function") g("event", name, params);
}

export function gtagConsent(granted: boolean) {
  if (typeof window === "undefined") return;
  const g = (window as unknown as { gtag?: Gtag }).gtag;
  if (typeof g !== "function") return;
  const v = granted ? "granted" : "denied";
  g("consent", "update", { ad_storage: v, ad_user_data: v, ad_personalization: v, analytics_storage: v });
  g("set", "ads_data_redaction", !granted);
}
