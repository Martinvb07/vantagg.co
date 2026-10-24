import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { getCurrentUser, isStaff } from "@/lib/auth";
import { whatsappLink } from "@/lib/utils";
import { getSettings } from "@/server/settings";
import { publicPaymentOptions } from "@/server/integrations/payments";
import { accountsVisible } from "@/server/catalog";
import { CookieNotice } from "@/components/legal/cookie-notice";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [settings, user, showAccounts] = await Promise.all([getSettings(), getCurrentUser().catch(() => null), accountsVisible()]);
  // Sección de cuentas oculta: 404 real (aquí, antes de la pantalla de carga, para que no sea un 404 «blando» con estado 200).
  if (!showAccounts && /^\/cuentas(\/|$)/.test((await headers()).get("x-pathname") ?? "")) notFound();
  const payments = publicPaymentOptions();
  const wa = whatsappLink(settings.whatsapp, `Hola ${settings.storeName}, tengo una pregunta.`);

  return (
    <>
      {settings.announcement && (
        <div className="border-b border-white/[0.06] bg-ink-850 px-4 py-2 text-center text-[13px] text-fg-muted">{settings.announcement}</div>
      )}
      <SiteHeader
        storeName={settings.storeName}
        logoUrl={settings.logoUrl || undefined}
        showAccounts={showAccounts}
        user={user ? { name: user.name, email: user.email, staff: isStaff(user.role), avatarUrl: user.avatarUrl, avatarPreset: user.avatarPreset } : null}
      />
      <main id="contenido">{children}</main>
      <SiteFooter settings={settings} payments={payments} showAccounts={showAccounts} />
      <CookieNotice />
      {wa && (
        <aside aria-label="Contacto por WhatsApp">
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Escribir por WhatsApp"
            title={`WhatsApp ${settings.whatsapp}`}
            className="wa-float fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-4 sm:right-5 z-30 grid size-12 place-items-center rounded-full border border-white/10 bg-ink-800 text-ok-400 shadow-[var(--shadow-lift)] transition-[transform,bottom] hover:scale-105"
          >
            <MessageCircle className="size-5" />
          </a>
        </aside>
      )}
    </>
  );
}
