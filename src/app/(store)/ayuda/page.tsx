import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Clock, Headset, Mail, MessageCircle, PackageX, Radar, RotateCcw, ShieldAlert } from "lucide-react";
import { JsonLd } from "@/components/seo/json-ld";
import { Container } from "@/components/ui/primitives";
import { FAQ } from "@/content/faq";
import { whatsappLink } from "@/lib/utils";
import { getSettings } from "@/server/settings";
import { getCurrentUser } from "@/lib/auth";
import { accountsVisible } from "@/server/catalog";
import { HelpArt } from "@/components/brand/spot-art";
import { HelpSearch } from "./help-search";
import { TicketForm } from "./ticket-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Centro de ayuda",
  description: "Respuestas sobre recargas de diamantes, pagos con PSE, Nequi, Botón Bancolombia o tarjeta, entregas, cuentas y reembolsos. Contacta a soporte con tu número de pedido.",
  alternates: { canonical: "/ayuda" },
};

const GUIDES = [
  {
    title: "Recargar diamantes",
    steps: ["Elige el paquete (el bonus ya está incluido).", "Escribe tu ID: verificamos la cuenta y su región.", "Paga con tarjeta, Nequi, PSE o Botón Bancolombia.", "Sigue la entrega en tu página de pedido."],
    href: "/recargas",
    cta: "Ir a recargas",
  },
  {
    title: "Comprar una cuenta",
    steps: ["Revisa nivel, rango, skins e inventario en la ficha.", "Al pagar, la cuenta queda reservada para ti.", "Te entregamos los datos por el chat del pedido.", "Cambia contraseña y correo de recuperación."],
    href: "/cuentas",
    cta: "Ver cuentas",
  },
  {
    title: "Si algo falla",
    steps: ["Busca tu pedido en Seguimiento.", "Si dice «Error de entrega», ya estamos revisándolo.", "Si pagaste y sigue pendiente, espera 30 min (PSE).", "Escríbenos con el número de pedido."],
    href: "/pedido",
    cta: "Rastrear pedido",
  },
];

