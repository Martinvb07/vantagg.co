import Link from "next/link";
import type { ReactNode } from "react";
import { AlertTriangle, ArrowRight, Scale, CircleAlert, CircleCheck, CreditCard, Flag, Gem, Inbox, MessagesSquare, Plus, Receipt, RotateCcw, Store, Ticket, Wallet } from "lucide-react";
import { Panel } from "@/components/admin/ui";
import { REVENUE_STATUSES } from "@/domain/order-status";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { formatMoney, formatNumber } from "@/lib/money";
import { cn } from "@/lib/utils";
import { getIntegrationOverview } from "@/server/integrations/status";
import { activeWholesale } from "@/server/integrations/topup";
import { getSettings } from "@/server/settings";

export const dynamic = "force-dynamic";
export const metadata = { title: { absolute: "Inicio · Panel" } };

const RANGES = { hoy: { l: "Hoy", d: 1 }, "7d": { l: "7 días", d: 7 }, "30d": { l: "30 días", d: 30 } } as const;
type RangeKey = keyof typeof RANGES;
const DAY = 86_400_000;
const OFFSET = 5 * 3_600_000; // Bogotá UTC−5

/** Inicio del día (Bogotá) de hace n−1 días. */
function rangeStart(days: number) {
  const ymd = new Date(Date.now() - OFFSET - (days - 1) * DAY).toISOString().slice(0, 10);
  return new Date(`${ymd}T00:00:00-05:00`);
}
const dayKey = (d: Date) => new Date(d.getTime() - OFFSET).toISOString().slice(0, 10);

/** Saldo del proveedor sin frenar la página (máx. 2,5 s). */
async function supplierBalance(): Promise<{ amount: number; currency: string } | null> {
  const supplier = activeWholesale();
  if (!supplier) return null;
  const timeout = new Promise<null>((r) => setTimeout(() => r(null), 2500));
  return Promise.race([supplier.wholesale.balance().catch(() => null), timeout]);
}

type Todo = { href: string; icon: typeof Receipt; text: string; hint: string; tone: string };

function TodoRow({ href, icon: Icon, text, hint, tone }: Todo) {
  return (
    <li>
      <Link href={href} className="group flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-white/[0.03]">
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-[10px]", tone)}>
          <Icon className="size-[18px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-semibold">{text}</span>
          <span className="block text-[12.5px] text-fg-muted">{hint}</span>
        </span>
        <ArrowRight className="size-4 text-fg-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-fg" />
      </Link>
    </li>
  );
}

function Kpi({ label, value, hint }: { label: string; value: ReactNode; hint: string }) {
  return (
    <div className="rounded-[12px] bg-white/[0.03] p-4 ring-1 ring-white/[0.06]">
      <p className="text-[12.5px] text-fg-muted">{label}</p>
      <p className="mt-1.5 font-display text-[24px] font-semibold leading-none tabular-nums">{value}</p>
      <p className="mt-1.5 text-[11.5px] text-fg-subtle">{hint}</p>
    </div>
  );
}

