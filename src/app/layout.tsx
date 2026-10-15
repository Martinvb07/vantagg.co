import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Sora } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import { Suspense } from "react";
import { CartProvider } from "@/components/cart/cart-context";
import { NavProgress } from "@/components/layout/nav-progress";
import { getSettings } from "@/server/settings";
import { accountsVisible } from "@/server/catalog";
import { env } from "@/lib/env";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const sora = Sora({ subsets: ["latin"], variable: "--font-sora", display: "swap", weight: ["400", "500", "600", "700"] });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono-face", display: "swap", weight: ["400", "500", "600"] });

export async function generateMetadata(): Promise<Metadata> {
  const [s, withAccounts] = await Promise.all([getSettings(), accountsVisible()]);
  const title = withAccounts ? `${s.storeName} · Recargas de diamantes y cuentas Free Fire en Colombia` : `${s.storeName} · Recargas de diamantes Free Fire en Colombia`;
  const description = withAccounts
    ? "Recarga diamantes de Free Fire con tu ID de jugador y paga en pesos colombianos con PSE, Nequi, Botón Bancolombia o tarjeta. Cuentas con rango, nivel y skins a la vista y seguimiento de cada pedido."
    : "Recarga diamantes de Free Fire con tu ID de jugador y paga en pesos colombianos con PSE, Nequi, Botón Bancolombia o tarjeta. Bonus en todos los paquetes y seguimiento de cada pedido.";
  return {
    metadataBase: new URL(env.appUrl),
    title: { default: title, template: `%s · ${s.storeName}` },
    description,
    applicationName: s.storeName,
    openGraph: { type: "website", locale: "es_CO", siteName: s.storeName, title, description, url: "/" },
    twitter: { card: "summary_large_image", title, description },
    robots: { index: true, follow: true },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  themeColor: "#0f1116",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

/**
 * Algunas extensiones del navegador (p. ej. Bitdefender: bis_skin_checked) marcan cada <div> antes de que React
 * hidrate y React avisa que el HTML no coincide. Este script quita esas marcas hasta que termina la hidratación;
 * a quien no tiene la extensión no le hace nada.
 */
const EXTENSION_ATTRS = ["bis_skin_checked", "bis_register", "bis_size", "bis_id", "bis_use", "bis_status", "bis_label", "bis_frame_id"];
const STRIP_EXTENSION_ATTRS = `(function(){var A=${JSON.stringify(EXTENSION_ATTRS)},S=A.map(function(a){return"["+a+"]"}).join(",");
function sweep(){document.querySelectorAll(S).forEach(function(e){A.forEach(function(a){e.removeAttribute(a)})})}
var o=new MutationObserver(function(ms){ms.forEach(function(m){var t=m.target;if(t.hasAttribute&&t.hasAttribute(m.attributeName))t.removeAttribute(m.attributeName)})});
o.observe(document.documentElement,{attributes:true,attributeFilter:A,subtree:true});
document.addEventListener("DOMContentLoaded",sweep);
addEventListener("load",function(){sweep();setTimeout(function(){o.disconnect()},10000)})})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    // suppressHydrationWarning: extensiones como Grammarly o ColorZilla agregan atributos a <html>/<body>.
    <html lang="es-CO" className={`${inter.variable} ${sora.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: STRIP_EXTENSION_ATTRS }} />
      </head>
      <body className="min-h-dvh" suppressHydrationWarning>
        <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-volt-400 focus:px-3 focus:py-2 focus:text-volt-ink">
          Saltar al contenido
        </a>
        <Suspense fallback={null}>
          <NavProgress />
        </Suspense>
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