export default async function HelpPage({ searchParams }: { searchParams: Promise<{ pedido?: string; tema?: string }> }) {
  const [{ pedido, tema }, settings, user, showAccounts] = await Promise.all([searchParams, getSettings(), getCurrentUser().catch(() => null), accountsVisible()]);
  const guides = showAccounts ? GUIDES : GUIDES.filter((g) => g.href !== "/cuentas");
  // Sin venta de cuentas, sus preguntas no aplican.
  const faq = showAccounts ? FAQ : FAQ.filter((f) => f.group !== "cuentas");
  const wa = whatsappLink(settings.whatsapp, `Hola ${settings.storeName}, necesito ayuda${pedido ? ` con mi pedido ${pedido}` : ""}.`);

  const shortcuts = [
    { href: "/pedido", icon: Radar, label: "Rastrear mi pedido", text: "Estado del pago y la entrega.", tint: "text-violet-300 bg-violet-500/15" },
    { href: "/ayuda#pago-pendiente", icon: Clock, label: "Pagué y sigue pendiente", text: "Qué hacer si no se confirma.", tint: "text-warn-400 bg-warn-400/15" },
    { href: "/ayuda#error-de-entrega", icon: PackageX, label: "Error de entrega", text: "Tu pago está seguro.", tint: "text-bad-400 bg-bad-400/15" },
    { href: "/ayuda?tema=reembolso#contacto", icon: RotateCcw, label: "Solicitar reembolso", text: "Por el mismo medio de pago.", tint: "text-sky-300 bg-sky-500/15" },
  ];

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
        }}
      />
      <Container className="py-8 sm:py-10">
        <div className="flex items-end justify-between gap-6">
          <div className="max-w-2xl">
            <h1 className="text-[28px] font-bold tracking-tight sm:text-[34px]">¿En qué te ayudamos?</h1>
            <p className="mt-1.5 text-[15px] text-fg-muted">Busca tu duda o elige un tema. Si no encuentras la respuesta, el equipo de {settings.storeName} te atiende.</p>
          </div>
          <HelpArt className="-mb-2 hidden w-[210px] shrink-0 md:block" />
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-3">
          {shortcuts.map(({ href, icon: Icon, label, text, tint }) => (
            <a key={label} href={href} className="group flex flex-col rounded-[14px] bg-ink-850 p-4 ring-1 ring-white/[0.07] transition hover:bg-ink-800 hover:ring-white/15">
              <span className="flex items-center justify-between">
                <span className={`grid size-9 place-items-center rounded-xl ${tint}`}>
                  <Icon className="size-[18px]" />
                </span>
                <ArrowRight className="size-4 text-fg-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-fg" />
              </span>
              <span className="mt-3 text-[14px] font-semibold leading-snug">{label}</span>
              <span className="mt-0.5 hidden text-[12.5px] leading-snug text-fg-subtle sm:block">{text}</span>
            </a>
          ))}
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
          <section aria-label="Preguntas frecuentes">
            <HelpSearch items={faq} />

            <h2 className="mt-10 text-[15px] font-bold">Guías rápidas</h2>
            <div className={`mt-3 grid divide-y divide-white/[0.06] overflow-hidden rounded-[14px] bg-ink-850 ring-1 ring-white/[0.07] md:divide-x md:divide-y-0 ${guides.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
              {guides.map((g) => (
                <article key={g.title} className="flex flex-col p-4">
                  <h3 className="text-[14px] font-semibold">{g.title}</h3>
                  <ol className="mt-2.5 space-y-1.5">
                    {g.steps.map((st, i) => (
                      <li key={st} className="flex gap-2 text-[12.5px] leading-snug text-fg-muted">
                        <span className="w-3 shrink-0 font-semibold tabular-nums text-fg-subtle">{i + 1}.</span>
                        {st}
                      </li>
                    ))}
                  </ol>
                  <Link href={g.href} className="mt-3 inline-flex items-center gap-1 pt-0.5 text-[12.5px] font-medium text-volt-300 hover:underline">
                    {g.cta} <ArrowRight className="size-3.5" />
                  </Link>
                </article>
              ))}
            </div>
          </section>

          <aside id="contacto" className="scroll-mt-24 lg:self-start">
            <div className="overflow-hidden rounded-[16px] bg-ink-850 ring-1 ring-white/[0.08]">
              <div className="border-b border-white/[0.06] px-5 py-4">
                <h2 className="flex items-center gap-2.5 text-[17px] font-bold">
                  <span className="grid size-8 place-items-center rounded-lg bg-volt-400/12 text-volt-300">
                    <Headset className="size-4" />
                  </span>
                  Habla con soporte
                </h2>
                <p className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-fg-muted">
                  {settings.supportHours ? (
                    <>
                      <Clock className="size-3.5" /> Atención: {settings.supportHours}
                    </>
                  ) : (
                    "Ten a mano tu número de pedido."
                  )}
                </p>
              </div>
              {(wa || settings.supportEmail) && (
                <div className="border-b border-white/[0.06] p-5">
                  <div className="grid gap-2">
                    {wa && (
                      <a href={wa} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-[12px] bg-green-500/10 p-3 ring-1 ring-green-500/25 hover:ring-green-500/50">
                        <MessageCircle className="size-5 text-green-400" />
                        <span className="text-[13.5px]">
                          <span className="block font-semibold">WhatsApp</span>
                          <span className="text-fg-muted">{settings.whatsapp} · la forma más rápida</span>
                        </span>
                        <ArrowRight className="ml-auto size-4 text-fg-subtle" />
                      </a>
                    )}
                    {settings.supportEmail && (
                      <a href={`mailto:${settings.supportEmail}`} className="flex items-center gap-3 rounded-[12px] bg-white/[0.04] p-3 ring-1 ring-white/10 hover:ring-white/20">
                        <Mail className="size-5 text-sky-300" />
                        <span className="min-w-0 text-[13.5px]">
                          <span className="block font-semibold">Correo</span>
                          <span className="block truncate text-fg-muted">{settings.supportEmail}</span>
                        </span>
                      </a>
                    )}
                  </div>
                </div>
              )}
              <div className="p-5">
                <p className="mb-4 text-[13.5px] font-semibold">{wa || settings.supportEmail ? "O déjanos una solicitud" : "Déjanos una solicitud"}</p>
                <TicketForm defaultOrder={pedido} defaultTopic={tema} defaultEmail={user?.email} />
              </div>
            </div>
            <p className="mt-3 flex gap-2 px-1 text-[12px] leading-relaxed text-fg-subtle">
              <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
              Nunca te pediremos contraseñas, códigos SMS ni pagos fuera de la página.
            </p>
          </aside>
        </div>
      </Container>
    </>
  );
}
