/**
 * Meta Pixel (Facebook e Instagram Ads) para medir las campañas. El ID se pega en Panel → Ajustes → Publicidad;
 * aquí se valida para que solo entre el número del píxel, nunca código.
 */
import { CONSENT_KEY } from "./google-tag";

/** El ID del píxel es solo un número (Administrador de eventos → Orígenes de datos → tu píxel). */
export function parseMetaPixelId(value: string | null | undefined): string | null {
  const v = (value ?? "").trim();
  return /^\d{10,20}$/.test(v) ? v : null;
}

/**
 * Script inicial del píxel (antes que la página): la cola de fbq, el consentimiento guardado (sin «Aceptar»
 * en el aviso de cookies, el píxel no envía nada: fbq consent revoke) y la vista de página.
 * La librería fbevents.js se carga aparte, con el nonce de la CSP.
 */
export function metaPixelInitScript(id: string): string {
  return `(function(f){if(f.fbq)return;var n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version="2.0";n.queue=[];
var c=null;try{c=localStorage.getItem(${JSON.stringify(CONSENT_KEY)})}catch(e){}
n("consent",c==="granted"?"grant":"revoke");n("init",${JSON.stringify(id)});n("track","PageView")})(window);`;
}
