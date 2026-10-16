/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, CalendarDays, Crown, Gem, Headset, Heart, IdCard, KeyRound, Lock, LogOut, Mail, MailCheck, MessageCircle, MessagesSquare, MonitorSmartphone, Package, Pencil, Receipt, RotateCw, ShieldAlert, ShieldCheck, Sparkles, Trophy, UserRound, Wallet, Zap } from "lucide-react";
import { RankEmblem } from "@/components/brand/rank-emblem";
import { ACHIEVEMENTS, customerRank, profileTheme } from "@/domain/player";
import { DiamondCover, tierFor } from "@/components/brand/covers";
import { UserAvatar } from "@/components/account/user-avatar";
import { AccountPlaceholder } from "@/components/brand/illustrations";
import { LinkButton } from "@/components/ui/button";
import { Badge, Container, DemoBadge, EmptyState } from "@/components/ui/primitives";
import { OrderStatusBadge } from "@/components/ui/status";
import { REVENUE_STATUSES, type OrderStatusValue } from "@/domain/order-status";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatMoney, formatNumber } from "@/lib/money";
import { cn, whatsappLink } from "@/lib/utils";
import { TICKET_STATUS, ticketRef, topicLabel } from "@/domain/support";
import { getSettings } from "@/server/settings";
import { awaitingCustomer, listUserTickets } from "@/server/support";
import { logoutAction } from "@/app/actions/auth";
import { logoutEverywhereAction } from "@/app/actions/profile";
import { AvatarPicker } from "./avatar-picker";
import { CopyChip, ThemePicker } from "./theme-picker";
import { PasswordForm } from "./password-form";
import { ProfileForm } from "./profile-form";
import { NewTicketForm, ResolveTicketButton, TicketReplyForm } from "./support-forms";
import { VerifyEmail } from "./verify-email";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mi cuenta", robots: { index: false, follow: false } };

const TABS = [
  { k: "pedidos", l: "Mis pedidos", icon: Receipt },
  { k: "perfil", l: "Perfil", icon: Pencil },
  { k: "seguridad", l: "Seguridad", icon: ShieldCheck },
  { k: "soporte", l: "Soporte", icon: Headset },
] as const;
type Tab = (typeof TABS)[number]["k"];

const TAB_INFO: Record<Tab, { title: string; sub: string }> = {
  pedidos: { title: "Mis pedidos", sub: "Cada compra con su estado en tiempo real." },
  perfil: { title: "Perfil", sub: "Tu avatar, portada y datos para recargar más rápido." },
  seguridad: { title: "Seguridad", sub: "Cómo ingresas y dónde tienes la sesión abierta." },
  soporte: { title: "Soporte", sub: "Tus solicitudes y las respuestas del equipo." },
};

const ACH_ICONS = { sparkles: Sparkles, mail: MailCheck, gem: Gem, gems: Trophy, user: UserRound, heart: Heart, crown: Crown, id: IdCard } as const;

const FILTERS = { todos: "Todos", curso: "En curso", entregados: "Entregados" } as const;
const IN_PROGRESS: OrderStatusValue[] = ["PENDING_PAYMENT", "PAID", "PROCESSING", "DELIVERY_FAILED", "REFUND_REQUESTED"];

