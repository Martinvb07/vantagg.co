import { NextResponse, type NextRequest } from "next/server";

/**
 * 1) Content-Security-Policy con nonce por solicitud: solo se ejecutan los
 *    scripts emitidos por la propia aplicación (Next aplica el nonce
 *    automáticamente). Cualquier script inyectado queda bloqueado.
 * 2) Panel oculto: /admin y /api/admin responden 404 salvo que el navegador
 *    haya entrado antes por la dirección secreta (ADMIN_PATH), que deja una
 *    cookie firmada. La autorización real (sesión, rol y 2FA) se verifica en
 *    el servidor en cada layout, página y acción.
 * 3) Rutas privadas de clientes: sin cookie de sesión → login.
 */
const GATE_COOKIE = "vx_gate";
const GATE_TTL_S = 30 * 24 * 3600;
const GATE_INTERNAL = "/acceso-equipo";
const NOT_FOUND = "/__no-encontrado";

const isProd = process.env.NODE_ENV === "production";
const adminPath = (process.env.ADMIN_PATH ?? (isProd ? "" : "equipo-dev")).replace(/^\/+|\/+$/g, "");
const secret = process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 32 ? process.env.AUTH_SECRET : isProd ? "" : "dev-only-insecure-secret-change-me-0000000000";

const isAdminArea = (p: string) => /^\/admin(\/|$)/.test(p) || /^\/api\/admin(\/|$)/.test(p);

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`gate:${data}`));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function gateToken() {
  const exp = Math.floor(Date.now() / 1000) + GATE_TTL_S;
  return `${exp}.${await hmac(String(exp))}`;
}

async function gateValid(value: string | undefined) {
  if (!value || !secret) return false;
  const [exp, sig] = value.split(".");
  if (!exp || !sig || Number(exp) < Date.now() / 1000) return false;
  const expected = await hmac(exp);
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

function storageOrigin(): string {
  try {
    return process.env.STORAGE_PUBLIC_URL ? ` ${new URL(process.env.STORAGE_PUBLIC_URL).origin}` : "";
  } catch {
    return "";
  }
}

function buildCsp(nonce: string) {
  const dev = !isProd;
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob:${storageOrigin()}`,
    "font-src 'self' data:",
    `connect-src 'self'${dev ? " ws: wss:" : ""}`,
    "media-src 'self'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "manifest-src 'self'",
    "worker-src 'self' blob:",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

function withSecurity(res: NextResponse, csp: string, privateArea: boolean) {
  res.headers.set("Content-Security-Policy", csp);
  if (privateArea) {
    res.headers.set("Cache-Control", "no-store, max-age=0");
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return res;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp(nonce);
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  // Ruta pedida, para que los layouts puedan responder 404 antes de empezar a transmitir la página.
  requestHeaders.set("x-pathname", pathname);

  // Entrada secreta del equipo: deja la cookie de acceso y muestra el inicio de sesión del panel.
  if (adminPath && secret && pathname === `/${adminPath}`) {
    const url = req.nextUrl.clone();
    url.pathname = GATE_INTERNAL;
    const res = NextResponse.rewrite(url, { request: { headers: requestHeaders } });
    res.cookies.set(GATE_COOKIE, await gateToken(), { httpOnly: true, secure: isProd, sameSite: "lax", path: "/", maxAge: GATE_TTL_S });
    return withSecurity(res, csp, true);
  }

  // La ruta interna nunca se sirve directamente.
  if (pathname === GATE_INTERNAL || pathname.startsWith(`${GATE_INTERNAL}/`)) {
    return withSecurity(NextResponse.rewrite(new URL(NOT_FOUND, req.url), { status: 404 }), csp, false);
  }

  // Panel y su API: sin la cookie de la entrada secreta, no existen.
  if (isAdminArea(pathname)) {
    if (!adminPath || !(await gateValid(req.cookies.get(GATE_COOKIE)?.value))) {
      if (pathname.startsWith("/api/")) return new NextResponse("Not Found", { status: 404 });
      return withSecurity(NextResponse.rewrite(new URL(NOT_FOUND, req.url), { status: 404 }), csp, false);
    }
    if (!pathname.startsWith("/api/") && !req.cookies.has("vx_session")) {
      const url = req.nextUrl.clone();
      url.pathname = `/${adminPath}`;
      url.search = `?next=${encodeURIComponent(pathname + req.nextUrl.search)}`;
      return NextResponse.redirect(url);
    }
    if (pathname.startsWith("/api/")) return NextResponse.next();
    return withSecurity(NextResponse.next({ request: { headers: requestHeaders } }), csp, true);
  }

  // Área privada de clientes.
  const isAccount = /^\/cuenta(\/|$)/.test(pathname);
  if (isAccount && !req.cookies.has("vx_session")) {
    const url = req.nextUrl.clone();
    url.pathname = "/ingresar";
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  return withSecurity(NextResponse.next({ request: { headers: requestHeaders } }), csp, isAccount);
}

export const config = {
  matcher: [
    {
      // Páginas HTML. Se excluyen APIs (webhooks), estáticos e imágenes.
      source: "/((?!api/|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|opengraph-image|demo/|uploads/).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
    // Panel y su API también en precargas (si no, una precarga saltaría la verificación).
    "/admin",
    "/admin/:path*",
    "/api/admin/:path*",
  ],
};
