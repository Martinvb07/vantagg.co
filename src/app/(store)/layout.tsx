import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { MessageCircle, Wrench } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { getCurrentUser, isStaff } from "@/lib/auth";
import { whatsappLink } from "@/lib/utils";
import { getSettings } from "@/server/settings";
import { publicPaymentOptions } from "@/server/integrations/payments";
import { accountsVisible } from "@/server/catalog";
import { CookieNotice } from "@/components/legal/cookie-notice";
import { HalloweenDecor } from "@/components/store/halloween";
import { isHalloween } from "@/domain/season";
import { maintenanceNotice } from "@/domain/maintenance";
import { googleTagConfig } from "@/domain/google-tag";
import { GoogleTag } from "@/components/analytics/google-tag";
import { MetaPixel } from "@/components/analytics/meta-pixel";
import { parseMetaPixelId } from "@/domain/meta-pixel";
import { MarketProvider } from "@/components/store/market";
import { getMarket } from "@/server/market";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [settings, user, showAccounts, market] = await Promise.all([getSettings(), getCurrentUser().catch(() => null), accountsVisible(), getMarket()]);
  // Sección de cuentas oculta: 404 real (aquí, antes de la pantalla de carga, para que no sea un 404 «blando» con estado 200).
  if (!showAccounts && /^\/cuentas(\/|$)/.test((await headers()).get("x-pathname") ?? "")) notFound();
  const payments = publicPaymentOptions();
  const wa = whatsappLink(settings.whatsapp, `Hola ${settings.storeName}, tengo una pregunta.`);
  // Temporada: la decoración va encima del diseño de siempre y se apaga sola al terminar.
  const halloween = isHalloween();
  const paused = maintenanceNotice(settings);
  // Etiqueta de Google (campañas): solo si se configuró en Panel → Ajustes → Publicidad.
  const gtag = googleTagConfig(settings);
  const metaPixel = parseMetaPixelId(settings.metaPixelId);

  return (
    <MarketProvider market={market}>
      <div data-season={halloween ? "halloween" : undefined}>
        {metaPixel && <MetaPixel id={metaPixel} />}
        {gtag && <GoogleTag cfg={gtag} />}
        {paused && (
          <div role="status" data-maintenance className="flex items-center justify-center gap-2 border-b border-warn-400/25 bg-warn-400/[0.08] px-4 py-2.5 text-center text-[13px] font-medium text-fg">
            <Wrench aria-hidden className="size-4 shrink-0 text-warn-400" />
            <span>{paused}</span>
          </div>
        )}
        {settings.announcement && (
          <div className="border-b border-white/[0.06] bg-ink-850 px-4 py-2 text-center text-[13px] text-fg-muted">{settings.announcement}</div>
        )}
        <SiteHeader
          storeName={settings.storeName}
          logoUrl={settings.logoUrl || undefined}
          showAccounts={showAccounts}
          user={user ? { name: user.name, email: user.email, staff: isStaff(user.role), avatarUrl: user.avatarUrl, avatarPreset: user.avatarPreset } : null}
        />
        <main id="contenido" className={halloween ? "relative" : undefined}>
          {halloween && <HalloweenDecor />}
          {children}
        </main>
        <SiteFooter settings={settings} payments={payments} showAccounts={showAccounts} />
        <CookieNotice ads={[...(metaPixel ? ["Meta (Facebook e Instagram)"] : []), ...(gtag ? ["Google"] : [])]} />
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
      </div>
    </MarketProvider>
  );
}
