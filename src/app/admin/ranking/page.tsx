import Link from "next/link";
import { Gem, Lock } from "lucide-react";
import { ActionForm, ConfirmSubmit, SubmitButton } from "@/components/admin/action-form";
import { PageHeader, Panel, Stat, Table } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatMoney, formatNumber } from "@/lib/money";
import { cn } from "@/lib/utils";
import { DEFAULT_TOPUP_REGION } from "@/domain/topup-regions";
import { isSeason, previousPeriod, periodOf } from "@/domain/ranking";
import { ORDER_STATUS_META } from "@/domain/order-status";
import { computeRanking, prizeOrders, prizePackage, rankingConfig } from "@/server/ranking";
import { awardPrizeAction, saveRankingAction } from "@/app/actions/ranking";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ranking y premios" };

const Pos = ({ n }: { n: number }) => (
  <span className={cn("grid size-7 place-items-center rounded-full text-[12.5px] font-black", n <= 3 ? "bg-volt-400 text-volt-ink" : "bg-white/[0.08] text-fg")}>{n}</span>
);

export default async function AdminRankingPage() {
  await requireAdmin();
  const now = new Date();
  const cfg = await rankingConfig();
  const current = periodOf(now);
  const last = previousPeriod(current);
  const [rows, lastRows, given, packages] = await Promise.all([
    computeRanking(current, cfg.minCop),
    computeRanking(last, cfg.minCop),
    prizeOrders(last.key),
    db.diamondPackage.findMany({ where: { region: DEFAULT_TOPUP_REGION, active: true, diamonds: { gt: 0 }, providerSku: { not: null } }, select: { diamonds: true, bonusDiamonds: true }, orderBy: { diamonds: "asc" } }),
  ]);
  const prizePkgs = await Promise.all(cfg.prizes.map((d) => prizePackage(d)));
  const qualifiers = rows.filter((r) => r.qualifies);
  const lastIsSeason = isSeason(last.key);
  const lastWinners = lastIsSeason ? lastRows.filter((r) => r.qualifies).slice(0, 3) : [];
  const place = new Map(qualifiers.map((r, i) => [r.key, i + 1]));
  const amounts = [...new Set(packages.map((p) => p.diamonds))];

  return (
    <>
      <PageHeader
        title="Ranking y premios"
        description={`Top 3 de ${current.month} (cierra el ${formatDate(new Date(current.end.getTime() - 60_000))}). Cuentan las compras pagadas y entregadas del mes de quienes aceptaron ofertas por correo.`}
        actions={
          <Link href="/legal/top-del-mes" target="_blank" className="inline-flex h-9 items-center rounded-lg bg-white/[0.06] px-3 text-[13px] font-medium ring-1 ring-white/10 hover:bg-white/10">
            Ver bases públicas
          </Link>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Participan por premio" value={formatNumber(qualifiers.length)} hint={`Aceptaron ofertas y suman ${formatMoney(cfg.minCop)} o más`} />
        <Stat label="Compradores del mes" value={formatNumber(rows.length)} hint={`${formatNumber(rows.filter((r) => r.optIn).length)} aceptaron ofertas`} />
        <Stat label="Premios del mes" value={cfg.prizes.map((p) => formatNumber(p)).join(" · ")} hint="Diamantes del paquete de cada puesto" />
        <Stat label="En el inicio" value={cfg.enabled ? "Visible" : "Oculto"} tone={cfg.enabled ? "ok" : "warn"} hint="Se cambia abajo, en Ajustes" />
      </div>

      <h2 className="mb-2 mt-2 text-[14px] font-semibold">Este mes ({current.month})</h2>
      <Table>
        <thead>
          <tr>
            <th>Puesto</th>
            <th>Cliente</th>
            <th>ID de jugador</th>
            <th>Compras</th>
            <th>Total pagado</th>
            <th>Participa</th>
            <th>Premio</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="py-10 text-center text-fg-muted">
                Aún no hay compras entregadas este mes.
              </td>
            </tr>
          )}
          {rows.slice(0, 25).map((r) => {
            const p = place.get(r.key);
            return (
              <tr key={r.key} className={cn(!!p && p <= 3 && "bg-volt-400/[0.04]")}>
                <td>{p ? <Pos n={p} /> : <span className="text-fg-subtle">—</span>}</td>
                <td className="font-medium">{r.email}</td>
                <td className="font-mono text-fg-muted">{r.playerId ?? "—"}</td>
                <td className="tabular-nums">{r.orders}</td>
                <td className="font-semibold tabular-nums">{formatMoney(r.total)}</td>
                <td>{r.qualifies ? <span className="text-ok-400">Sí</span> : <span className="text-fg-subtle">{r.optIn ? `Le faltan ${formatMoney(cfg.minCop - r.total)}` : "No aceptó ofertas"}</span>}</td>
                <td>
                  {p && p <= 3 ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-volt-300">
                      <Gem className="size-4" /> {formatNumber(cfg.prizes[p - 1])}
                    </span>
                  ) : (
                    <span className="text-fg-subtle">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Panel title={lastIsSeason ? `Premios de ${last.month} (mes cerrado)` : "Premios"}>
          {!lastIsSeason ? (
            <p className="text-[13px] text-fg-muted">
              La primera temporada es {current.month}. Cuando cierre, aquí aparecen los 3 ganadores con el botón para entregar cada premio, y te llega un aviso al correo de alertas.
            </p>
          ) : lastWinners.length === 0 ? (
            <p className="text-[13px] text-fg-muted">Nadie ganó en {last.month}: ningún cliente que aceptó ofertas llegó a {formatMoney(cfg.minCop)}.</p>
          ) : (
            <ul className="space-y-4">
              {lastWinners.map((w, i) => {
                const pos = i + 1;
                const order = given.get(pos);
                const pkg = prizePkgs[i];
                return (
                  <li key={w.key} className="rounded-lg border border-white/[0.07] bg-ink-900 p-3">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <Pos n={pos} />
                      <span className="font-medium">{w.email}</span>
                      <span className="text-[12.5px] text-fg-muted">
                        {formatMoney(w.total)} · {w.orders} compras
                      </span>
                    </div>
                    {order ? (
                      <p className="mt-2 text-[13px]">
                        Premio creado:{" "}
                        <Link href={`/admin/pedidos/${order.id}`} className="font-mono text-volt-300 underline underline-offset-2">
                          {order.number}
                        </Link>{" "}
                        · {ORDER_STATUS_META[order.status].label} · ID {order.playerId}
                      </p>
                    ) : (
                      <ActionForm action={awardPrizeAction} className="mt-2.5">
                        <input type="hidden" name="period" value={last.key} />
                        <input type="hidden" name="pos" value={pos} />
                        <div className="flex flex-wrap items-end gap-2">
                          <label className="block">
                            <span className="mb-1 block text-[12px] text-fg-muted">ID de Free Fire</span>
                            <input name="playerId" defaultValue={w.playerId ?? ""} inputMode="numeric" className="field w-40 font-mono" />
                          </label>
                          <ConfirmSubmit variant="primary" confirmText={`Confirmar: enviar ${formatNumber(cfg.prizes[i])} diamantes`}>
                            Entregar {pkg ? formatNumber(pkg.diamonds + pkg.bonusDiamonds) : formatNumber(cfg.prizes[i])} diamantes
                          </ConfirmSubmit>
                        </div>
                        <p className="mt-1.5 text-[11.5px] text-fg-subtle">Usa saldo del proveedor. Se puede entregar una sola vez; al ganador le llega un correo.</p>
                      </ActionForm>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-4 flex items-start gap-1.5 text-[12px] text-fg-subtle">
            <Lock className="mt-px size-3.5 shrink-0" /> Los premios del mes en curso se entregan cuando cierre. Conviene esperar unos días por si hay contracargos en Bold.
          </p>
        </Panel>

        <Panel title="Ajustes">
          <ActionForm action={saveRankingAction}>
            <label className="flex items-center gap-2 text-[13px]">
              <input type="checkbox" name="enabled" defaultChecked={cfg.enabled} className="size-4 accent-[#c8f04f]" /> Mostrar el Top 3 del mes en el inicio
            </label>
            <label className="mt-4 block">
              <span className="mb-1.5 block text-[12.5px] font-medium">Gasto mínimo en el mes para ganar (pesos)</span>
              <input name="minCop" defaultValue={cfg.minCop} inputMode="numeric" className="field" />
            </label>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {[1, 2, 3].map((p, i) => (
                <label key={p} className="block">
                  <span className="mb-1.5 block text-[12.5px] font-medium">Premio Top {p}</span>
                  <select name={`prize${p}`} defaultValue={cfg.prizes[i]} className="field">
                    {(amounts.includes(cfg.prizes[i]) ? amounts : [cfg.prizes[i], ...amounts]).map((d) => (
                      <option key={d} value={d}>
                        {formatNumber(d)} diamantes
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            {prizePkgs.some((p) => !p || p.supplierOutOfStock || !p.available) && (
              <p className="mt-2 text-[12px] text-warn-400">Alguno de los paquetes de premio no está activo o está agotado en el proveedor ahora mismo.</p>
            )}
            <SubmitButton className="mt-4" size="sm">
              Guardar
            </SubmitButton>
          </ActionForm>
        </Panel>
      </div>
    </>
  );
}