export default async function AccountHome({ searchParams }: { searchParams: Promise<{ seccion?: string; filtro?: string }> }) {
  const user = await requireUser("/cuenta");
  const sp = await searchParams;
  const tab: Tab = TABS.some((t) => t.k === sp.seccion) ? (sp.seccion as Tab) : "pedidos";
  const filter = (sp.filtro && sp.filtro in FILTERS ? sp.filtro : "todos") as keyof typeof FILTERS;

  const [account, orders, sessions, tickets, settings] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { name: true, email: true, createdAt: true, emailVerifiedAt: true, hasPassword: true, googleSub: true, avatarUrl: true, avatarPreset: true, phone: true, ffPlayerId: true, profileTheme: true },
    }),
    db.order.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { delivery: { select: { simulated: true } }, package: { select: { slug: true } }, account: { select: { images: { take: 1, orderBy: { sortOrder: "asc" }, select: { url: true } } } } },
    }),
    db.session.count({ where: { userId: user.id, expiresAt: { gt: new Date() } } }),
    db.user.findUniqueOrThrow({ where: { id: user.id }, select: { id: true, email: true, emailVerifiedAt: true } }).then(listUserTickets),
    getSettings(),
  ]);

  const sold = orders.filter((o) => (REVENUE_STATUSES as readonly OrderStatusValue[]).includes(o.status));
  const spent = sold.reduce((n, o) => n + o.total, 0);
  const diamonds = orders
    .filter((o) => o.type === "TOPUP" && o.status === "DELIVERED")
    .reduce((n, o) => {
      const s = o.itemSnapshot as { diamonds?: number; bonusDiamonds?: number };
      return n + (s.diamonds ?? 0) + (s.bonusDiamonds ?? 0);
    }, 0);
  const inProgress = orders.filter((o) => IN_PROGRESS.includes(o.status)).length;
  const unread = orders.reduce((n, o) => n + o.chatUnreadCustomer, 0);
  const shown = orders.filter((o) => (filter === "curso" ? IN_PROGRESS.includes(o.status) : filter === "entregados" ? o.status === "DELIVERED" : true));
  const displayName = account.name && account.name !== "No Name" ? account.name : account.email.split("@")[0];
  const memberSince = new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric" }).format(account.createdAt);
  const href = (t: Tab, extra = "") => `/cuenta?seccion=${t}${extra}`;
  const rank = customerRank(spent);
  const theme = profileTheme(account.profileTheme);
  const achievements = ACHIEVEMENTS.map((a) => ({
    ...a,
    done: a.test({
      verified: !!account.emailVerifiedAt,
      deliveredTopups: orders.filter((o) => o.type === "TOPUP" && o.status === "DELIVERED").length,
      diamonds,
      accountsBought: sold.filter((o) => o.type === "ACCOUNT").length,
      purchases: sold.length,
      biggestOrder: Math.max(0, ...sold.map((o) => o.total)),
      profileComplete: !!(account.avatarUrl || account.avatarPreset) && !!account.ffPlayerId && !!account.phone,
    }),
  }));
  const unlocked = achievements.filter((a) => a.done).length;
  const answered = tickets.filter(awaitingCustomer).length;
  const wa = whatsappLink(settings.whatsapp, `Hola ${settings.storeName}, escribo desde mi cuenta (${account.email}). Tengo una duda: `);
  const orderOptions = orders.slice(0, 30).map((o) => ({ id: o.id, label: `${o.number} · ${(o.itemSnapshot as { name?: string }).name ?? "Pedido"}` }));
  const stats = [
    { icon: Package, l: "Compras", v: formatNumber(sold.length), c: "text-sky-300" },
    { icon: Wallet, l: "Invertido", v: formatMoney(spent), c: "text-volt-300" },
    { icon: Gem, l: "Diamantes recibidos", v: formatNumber(diamonds), c: "text-violet-300" },
    { icon: RotateCw, l: "En curso", v: formatNumber(inProgress), c: "text-warn-400" },
  ];

  const navItems = TABS.map((t) => ({ ...t, badge: t.k === "pedidos" ? unread : t.k === "soporte" ? answered : 0 }));
  const heading = TAB_INFO[tab];

  return (
    <Container className="py-6 sm:py-10">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-7 xl:grid-cols-[320px_minmax(0,1fr)]">
        {/* Columna lateral (en celular sus tarjetas se acomodan: perfil arriba, progreso al final) */}
        <aside className="contents lg:col-start-1 lg:row-start-1 lg:flex lg:flex-col lg:gap-5 lg:self-start">
          {/* Perfil */}
          <section className="overflow-hidden rounded-[22px] bg-ink-850 ring-1 ring-white/[0.08]" aria-labelledby="t-perfil">
            <div className="relative h-24" style={{ background: theme.bg }}>
              <div className="absolute inset-0 opacity-[0.12] [background-image:repeating-linear-gradient(115deg,rgba(255,255,255,.5)_0_1px,transparent_1px_14px)] [mask-image:linear-gradient(90deg,transparent,black_70%)]" aria-hidden />
              <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-ink-850 to-transparent" aria-hidden />
              <Link href={href("perfil")} className="absolute right-3 top-3 inline-flex h-8 items-center gap-1.5 rounded-full bg-black/35 px-3 text-[12px] font-medium text-white ring-1 ring-white/15 backdrop-blur transition hover:bg-black/50">
                <Pencil className="size-3.5" /> Editar
              </Link>
            </div>

            <div className="-mt-12 flex flex-col items-center px-5 pb-5 text-center">
              <Link href={href("perfil", "#avatar")} className="group relative shrink-0 rounded-full" aria-label="Cambiar avatar">
                <UserAvatar user={account} size={88} ring={false} className="ring-4 ring-ink-850" />
                <span className="absolute inset-0 grid place-items-center rounded-full bg-black/45 text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden>
                  <Pencil className="size-5" />
                </span>
              </Link>
              <h1 id="t-perfil" className="mt-3 max-w-full truncate font-display text-[20px] font-bold leading-tight">
                {displayName}
              </h1>
              <p className="mt-1 flex max-w-full items-center gap-1.5 text-[12.5px] text-fg-muted">
                <span className="truncate">{account.email}</span>
                {account.emailVerifiedAt ? (
                  <BadgeCheck className="size-4 shrink-0 text-ok-400" aria-label="Correo verificado" />
                ) : (
                  <span className="shrink-0 rounded-full bg-warn-400/12 px-2 py-0.5 text-[11px] font-medium text-warn-400">Sin verificar</span>
                )}
              </p>

              <ul className="mt-3.5 flex flex-wrap justify-center gap-1.5 text-[12px]" aria-label="Datos de la cuenta">
                <li className="inline-flex h-7 items-center gap-1.5 rounded-full bg-white/[0.05] pl-1 pr-2.5 ring-1 ring-white/10">
                  <RankEmblem rank={rank.current.id} className="size-5" />
                  <span className="font-semibold" style={{ color: rank.current.color }}>
                    {rank.current.label}
                  </span>
                </li>
                <li className="inline-flex h-7 items-center gap-1.5 rounded-full bg-white/[0.05] px-2.5 text-fg-muted ring-1 ring-white/10">
                  <CalendarDays className="size-3.5" /> Desde {memberSince}
                </li>
              </ul>

              {/* ID de Free Fire */}
              <div className="mt-4 flex w-full items-center gap-3 rounded-[14px] bg-ink-900/70 p-3 text-left ring-1 ring-white/[0.06]">
                <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-volt-400/10 text-volt-300 ring-1 ring-volt-400/20">
                  <IdCard className="size-[18px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11.5px] text-fg-subtle">ID de Free Fire</span>
                  {account.ffPlayerId ? (
                    <span className="block truncate font-mono text-[14px] font-semibold tracking-wider">{account.ffPlayerId}</span>
                  ) : (
                    <span className="block text-[13px] text-fg-muted">Sin guardar</span>
                  )}
                </span>
                {account.ffPlayerId ? (
                  <CopyChip value={account.ffPlayerId} label="ID" tone="plain" compact />
                ) : (
                  <Link href={href("perfil")} className="shrink-0 rounded-full bg-white/[0.06] px-3 py-1.5 text-[12px] font-semibold ring-1 ring-white/10 hover:bg-white/[0.1]">
                    Guardar
                  </Link>
                )}
              </div>

              <Link
                href={account.ffPlayerId ? `/recargas?id=${account.ffPlayerId}` : "/recargas"}
                className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-volt-400 text-[14px] font-bold text-volt-ink shadow-[0_1px_0_0_rgb(255_255_255/0.35)_inset,0_8px_24px_-10px_rgb(200_240_79/0.6)] transition hover:bg-volt-300"
              >
                <Zap className="size-4" /> {account.ffPlayerId ? "Recargar a mi ID" : "Recargar diamantes"}
              </Link>
            </div>

            {/* Menú (escritorio) */}
            <nav className="hidden border-t border-white/[0.06] p-2 lg:block" aria-label="Secciones de la cuenta">
              {navItems.map(({ k, l, icon: Icon, badge }) => (
                <Link
                  key={k}
                  href={href(k)}
                  aria-current={tab === k ? "page" : undefined}
                  className={cn("flex h-11 items-center gap-3 rounded-[12px] px-3 text-[14px] font-medium transition-colors", tab === k ? "bg-white/[0.07] text-fg" : "text-fg-muted hover:bg-white/[0.04] hover:text-fg")}
                >
                  <Icon className={cn("size-[18px]", tab === k ? "text-volt-300" : "text-fg-subtle")} />
                  {l}
                  {badge > 0 && <span className="ml-auto rounded-full bg-volt-400 px-1.5 text-[11px] font-bold text-volt-ink">{badge}</span>}
                </Link>
              ))}
              <form action={logoutAction}>
                <button type="submit" className="flex h-11 w-full items-center gap-3 rounded-[12px] px-3 text-[14px] font-medium text-fg-muted transition-colors hover:bg-bad-400/10 hover:text-bad-400">
                  <LogOut className="size-[18px]" /> Cerrar sesión
                </button>
              </form>
            </nav>
          </section>

          {/* Progreso: rango y logros */}
          <section className="order-last rounded-[22px] bg-ink-850 p-5 ring-1 ring-white/[0.08] lg:order-none" aria-labelledby="t-rango">
            <div className="flex items-center gap-3.5">
              <RankEmblem rank={rank.current.id} className="size-12 shrink-0 drop-shadow-[0_8px_20px_rgba(0,0,0,0.5)]" />
              <div className="min-w-0 flex-1">
                <p id="t-rango" className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">
                  Rango de cliente
                </p>
                <p className="font-display text-[19px] font-bold leading-tight" style={{ color: rank.current.color }}>
                  {rank.current.label}
                </p>
              </div>
              {rank.next && <RankEmblem rank={rank.next.id} className="size-8 shrink-0 opacity-40 grayscale" />}
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.07]" role="progressbar" aria-valuenow={Math.round(rank.progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Progreso al siguiente rango">
              <div className="h-full rounded-full" style={{ width: `${Math.max(3, rank.progress * 100)}%`, background: `linear-gradient(90deg, ${rank.current.color}, ${rank.next?.color ?? rank.current.color})` }} />
            </div>
            <p className="mt-2.5 text-[12.5px] text-fg-muted">
              {rank.next ? (
                <>
                  Te faltan <strong className="text-fg">{formatMoney(rank.missing)}</strong> para <strong style={{ color: rank.next.color }}>{rank.next.label}</strong>.
                </>
              ) : (
                "Llegaste al rango más alto."
              )}
            </p>

            <div className="mt-5 border-t border-white/[0.06] pt-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[14px] font-bold">Logros</h2>
                <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[11.5px] font-medium tabular-nums text-fg-muted">
                  {unlocked}/{ACHIEVEMENTS.length}
                </span>
              </div>
              <ul className="grid grid-cols-4 gap-x-2 gap-y-3 sm:grid-cols-8 lg:grid-cols-4">
                {achievements.map((a) => {
                  const Icon = ACH_ICONS[a.icon];
                  return (
                    <li key={a.key} title={`${a.label}: ${a.hint}`} className="flex flex-col items-center gap-1.5 text-center">
                      <span className={cn("grid size-11 place-items-center rounded-2xl ring-1 transition", a.done ? "bg-[linear-gradient(135deg,rgba(200,240,79,0.25),rgba(56,140,255,0.2))] text-volt-300 ring-volt-400/30" : "bg-white/[0.03] text-fg-subtle/50 ring-white/[0.06]")}>
                        {a.done ? <Icon className="size-5" /> : <Lock className="size-4" />}
                      </span>
                      <span className={cn("text-[10.5px] font-medium leading-tight", a.done ? "text-fg" : "text-fg-subtle")}>{a.label}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        </aside>

        {/* Contenido */}
        <div className="min-w-0 lg:col-start-2 lg:row-start-1">
          {!account.emailVerifiedAt && <div className="mb-5 [&>section]:mt-0"><VerifyEmail email={account.email} /></div>}

          {/* Estadísticas: dt antes que dd (lectores de pantalla); el valor se ve arriba con flex-col-reverse. */}
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map(({ icon: Icon, l, v, c }) => (
              <div key={l} className="flex min-w-0 flex-col-reverse gap-2.5 rounded-[18px] bg-ink-850 p-4 ring-1 ring-white/[0.07]">
                <dt className="text-[12px] text-fg-subtle">{l}</dt>
                <dd className="flex min-w-0 items-center gap-2.5">
                  <span className={cn("grid size-9 shrink-0 place-items-center rounded-[10px] bg-white/[0.05]", c)} aria-hidden>
                    <Icon className="size-[18px]" />
                  </span>
                  <span className="truncate font-display text-[20px] font-bold leading-tight tabular-nums">{v}</span>
                </dd>
              </div>
            ))}
          </dl>

          {/* Menú (celular y tablet) */}
          <nav className="-mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 lg:hidden" aria-label="Secciones de la cuenta">
            {navItems.map(({ k, l, icon: Icon, badge }) => (
              <Link
                key={k}
                href={href(k)}
                aria-current={tab === k ? "page" : undefined}
                className={cn("inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-[13.5px] font-semibold ring-1 transition-colors", tab === k ? "bg-fg text-ink-950 ring-fg" : "bg-ink-850 text-fg-muted ring-white/[0.08] hover:text-fg")}
              >
                <Icon className="size-4" /> {l}
                {badge > 0 && <span className="rounded-full bg-volt-400 px-1.5 text-[11px] font-bold text-volt-ink">{badge}</span>}
              </Link>
            ))}
            <form action={logoutAction} className="shrink-0">
              <button type="submit" className="inline-flex h-10 items-center gap-2 rounded-full bg-ink-850 px-4 text-[13.5px] font-semibold text-fg-muted ring-1 ring-white/[0.08] hover:text-bad-400">
                <LogOut className="size-4" /> Salir
              </button>
            </form>
          </nav>

          <div className="mt-6 sm:mt-7">
            <h2 className="font-display text-[20px] font-bold leading-tight sm:text-[22px]">{heading.title}</h2>
            <p className="mt-1 text-[13px] text-fg-muted">{heading.sub}</p>
          </div>

      {tab === "pedidos" && (
        <section className="mt-4" aria-label="Mis pedidos">
          <div className="mb-4 flex flex-wrap gap-1.5">
            {(Object.keys(FILTERS) as Array<keyof typeof FILTERS>).map((f) => (
              <Link key={f} href={href("pedidos", f === "todos" ? "" : `&filtro=${f}`)} className={cn("rounded-full px-3.5 py-1.5 text-[13px] font-medium", filter === f ? "bg-fg text-ink-950" : "bg-white/[0.06] text-fg-muted hover:text-fg")}>
                {FILTERS[f]}
              </Link>
            ))}
          </div>
          {shown.length === 0 ? (
            <EmptyState
              icon={<Receipt className="size-5" />}
              title={orders.length ? "No hay pedidos en este filtro" : "Aún no tienes compras"}
              description={orders.length ? "Prueba con otro filtro." : "Tus pedidos aparecerán aquí con su estado en tiempo real."}
              action={<LinkButton href="/recargas">Recargar diamantes</LinkButton>}
            />
          ) : (
            <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {shown.map((o) => {
                const item = o.itemSnapshot as { name: string; diamonds?: number; bonusDiamonds?: number };
                const link = `/pedido/${o.number}?t=${o.trackingToken}`;
                const image = o.account?.images[0]?.url;
                return (
                  <li key={o.id} className="flex gap-3.5 rounded-[16px] bg-ink-850 p-3.5 ring-1 ring-white/[0.07] transition hover:ring-white/15">
                    <Link href={link} className="relative size-[76px] shrink-0 overflow-hidden rounded-[12px] ring-1 ring-white/10">
                      {o.type === "TOPUP" && item.diamonds ? (
                        <DiamondCover tier={tierFor(item.diamonds)} diamonds={item.diamonds} />
                      ) : image ? (
                        <img src={image} alt="" className="size-full object-cover" />
                      ) : (
                        <AccountPlaceholder />
                      )}
                    </Link>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <Link href={link} className="min-w-0 truncate text-[14.5px] font-semibold hover:text-volt-300">
                          {item.name}
                        </Link>
                        <span className="shrink-0 font-display text-[14.5px] font-bold tabular-nums">{formatMoney(o.total, o.currency)}</span>
                      </div>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-fg-subtle">
                        <span className="font-mono tracking-wider">{o.number}</span>· {formatDate(o.createdAt)} {o.isTest && <DemoBadge />}
                      </p>
                      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2.5">
                        <OrderStatusBadge status={o.status} simulated={o.delivery?.simulated} />
                        <div className="flex items-center gap-2">
                          {o.chatUnreadCustomer > 0 && (
                            <Link href={`${link}#chat`} className="inline-flex items-center gap-1 rounded-full bg-volt-400 px-2.5 py-1 text-[11.5px] font-bold text-volt-ink">
                              <MessagesSquare className="size-3.5" /> {o.chatUnreadCustomer === 1 ? "Mensaje nuevo" : `${o.chatUnreadCustomer} mensajes`}
                            </Link>
                          )}
                          {o.type === "TOPUP" && o.status === "DELIVERED" && o.package?.slug ? (
                            <Link href={`/recargas?paquete=${o.package.slug}${o.playerId ? `&id=${o.playerId}` : ""}`} className="inline-flex items-center gap-1 text-[12.5px] font-medium text-volt-300 hover:underline">
                              <RotateCw className="size-3.5" /> Volver a comprar
                            </Link>
                          ) : (
                            <Link href={link} className="inline-flex items-center gap-1 text-[12.5px] font-medium text-fg-muted hover:text-fg">
                              Ver pedido <ArrowRight className="size-3.5" />
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {tab === "perfil" && (
        <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-2">
          <section id="avatar" className="scroll-mt-24 rounded-[18px] bg-ink-850 p-5 ring-1 ring-white/[0.07] sm:p-6" aria-labelledby="t-avatar">
            <h2 id="t-avatar" className="text-[16px] font-bold">
              Tu avatar
            </h2>
            <p className="mb-5 mt-1 text-[13px] text-fg-muted">Así te verás en la tienda.</p>
            <AvatarPicker user={account} />
            <p className="mb-2.5 mt-7 text-[12px] font-semibold uppercase tracking-[0.12em] text-fg-subtle">Portada del perfil</p>
            <ThemePicker current={theme.key} />
          </section>
          <section className="rounded-[18px] bg-ink-850 p-5 ring-1 ring-white/[0.07] sm:p-6" aria-labelledby="t-datos">
            <h2 id="t-datos" className="text-[16px] font-bold">
              Tus datos
            </h2>
            <p className="mb-5 mt-1 text-[13px] text-fg-muted">Con tu ID guardado recargas en un clic.</p>
            <ProfileForm name={account.name && account.name !== "No Name" ? account.name : ""} email={account.email} phone={account.phone ?? ""} ffPlayerId={account.ffPlayerId ?? ""} />
          </section>
        </div>
      )}

      {tab === "seguridad" && (
        <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-2">
          <section className="rounded-[18px] bg-ink-850 p-5 ring-1 ring-white/[0.07] sm:p-6" aria-labelledby="t-acceso">
            <h2 id="t-acceso" className="text-[16px] font-bold">
              Formas de ingresar
            </h2>
            <ul className="mt-4 divide-y divide-white/[0.06] text-[13.5px]">
              {[
                { icon: Mail, l: "Código por correo", d: account.email, on: true, note: "Siempre disponible" },
                { icon: BadgeCheck, l: "Google", d: account.googleSub ? "Cuenta vinculada" : "Entra una vez con «Continuar con Google» para vincularla", on: !!account.googleSub },
                { icon: KeyRound, l: "Contraseña", d: account.hasPassword ? "Creada" : "Aún no tienes; puedes crearla aquí", on: account.hasPassword },
              ].map(({ icon: Icon, l, d, on, note }) => (
                <li key={l} className="flex items-center gap-3 py-3">
                  <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", on ? "bg-ok-400/12 text-ok-400" : "bg-white/[0.05] text-fg-subtle")}>
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{l}</span>
                    <span className="block truncate text-[12px] text-fg-subtle">{d}</span>
                  </span>
                  <span className={cn("text-[12px] font-medium", on ? "text-ok-400" : "text-fg-subtle")}>{note ?? (on ? "Activo" : "Inactivo")}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[12px] bg-white/[0.03] p-3.5 ring-1 ring-white/[0.06]">
              <span className="flex items-center gap-2.5 text-[13px] text-fg-muted">
                <MonitorSmartphone className="size-4" /> {sessions} sesión(es) abierta(s)
              </span>
              <form action={logoutEverywhereAction}>
                <button type="submit" className="text-[12.5px] font-medium text-bad-400 hover:underline">
                  Cerrar en todos los dispositivos
                </button>
              </form>
            </div>
          </section>
          <section className="rounded-[18px] bg-ink-850 p-5 ring-1 ring-white/[0.07] sm:p-6" aria-labelledby="t-pass">
            <h2 id="t-pass" className="text-[16px] font-bold">
              {account.hasPassword ? "Cambiar contraseña" : "Crear contraseña"}
            </h2>
            <p className="mt-1 text-[13px] text-fg-muted">{account.hasPassword ? "Al cambiarla se cierran las demás sesiones." : "Opcional: también podrás ingresar con correo y contraseña."}</p>
            <PasswordForm hasPassword={account.hasPassword} />
          </section>
        </div>
      )}

      {tab === "soporte" && (
        <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <aside className="space-y-4 xl:sticky xl:top-24 xl:col-start-2 xl:row-start-1 xl:self-start" aria-label="Contactar a soporte">
            <section className="rounded-[18px] bg-ink-850 p-5 ring-1 ring-white/[0.07]" aria-labelledby="t-nueva">
              <h2 id="t-nueva" className="text-[16px] font-bold">
                Nueva solicitud
              </h2>
              <p className="mb-4 mt-1 text-[13px] text-fg-muted">¿Una duda con un pedido, un pago o la tienda? Escríbenos.</p>
              <NewTicketForm orders={orderOptions} email={account.email} />
            </section>
            {(wa || settings.supportEmail) && (
              <section className="rounded-[18px] bg-ink-850 p-2 ring-1 ring-white/[0.07]" aria-label="Otros canales">
                {wa && (
                  <a href={wa} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-[14px] p-3 transition hover:bg-white/[0.04]">
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-green-500/12 text-green-400 ring-1 ring-green-500/25">
                      <MessageCircle className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1 text-[13.5px]">
                      <span className="block font-semibold">WhatsApp</span>
                      <span className="block text-fg-muted">{settings.whatsapp}</span>
                    </span>
                    <ArrowRight className="size-4 shrink-0 text-fg-subtle" />
                  </a>
                )}
                {settings.supportEmail && (
                  <a href={`mailto:${settings.supportEmail}`} className="flex items-center gap-3 rounded-[14px] p-3 transition hover:bg-white/[0.04]">
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-sky-500/12 text-sky-300 ring-1 ring-sky-500/25">
                      <Mail className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1 text-[13.5px]">
                      <span className="block font-semibold">Correo</span>
                      <span className="block truncate text-fg-muted">{settings.supportEmail}</span>
                    </span>
                  </a>
                )}
              </section>
            )}
            <p className="flex gap-2 px-1 text-[12px] leading-relaxed text-fg-subtle">
              <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
              Nunca te pediremos contraseñas, códigos SMS ni pagos fuera de la página.
            </p>
          </aside>

          <section className="min-w-0 xl:col-start-1 xl:row-start-1" aria-labelledby="t-solicitudes">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 id="t-solicitudes" className="text-[16px] font-bold">
                Mis solicitudes
              </h2>
              {tickets.length > 0 && <span className="text-[12.5px] text-fg-subtle">{tickets.length}</span>}
            </div>
            {!account.emailVerifiedAt && (
              <p className="mb-3 rounded-[12px] bg-white/[0.03] px-3.5 py-2.5 text-[12.5px] text-fg-muted ring-1 ring-white/[0.06]">
                Verifica tu correo para ver también las solicitudes que enviaste sin iniciar sesión.
              </p>
            )}
            {tickets.length === 0 ? (
              <EmptyState icon={<Headset className="size-5" />} title="Aún no tienes solicitudes" description="Cuando nos escribas, verás aquí nuestras respuestas y podrás contestar sin salir de tu cuenta." />
            ) : (
              <ul className="space-y-4">
                {tickets.map((t) => {
                  const meta = TICKET_STATUS[t.status];
                  const fresh = awaitingCustomer(t);
                  const thread = [{ id: `${t.id}-0`, body: t.message, fromCustomer: true, createdAt: t.createdAt }, ...t.replies];
                  return (
                    <li key={t.id} className={cn("overflow-hidden rounded-[16px] bg-ink-850 ring-1", fresh ? "ring-volt-400/35" : "ring-white/[0.07]")}>
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 border-b border-white/[0.06] px-4 py-3">
                        <span className="text-[14px] font-semibold">{topicLabel(t.topic)}</span>
                        <span className="font-mono text-[12px] text-fg-subtle">#{ticketRef(t.id)}</span>
                        <Badge tone={meta.tone} dot>
                          {meta.l}
                        </Badge>
                        {fresh && <span className="rounded-full bg-volt-400 px-2 py-0.5 text-[11px] font-bold text-volt-ink">Nueva respuesta</span>}
                        <span className="ml-auto text-[12px] text-fg-subtle">{formatDate(t.createdAt)}</span>
                        {t.order && (
                          <Link href={`/pedido/${t.order.number}?t=${t.order.trackingToken}`} className="w-full font-mono text-[12px] text-volt-300 hover:underline sm:w-auto">
                            Pedido {t.order.number}
                          </Link>
                        )}
                      </div>
                      <ol className="space-y-2.5 px-4 py-4">
                        {thread.map((m) => (
                          <li key={m.id} className={cn("flex", m.fromCustomer ? "justify-end" : "justify-start")}>
                            <div className={cn("max-w-[85%] rounded-[14px] px-3.5 py-2.5 ring-1", m.fromCustomer ? "rounded-br-[4px] bg-white/[0.05] ring-white/[0.07]" : "rounded-bl-[4px] bg-volt-400/[0.08] ring-volt-400/20")}>
                              <p className="mb-1 text-[11px] text-fg-muted">
                                <span className="font-semibold">{m.fromCustomer ? "Tú" : `Soporte ${settings.storeName}`}</span> · {formatDate(m.createdAt)}
                              </p>
                              <p className="whitespace-pre-line break-words text-[13.5px] leading-relaxed">{m.body}</p>
                            </div>
                          </li>
                        ))}
                      </ol>
                      <div className="space-y-2 border-t border-white/[0.06] px-4 py-3">
                        {t.status === "CLOSED" ? (
                          <p className="text-[12.5px] text-fg-subtle">Solicitud cerrada. Si necesitas algo más, abre una nueva.</p>
                        ) : (
                          <>
                            <TicketReplyForm id={t.id} />
                            <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-fg-subtle">
                              <span>{t.status === "RESOLVED" ? "Resuelta. Si respondes, la reabrimos." : "Te avisamos por correo cuando respondamos."}</span>
                              {t.status !== "RESOLVED" && <ResolveTicketButton id={t.id} />}
                            </div>
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      )}
        </div>
      </div>
    </Container>
  );
}
