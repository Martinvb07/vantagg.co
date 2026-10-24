/**
 * Trampa para bots: un campo que las personas no ven (fuera de pantalla y oculto a lectores de pantalla)
 * pero que los bots que llenan todo completan. Si llega con algo, el envío se descarta en silencio.
 */
export const HONEYPOT_FIELD = "sitio_web";

export function caughtByHoneypot(form: FormData): boolean {
  return String(form.get(HONEYPOT_FIELD) ?? "").trim() !== "";
}
