/** Utilidades puras para los correos (cubiertas por tests/). */

/** Correos internos o de prueba (admin@vanta.local, @example.com) no se envían: rebotarían y dañan la reputación del remitente. */
export const deliverable = (email: string) => !/@(?:[^@]+\.)?(local|localhost|test|invalid|example\.(?:com|org|net))$/i.test(email);

/** "Chrome en Windows" a partir del user-agent (no se guarda nada). */
export function describeDevice(ua: string | null | undefined): string {
  if (!ua) return "Desconocido";
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Navegador";
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iPhone/iPad" : /Mac OS X/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "otro sistema";
  return `${browser} en ${os}`;
}
