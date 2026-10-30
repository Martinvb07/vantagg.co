import Link from "next/link";
import { ArrowRight, ArrowUpRight, Headphones, KeyRound, Mail, MessageCircle, RotateCcw, ShieldCheck } from "lucide-react";
import { CoverArt } from "@/components/brand/covers";
import { Logo } from "@/components/brand/logo";
import { PaymentBadges } from "@/components/brand/payment-badges";
import { Container } from "@/components/ui/primitives";
import { parsePaymentMethods } from "@/domain/payment-methods";
import { whatsappLink } from "@/lib/utils";
import type { PublicPaymentOption } from "@/server/integrations/payments";
import type { StoreSettings } from "@/server/settings";
import { BoldLogo } from "@/components/brand/bold-logo";

function InstagramGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

const COLUMNS = [
  {
    title: "Tienda",
    links: [
      { href: "/recargas", label: "Diamantes Free Fire" },
      { href: "/cuentas", label: "Cuentas Free Fire" },
      { href: "/buscar", label: "Buscar" },
      { href: "/carrito", label: "Carrito" },
    ],
  },
  {
    title: "Soporte",
    links: [
      { href: "/pedido", label: "Rastrear pedido" },
      { href: "/ayuda", label: "Centro de ayuda" },
      { href: "/medios-de-pago", label: "Medios de pago" },
      { href: "/ayuda#contacto", label: "Contactar soporte" },
      { href: "/ayuda?tema=reembolso#contacto", label: "Solicitar reembolso" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/legal/terminos", label: "Términos y condiciones" },
      { href: "/legal/privacidad", label: "Privacidad" },
      { href: "/legal/cookies", label: "Cookies" },
      { href: "/legal/reembolsos", label: "Reembolsos" },
      { href: "/legal/productos-digitales", label: "Productos digitales" },
    ],
  },
];

const GUARANTEES = [
  { icon: ShieldCheck, label: "Pago verificado" },
  { icon: RotateCcw, label: "Reembolso si falla" },
  { icon: KeyRound, label: "Sin contraseñas" },
  { icon: Headphones, label: "Soporte real" },
];

export function SiteFooter({ settings, payments, showAccounts = true }: { settings: StoreSettings; payments: PublicPaymentOption[]; showAccounts?: boolean }) {
  const columns = showAccounts ? COLUMNS : COLUMNS.map((c) => ({ ...c, links: c.links.filter((l) => l.href !== "/cuentas") }));
  const real = payments.map((p) => p.name);
  const gateways = real.length ? real : ["Bold"];
  const wa = whatsappLink(settings.whatsapp, `Hola ${settings.storeName}, necesito ayuda.`);
  const methods = parsePaymentMethods(settings.paymentMethods);
  const year = new Date().getFullYear();
  // Datos del vendedor visibles (Estatuto del Consumidor): razón social, NIT y dirección.
  const company = [settings.legalName, settings.taxId && `NIT ${settings.taxId}`, [settings.address, settings.city].filter(Boolean).join(", ")].filter(Boolean).join(" · ");
  const socials = [
    wa && { href: wa, label: "WhatsApp", icon: <MessageCircle className="size-[18px]" />, tint: "hover:bg-green-500/15 hover:text-green-400" },
    settings.instagram && { href: settings.instagram, label: "Instagram", icon: <InstagramGlyph className="size-[18px]" />, tint: "hover:bg-pink-500/15 hover:text-pink-300" },
    settings.supportEmail && { href: `mailto:${settings.supportEmail}`, label: "Correo", icon: <Mail className="size-[18px]" />, tint: "hover:bg-sky-500/15 hover:text-sky-300" },
  ].filter(Boolean) as Array<{ href: string; label: string; icon: React.ReactNode; tint: string }>;

  return (
    <footer className="relative mt-10 overflow-hidden border-t sm:mt-16 border-white/[0.06] bg-ink-950">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-volt-400/40 to-transparent" aria-hidden />
      <div className="pointer-events-none absolute left-1/2 top-0 h-64 w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(200,240,79,0.07),transparent)]" aria-hidden />

      <Container className="relative">
        {/* Llamado a la acción */}
        <div className="relative -mb-2 mt-8 overflow-hidden rounded-[22px] bg-[linear-gradient(115deg,#0e1f0e_0%,#070d08_55%,#030504_100%)] p-6 ring-1 ring-volt-400/20 sm:mt-12 sm:p-8">
          {/* La V de la marca y el brillo lima detrás del cofre */}
          <svg viewBox="0 0 400 240" preserveAspectRatio="xMaxYMid slice" className="pointer-events-none absolute inset-0 size-full" aria-hidden>
            <defs>
              <linearGradient id="cta-v" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#b9f43c" stopOpacity="0.38" />
                <stop offset="1" stopColor="#b9f43c" stopOpacity="0.03" />
              </linearGradient>
              <radialGradient id="cta-glow" cx="0.82" cy="0.5" r="0.45">
                <stop offset="0" stopColor="#b9f43c" stopOpacity="0.22" />
                <stop offset="1" stopColor="#b9f43c" stopOpacity="0" />
              </radialGradient>
            </defs>
            <rect width="400" height="240" fill="url(#cta-glow)" />
            <path d="M262 -6 H296 L330 150 L364 -6 H398 L338 236 H322Z" fill="url(#cta-v)" />
            <g fill="#b9f43c">
              <path d="M384 40 L400 26 V36 L388 46Z" opacity="0.5" />
            </g>
          </svg>
          <CoverArt tier={5} className="pointer-events-none absolute -right-6 -top-4 w-32 opacity-90 sm:right-8 sm:top-1/2 sm:w-52 sm:-translate-y-1/2 sm:opacity-100" />
          <div className="relative max-w-xl">
            <p className="max-w-[70%] text-[26px] font-extrabold italic leading-tight tracking-tight text-white sm:max-w-none sm:text-[34px]">
              ¿LISTO PARA <span className="text-volt-400">RECARGAR?</span>
            </p>
            <p className="mt-1.5 text-[14.5px] font-medium text-white/75">Pon tu ID, elige tu paquete con bonus y paga en pesos.</p>
            <div className="mt-5 grid gap-2.5 sm:flex sm:flex-wrap">
              <Link href="/recargas" className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-volt-400 px-5 text-[14px] font-bold text-ink-950 shadow-[0_0_24px_rgba(200,240,79,0.35)] transition hover:bg-volt-300 sm:h-11">
                Recargar diamantes <ArrowRight className="size-4" />
              </Link>
              {showAccounts ? (
                <Link href="/cuentas" className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white/[0.08] px-5 text-[14px] font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/15 sm:h-11">
                  Ver cuentas
                </Link>
              ) : (
                <Link href="/pedido" className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white/[0.08] px-5 text-[14px] font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/15 sm:h-11">
                  Rastrear pedido
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Cuerpo */}
        <div className="grid gap-10 pb-8 pt-12 sm:gap-12 sm:pb-10 sm:pt-16 lg:grid-cols-[1.15fr_2fr]">
          <div className="max-w-sm">
            <Logo name={settings.storeName} logoUrl={settings.logoUrl || undefined} />
            <p className="mt-4 text-[14px] leading-relaxed text-fg-muted">
              {showAccounts ? "Diamantes y cuentas de Free Fire en Colombia." : "Diamantes de Free Fire en Colombia."} Recarga directa por ID, pagos en pesos y seguimiento de cada pedido.
            </p>
            {socials.length > 0 && (
              <div className="mt-5 flex gap-2">
                {socials.map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    {...(s.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    aria-label={s.label}
                    title={s.label}
                    className={`grid size-10 place-items-center rounded-full bg-white/[0.05] text-fg-muted ring-1 ring-white/[0.08] transition ${s.tint}`}
                  >
                    {s.icon}
                  </a>
                ))}
              </div>
            )}
            {methods.length > 0 && (
              <div className="mt-6">
                <p className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-fg-subtle">Medios de pago</p>
                <PaymentBadges methods={methods} size="sm" />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 sm:gap-8">
            {columns.map((col) => (
              <nav key={col.title} aria-label={col.title}>
                <p className="mb-3 text-[13px] font-bold text-fg sm:mb-4">{col.title}</p>
                <ul className="space-y-2.5 sm:space-y-3">
                  {col.links.map((l) => (
                    <li key={l.href}>
                      <Link href={l.href} className="group inline-flex items-center gap-1 text-[14px] text-fg-muted transition-colors hover:text-fg">
                        {l.label}
                        <ArrowUpRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-60" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        {/* Garantías */}
        <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-[16px] bg-white/[0.06] ring-1 ring-white/[0.06] sm:grid-cols-4">
          {GUARANTEES.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center justify-center gap-2 bg-ink-900 px-2 py-3.5 text-[12.5px] font-semibold sm:gap-2.5 sm:px-3 sm:py-4 sm:text-[13px]">
              <Icon className="size-4 text-volt-300" /> {label}
            </li>
          ))}
        </ul>

        {/* Barra inferior */}
        <div className="flex flex-col gap-3 py-8 text-[12.5px] text-fg-subtle sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {settings.legalName || settings.storeName}
            {company && <span className="block sm:inline"><span className="hidden sm:inline"> · </span>{company}</span>}
            <span className="block">
              ¿Una queja sin resolver? Acude a la{" "}
              <a href="https://www.sic.gov.co" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-fg">
                Superintendencia de Industria y Comercio
              </a>
              .
            </span>
          </p>
          <p className="flex flex-wrap items-center gap-1.5">
            Pagos procesados por
            {gateways.map((g, i) => (
              <span key={g} className="inline-flex items-center">
                {g === "Bold" ? <BoldLogo className="h-[15px] opacity-90" /> : <span className="font-medium text-fg-muted">{g}</span>}
                {i < gateways.length - 1 && ","}
              </span>
            ))}
          </p>
        </div>

        {settings.showGarenaDisclaimer === "true" && (
          <p className="max-w-4xl border-t border-white/[0.05] pb-6 pt-5 text-[11.5px] leading-relaxed text-fg-subtle">
            {settings.storeName} es una tienda independiente y no está afiliada, patrocinada ni respaldada por Garena International ni por sus filiales. Free Fire y sus marcas
            relacionadas pertenecen a sus respectivos titulares y se mencionan únicamente para identificar el juego al que se destinan los productos.
          </p>
        )}
      </Container>

    </footer>
  );
}
