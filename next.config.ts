import { createHash } from "node:crypto";
import type { NextConfig } from "next";

// Clave de las Server Actions estable entre deploys. Next la usa como «sal» de los identificadores de
// cada formulario; si cambia en cada build (por defecto es aleatoria), un formulario abierto antes de
// un deploy deja de funcionar («Failed to find Server Action»). Se deriva de AUTH_SECRET (ya fijo).
if (!process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY && process.env.AUTH_SECRET) {
  process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY = createHash("sha256").update(`server-actions:${process.env.AUTH_SECRET}`).digest("base64");
}

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  { key: "Origin-Agent-Cluster", value: "?1" },
];

const storageHost = (() => {
  try {
    return process.env.STORAGE_PUBLIC_URL ? new URL(process.env.STORAGE_PUBLIC_URL).hostname : null;
  } catch {
    return null;
  }
})();

const nextConfig: NextConfig = {
  // Permite compilar una copia de producción aparte (NEXT_DIST_DIR=.next-prod) sin pisar la del modo desarrollo.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Imagen de producción (Dockerfile): servidor autónomo con solo lo necesario (NEXT_OUTPUT=standalone).
  ...(process.env.NEXT_OUTPUT === "standalone" ? { output: "standalone" as const } : {}),
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
    // Las imágenes SVG se muestran sin pasar por el optimizador (unoptimized): el optimizador no acepta SVG.
    dangerouslyAllowSVG: false,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: storageHost ? [{ protocol: "https", hostname: storageHost }] : [],
  },
  experimental: {
    // Fotos de cuentas: el panel las comprime antes de subir; nginx de la tienda acepta 8 MB por envío.
    serverActions: { bodySizeLimit: "8mb" },
  },
  async redirects() {
    return [{ source: "/ofertas", destination: "/recargas", permanent: false }];
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Logos de la marca: los correos los cargan desde la bandeja del cliente (otro origen).
      { source: "/brand/:path*", headers: [{ key: "Cross-Origin-Resource-Policy", value: "cross-origin" }] },
    ];
  },
};

export default nextConfig;
