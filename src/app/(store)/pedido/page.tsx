import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Clock, Inbox, PackageX, UserRound } from "lucide-react";
import { Container } from "@/components/ui/primitives";
import { StatusGuide } from "@/components/orders/status-guide";
import { RouteArt } from "@/components/brand/spot-art";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/server/settings";
import { TrackForm } from "./track-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Rastrear pedido",
  description: "Consulta el estado del pago y la entrega de tu pedido con el número de pedido y el correo de la compra.",
  alternates: { canonical: "/pedido" },
};

export default async function TrackPage() {
  const [settings, user] = await Promise.all([getSettings(), getCurrentUser()]);
  const prefix = settings.orderPrefix || "VX";

  return (
    <Container className="py-8 sm:py-10">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-10">
        <section>
          <div className="flex items-end justify-between gap-6">
            <div>
              <h1 className="text-[28px] font-bold tracking-tight sm:text-[34px]">Rastrear pedido</h1>
              <p className="mt-1.5 text-[15px] text-fg-muted">Mira en qué va tu pago y tu entrega. No necesitas cuenta.</p>
            </div>
            <RouteArt className="mb-1 hidden w-[300px] shrink-0 md:block" />
          </div>

          {/* Formulario con forma de ticket */}
          <div className="relative mt-6 rounded-[18px] bg-ink-850 p-5 ring-1 ring-white/[0.08] sm:p-7">
            <div className="mb-5 flex items-center justify-between gap-4">
              <p className="font-mono text-[11.5px] font-semibold uppercase tracking-[0.18em] text-fg-subtle">Ticket de pedido · {settings.storeName}</p>
              <span className="hidden h-6 shrink-0 items-stretch gap-[2px] opacity-30 sm:flex" aria-hidden>
                {[2, 1, 3, 1, 1, 2, 1, 3, 2, 1, 1, 2, 3, 1, 2, 1, 1, 3, 1, 2].map((w, i) => (
                  <span key={i} className="bg-white" style={{ width: w }} />
                ))}
              </span>
            </div>
            <TrackForm prefix={prefix} />
          </div>

          <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
            <div className="flex gap-3 rounded-[14px] bg-ink-850 p-4 ring-1 ring-white/[0.06]">
              <Inbox className="mt-0.5 size-5 shrink-0 text-sky-300" />
              <p className="text-[13px] leading-relaxed text-fg-muted">
                <span className="block font-semibold text-fg">¿No tienes el número?</span>
                Está en el correo de confirmación (revisa spam y promociones) y en la pantalla final de la compra.
              </p>
            </div>
            {user ? (
              <Link href="/cuenta" className="flex gap-3 rounded-[14px] bg-ink-850 p-4 ring-1 ring-white/[0.06] hover:ring-white/15">
                <UserRound className="mt-0.5 size-5 shrink-0 text-volt-300" />
                <p className="text-[13px] leading-relaxed text-fg-muted">
                  <span className="block font-semibold text-fg">Ver mis pedidos</span>
                  Todas tus compras con la sesión iniciada están en Mi cuenta.
                </p>
              </Link>
            ) : (
              <Link href="/ayuda?tema=pedido#contacto" className="flex gap-3 rounded-[14px] bg-ink-850 p-4 ring-1 ring-white/[0.06] hover:ring-white/15">
                <PackageX className="mt-0.5 size-5 shrink-0 text-warn-400" />
                <p className="text-[13px] leading-relaxed text-fg-muted">
                  <span className="block font-semibold text-fg">¿Perdiste el correo?</span>
                  Escríbenos con el correo y la fecha de compra y te ayudamos a encontrarlo.
                </p>
              </Link>
            )}
          </div>
        </section>

        <aside className="lg:pt-[100px]">
          <StatusGuide />
          <Link href="/ayuda#pago-pendiente" className="mt-3 flex items-center gap-2 px-1 text-[13px] font-medium text-fg-muted hover:text-fg">
            <Clock className="size-4" /> Pagué y sigue pendiente <ArrowRight className="ml-auto size-4" />
          </Link>
        </aside>
      </div>
    </Container>
  );
}