function QuickAction({ href, icon: Icon, label }: { href: string; icon: typeof Receipt; label: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 rounded-[12px] bg-ink-850 px-3.5 py-3 text-[13.5px] font-medium ring-1 ring-white/[0.07] transition hover:ring-white/20">
      <Icon className="size-4 text-volt-300" />
      {label}
    </Link>
  );
}

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ r?: string; prueba?: string }> }) {
  const user = await requireStaff();
  const isAdmin = user.role === "ADMIN";
  const sp = await searchParams;
  const range: RangeKey = sp.r && sp.r in RANGES ? (sp.r as RangeKey) : "7d";
  const days = RANGES[range].d;
  const withTest = sp.prueba === "1";
  const from = rangeStart(days);
  const sold = { ...(withTest ? {} : { isTest: false }), status: { in: [...REVENUE_STATUSES] } };

  const [periodOrders, toDeliver, unreadChats, failed, stuck, refundReq, tickets, claims, testCount, integrations, balance, biggestCost] = await Promise.all([
    db.order.findMany({ where: { ...sold, paidAt: { gte: from } }, select: { paidAt: true, total: true, type: true, packageId: true, itemSnapshot: true }, take: 50_000 }),
    db.order.count({ where: { type: "ACCOUNT", status: "PROCESSING" } }),
    db.order.count({ where: { type: "ACCOUNT", chatUnreadStaff: { gt: 0 } } }),
    db.order.count({ where: { status: "DELIVERY_FAILED" } }),
    db.order.count({ where: { status: "PAID", paidAt: { lt: new Date(Date.now() - 10 * 60_000) } } }),
    db.order.count({ where: { status: "REFUND_REQUESTED" } }),
    db.supportTicket.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    db.listingClaim.count({ where: { status: { in: ["OPEN", "REVIEWING"] } } }),
    db.order.count({ where: { isTest: true } }),
    getIntegrationOverview(),
    isAdmin ? supplierBalance() : Promise.resolve(null),
    db.diamondPackage.aggregate({ where: { active: true, available: true }, _max: { costCents: true } }),
  ]);

  // Pendientes: solo lo que requiere una acción, escrito como acción.
  const s = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const todos: Todo[] = [];
  if (toDeliver) todos.push({ href: "/admin/chats?f=entregar", icon: MessagesSquare, text: `Entregar ${s(toDeliver, "cuenta vendida", "cuentas vendidas")}`, hint: "El cliente ya pagó: pásale los datos por el chat del pedido.", tone: "bg-volt-400/12 text-volt-300" });
  if (unreadChats && unreadChats !== toDeliver) todos.push({ href: "/admin/chats", icon: MessagesSquare, text: `Responder ${s(unreadChats, "chat", "chats")}`, hint: "Mensajes de clientes sin leer.", tone: "bg-sky-400/12 text-sky-300" });
  if (failed) todos.push({ href: "/admin/pedidos?estado=DELIVERY_FAILED", icon: CircleAlert, text: `Revisar ${s(failed, "recarga con error", "recargas con error")}`, hint: "Ábrela y usa «Reintentar entrega» o reembolsa.", tone: "bg-bad-400/12 text-bad-400" });
  if (stuck) todos.push({ href: "/admin/pedidos?estado=PAID", icon: CreditCard, text: `Revisar ${s(stuck, "pago sin entrega", "pagos sin entrega")}`, hint: "Pagados hace más de 10 minutos y sin enviar al proveedor.", tone: "bg-warn-400/12 text-warn-400" });
  if (refundReq) todos.push({ href: "/admin/pedidos?estado=REFUND_REQUESTED", icon: RotateCcw, text: `Reembolsar ${s(refundReq, "pedido", "pedidos")}`, hint: "Devuelve el dinero desde la pasarela y marca el pedido como reembolsado.", tone: "bg-warn-400/12 text-warn-400" });
  if (tickets) todos.push({ href: "/admin/soporte", icon: Inbox, text: `Responder ${s(tickets, "mensaje de soporte", "mensajes de soporte")}`, hint: "Tu respuesta le llega al cliente por correo.", tone: "bg-violet-500/12 text-violet-300" });
  if (claims) todos.push({ href: "/admin/reclamos", icon: Flag, text: `Revisar ${s(claims, "reclamo", "reclamos")} de cuentas`, hint: "Alguien dice ser dueño de una cuenta publicada.", tone: "bg-pink-500/12 text-pink-300" });
  // Datos del vendedor que exige el Estatuto del Consumidor (Ley 1480, art. 50) y contacto para clientes.
  if (isAdmin) {
    const st = await getSettings();
    const missing = [!st.legalName && "razón social", !st.taxId && "NIT o cédula", !st.address && "dirección", !st.whatsapp && "WhatsApp"].filter(Boolean);
    if (missing.length) todos.push({ href: "/admin/ajustes", icon: Scale, text: "Completar datos legales de la tienda", hint: `Falta: ${missing.join(", ")}. Se muestran en el pie de página y en los términos (Ley 1480).`, tone: "bg-warn-400/12 text-warn-400" });
  }
  const needCents = biggestCost._max.costCents ?? 0;
  if (balance != null && needCents && balance.amount * 100 < needCents) {
    todos.push({ href: "/admin/proveedor", icon: Wallet, text: "Recargar saldo del proveedor", hint: `Tienes ${balance.amount.toFixed(2)} ${balance.currency}; tu paquete más caro cuesta ${(needCents / 100).toFixed(2)} ${balance.currency}.`, tone: "bg-warn-400/12 text-warn-400" });
  }

  // Ventas del periodo
  const revenue = periodOrders.reduce((n, o) => n + o.total, 0);
  const count = periodOrders.length;
  const avg = count ? Math.round(revenue / count) : 0;
  const buckets = new Map<string, number>();
  for (let i = 0; i < days; i++) buckets.set(dayKey(new Date(from.getTime() + i * DAY + OFFSET)), 0);
  for (const o of periodOrders) if (o.paidAt) buckets.set(dayKey(o.paidAt), (buckets.get(dayKey(o.paidAt)) ?? 0) + o.total);
  const series = [...buckets.entries()];
  const max = Math.max(1, ...series.map(([, v]) => v));
  const top = new Map<string, { name: string; units: number; revenue: number }>();
  for (const o of periodOrders) {
    const name = (o.itemSnapshot as { name?: string }).name ?? "Producto";
    const key = o.type === "TOPUP" ? `p:${o.packageId ?? name}` : "account";
    const row = top.get(key) ?? { name: o.type === "TOPUP" ? name : "Cuentas Free Fire", units: 0, revenue: 0 };
    row.units += 1;
    row.revenue += o.total;
    top.set(key, row);
  }
  const topList = [...top.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  const paymentsReal = integrations.some((i) => i.group === "Pagos" && i.active && i.mode !== "Prueba local");
  // En la tienda publicada, un modo de prueba activo significa pedidos que no se cobran o no se entregan.
  const testModes = [env.bold.testMode && "pagos de Bold (BOLD_TEST_MODE)", env.topup.forceTest && "recargas (TOPUP_TEST_MODE)"].filter(Boolean);
  const qs = (r: string, t = withTest) => `/admin?r=${r}${t ? "&prueba=1" : ""}`;
  const fecha = new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Bogota" }).format(new Date());
  const today = fecha.charAt(0).toUpperCase() + fecha.slice(1);

  return (
    <>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold">Inicio</h1>
        <p className="mt-1 text-sm text-fg-muted">
          {today} · lo que necesita tu atención y cómo van las ventas.
        </p>
      </div>

      {isAdmin && !paymentsReal && (
        <Link href="/admin/integraciones" className="mb-6 flex items-center gap-3 rounded-[12px] border border-warn-400/25 bg-warn-400/[0.06] p-4 text-sm hover:border-warn-400/40">
          <AlertTriangle className="size-5 shrink-0 text-warn-400" />
          <span className="flex-1">
            <span className="font-medium text-fg">Los pagos aún no están activos.</span> <span className="text-fg-muted">Cuando Bold apruebe tu comercio, conectamos las llaves y la tienda empieza a cobrar. Mientras tanto nadie puede comprar.</span>
          </span>
          <ArrowRight className="size-4 text-fg-subtle" />
        </Link>
      )}

      {isAdmin && paymentsReal && testModes.length > 0 && (
        <Link href="/admin/integraciones" className="mb-6 flex items-center gap-3 rounded-[12px] border border-bad-400/30 bg-bad-400/[0.06] p-4 text-sm hover:border-bad-400/50">
          <AlertTriangle className="size-5 shrink-0 text-bad-400" />
          <span className="flex-1">
            <span className="font-medium text-fg">Modo de prueba activo en {testModes.join(" y ")}.</span> <span className="text-fg-muted">Los pedidos nuevos quedan como prueba: no se cobran o no se entregan de verdad. Quítalo del .env antes de vender.</span>
          </span>
          <ArrowRight className="size-4 text-fg-subtle" />
        </Link>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        {/* Pendientes */}
        <Panel title={todos.length ? `Pendientes (${todos.length})` : "Pendientes"} bodyClass="p-0">
          {todos.length === 0 ? (
            <div className="flex items-center gap-3.5 px-4 py-6">
              <span className="grid size-10 place-items-center rounded-[10px] bg-ok-400/12 text-ok-400">
                <CircleCheck className="size-5" />
              </span>
              <span>
                <span className="block text-[14px] font-semibold">Todo al día</span>
                <span className="block text-[12.5px] text-fg-muted">No hay entregas, errores ni mensajes esperando.</span>
              </span>
            </div>
          ) : (
            <ul className="divide-y divide-white/[0.05]">
              {todos.map((t) => (
                <TodoRow key={t.href + t.text} {...t} />
              ))}
            </ul>
          )}
        </Panel>

        {/* Accesos rápidos */}
        <Panel title="Accesos rápidos">
          <div className="grid grid-cols-2 gap-2.5">
            <QuickAction href="/admin/pedidos" icon={Receipt} label="Ver pedidos" />
            {isAdmin && <QuickAction href="/admin/paquetes" icon={Gem} label="Cambiar precios" />}
            {isAdmin && <QuickAction href="/admin/cuentas/nueva" icon={Plus} label="Publicar una cuenta" />}
            {isAdmin && <QuickAction href="/admin/codigos" icon={Ticket} label="Crear descuento" />}
            {isAdmin && <QuickAction href="/admin/proveedor" icon={Wallet} label={balance != null ? `Saldo: ${balance.amount.toFixed(2)} ${balance.currency}` : "Proveedor y saldo"} />}
            <QuickAction href="/" icon={Store} label="Ver la tienda" />
          </div>
        </Panel>
      </div>

      {/* Ventas */}
      <section className="mt-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold">Ventas</h2>
          <div className="flex flex-wrap items-center gap-2">
            <nav className="flex gap-1 rounded-full bg-white/[0.04] p-1 ring-1 ring-white/[0.06]" aria-label="Periodo">
              {(Object.keys(RANGES) as RangeKey[]).map((k) => (
                <Link key={k} href={qs(k)} className={cn("rounded-full px-3 py-1.5 text-[12.5px] font-medium", range === k ? "bg-white/[0.09] text-fg" : "text-fg-muted hover:text-fg")}>
                  {RANGES[k].l}
                </Link>
              ))}
            </nav>
            {testCount > 0 && (
              <Link href={qs(range, !withTest)} className={cn("rounded-full px-3 py-1.5 text-[12.5px] font-medium ring-1", withTest ? "bg-warn-400/10 text-warn-400 ring-warn-400/25" : "text-fg-muted ring-white/10 hover:text-fg")}>
                {withTest ? "Incluye pedidos de prueba" : "Incluir pedidos de prueba"}
              </Link>
            )}
          </div>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <Panel>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Kpi label="Vendido" value={formatMoney(revenue)} hint="pagos confirmados" />
              <Kpi label="Pedidos" value={formatNumber(count)} hint="pagados" />
              <Kpi label="Promedio" value={formatMoney(avg)} hint="por pedido" />
            </div>
            {revenue === 0 ? (
              <p className="pb-2 pt-8 text-center text-[13px] text-fg-muted">Sin ventas confirmadas en este periodo.</p>
            ) : days > 1 ? (
              <div className="mt-5">
                <div className="flex h-36 items-end gap-[3px]" role="img" aria-label="Ventas por día">
                  {series.map(([d, v]) => (
                    <div key={d} className="group relative flex h-full flex-1 items-end" title={`${d}: ${formatMoney(v)}`}>
                      <div className={cn("w-full rounded-t-[3px] transition-colors", v ? "bg-volt-400/80 group-hover:bg-volt-300" : "bg-white/[0.05]")} style={{ height: `${Math.max(v ? 4 : 2, (v / max) * 100)}%` }} />
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex justify-between text-[11px] text-fg-subtle">
                  <span>{series[0]?.[0]}</span>
                  <span>{series.at(-1)?.[0]}</span>
                </div>
              </div>
            ) : null}
          </Panel>

          <Panel title="Lo más vendido" bodyClass="p-0">
            {topList.length === 0 ? (
              <p className="p-4 text-[13px] text-fg-muted">Sin ventas en este periodo.</p>
            ) : (
              <ul className="divide-y divide-white/[0.05]">
                {topList.map((t, i) => (
                  <li key={t.name} className="flex items-center gap-3 px-4 py-3 text-[13px]">
                    <span className="grid size-6 place-items-center rounded-md bg-white/[0.06] text-[11.5px] font-semibold text-fg-muted">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{t.name}</span>
                      <span className="text-[11.5px] text-fg-subtle">{t.units} venta(s)</span>
                    </span>
                    <span className="font-medium tabular-nums">{formatMoney(t.revenue)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </section>
    </>
  );
}
