/** Solo rutas internas: evita redirecciones abiertas (//otro-sitio, /\otro-sitio). */
export function safeNext(v: unknown, fallback: string): string {
  const s = typeof v === "string" ? v : "";
  return s.startsWith("/") && !s.startsWith("//") && !s.startsWith("/\\") && s.length < 300 ? s : fallback;
}
