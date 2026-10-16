import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Clock, MessagesSquare, Receipt, ShieldCheck, Warehouse } from "lucide-react";
import { Gem } from "@/components/brand/gem";
import { LogoMark } from "@/components/brand/logo";
import { getCurrentUser, isStaff } from "@/lib/auth";
import { safeNext } from "@/lib/safe-next";
import { hasGate } from "@/server/admin-gate";
import { StaffLogin } from "./staff-login";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Acceso", robots: { index: false, follow: false }, referrer: "no-referrer" };

const FEATURES = [
  { icon: Receipt, title: "Pedidos y pagos", text: "Cada pedido con su estado real, desde el pago hasta la entrega." },
  { icon: MessagesSquare, title: "Chats de entrega", text: "Entrega las cuentas por un chat cifrado con el cliente." },
  { icon: Warehouse, title: "Proveedor y precios", text: "Saldo, regiones, costos y márgenes de cada paquete." },
] as const;

/** Inicio de sesión del equipo (contraseña + 2FA). Sin la cookie de la dirección secreta (ADMIN_PATH) responde 404. */
export default async function StaffAccess({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (!(await hasGate())) notFound();
  const raw = safeNext((await searchParams).next, "/admin");
  const next = raw.startsWith("/admin") ? raw : "/admin";
  const user = await getCurrentUser();
  if (user && isStaff(user.role) && user.totpEnabledAt) redirect(next);

  return (
    <main id="contenido" className="min-h-dvh bg-[#0b0d12] lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* Formulario */}
      <section className="relative flex min-h-dvh flex-col px-5 py-6 sm:px-10 lg:px-14 xl:px-20">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(500px_220px_at_30%_0%,rgba(200,240,79,0.09),transparent)] lg:hidden" />
        <header className="relative flex items-center gap-2.5">
          <LogoMark className="size-10" />
          <div className="leading-tight">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/vantagg.png" alt="VANTAGG" width={358} height={57} className="h-[17px] w-auto" />
            <p className="mt-1 text-[11.5px] text-fg-subtle">Panel de control</p>
          </div>
        </header>

        <div className="relative mx-auto flex w-full max-w-[440px] flex-1 flex-col justify-center py-10">
          <StaffLogin next={next} />
        </div>

        <footer className="relative flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-[11.5px] text-fg-subtle">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="size-3.5" /> Acceso restringido · cada ingreso queda registrado
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-3.5" /> La sesión dura 12 horas
          </span>
        </footer>
      </section>

      {/* Marca (solo pantallas grandes) */}
      <aside aria-hidden className="relative hidden overflow-hidden border-l border-white/[0.06] lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(900px_600px_at_80%_10%,rgba(200,240,79,0.16),transparent_60%),radial-gradient(700px_500px_at_10%_100%,rgba(56,140,255,0.22),transparent_60%),linear-gradient(160deg,#10141c,#07090d)]" />
        <div className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgba(255,255,255,0.6)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.6)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(70%_60%_at_60%_40%,black,transparent)]" />
        <Gem hue="volt" className="absolute right-[14%] top-[13%] w-40 rotate-[14deg] drop-shadow-[0_30px_60px_rgba(200,240,79,0.25)] motion-safe:animate-float" />
        <Gem className="absolute right-[42%] top-[30%] w-16 -rotate-12 opacity-80 motion-safe:animate-float [animation-delay:-2s]" />
        <Gem className="absolute right-[8%] top-[44%] w-12 rotate-[28deg] opacity-60 motion-safe:animate-float [animation-delay:-4s]" />

        <div className="relative flex h-full flex-col justify-end p-12 xl:p-16">
          <p className="inline-flex w-fit items-center gap-2 rounded-full bg-white/[0.06] px-3 py-1 text-[12px] font-medium text-volt-300 ring-1 ring-white/10 backdrop-blur">
            <ShieldCheck className="size-3.5" /> Protegido con verificación en dos pasos
          </p>
          <h2 className="mt-5 max-w-[520px] font-display text-[40px] font-bold leading-[1.05] tracking-tight xl:text-[46px]">
            Toda la tienda,
            <br />
            <span className="bg-gradient-to-r from-volt-300 to-sky-300 bg-clip-text text-transparent">en un solo lugar.</span>
          </h2>
          <ul className="mt-8 grid max-w-[560px] gap-3">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex items-start gap-3.5 rounded-[14px] bg-white/[0.04] p-4 ring-1 ring-white/[0.07] backdrop-blur-sm">
                <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-volt-400/10 text-volt-300 ring-1 ring-volt-400/20">
                  <Icon className="size-[18px]" />
                </span>
                <span>
                  <span className="block text-[14px] font-semibold">{title}</span>
                  <span className="mt-0.5 block text-[13px] leading-relaxed text-fg-muted">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </main>
  );
}
