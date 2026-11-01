import { headers } from "next/headers";
import { googleTagInitScript, type GoogleTagConfig } from "@/domain/google-tag";

/**
 * Etiqueta de Google en la tienda (no en el panel). El script inicial va en línea con el nonce de la CSP para
 * ejecutarse antes que cualquier evento; gtag.js carga después sin bloquear la página.
 */
export async function GoogleTag({ cfg }: { cfg: GoogleTagConfig }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <>
      <script nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: googleTagInitScript(cfg) }} />
      <script nonce={nonce} suppressHydrationWarning async src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(cfg.ids[0])}`} />
    </>
  );
}
