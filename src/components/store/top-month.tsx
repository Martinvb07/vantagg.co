import Link from "next/link";
import { ChevronRight, Crown, Gem } from "lucide-react";
import { CoverArt, tierFor } from "@/components/brand/covers";
import { TopBadge } from "@/components/brand/top-badge";
import { formatMoney, formatNumber } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { PublicRanking } from "@/server/ranking";

/**
 * «Top 3 del mes» del inicio: marcador de temporada, de la misma familia que «Booyah en tiempo real» (visor, letra
 * Sora itálica, barras inclinadas como el registro del juego) con insignias propias de VANTAGG.
 * Solo muestra puestos e IDs enmascarados: nunca correos ni montos de nadie.
 */

const TITLES = ["Campeón del mes", "Subcampeón", "Tercer lugar"];

function countdown(endsAt: string, now = new Date()) {
  const ms = Math.max(0, new Date(endsAt).getTime() - now.getTime());
  return [
    [Math.floor(ms / 86_400_000), "Días"],
    [Math.floor((ms / 3_600_000) % 24), "Horas"],
    [Math.floor((ms / 60_000) % 60), "Min"],
  ] as const;
}

/** Esquinas tipo visor del juego (igual que «Booyah en tiempo real»). */
function HudCorners() {
  const c = "pointer-events-none absolute size-4 border-volt-400/70 sm:size-5";
  return (
    <>
      <span aria-hidden className={cn(c, "left-2.5 top-2.5 border-l-2 border-t-2 sm:left-3 sm:top-3")} />
      <span aria-hidden className={cn(c, "right-2.5 top-2.5 border-r-2 border-t-2 sm:right-3 sm:top-3")} />
      <span aria-hidden className={cn(c, "bottom-2.5 left-2.5 border-b-2 border-l-2 sm:bottom-3 sm:left-3")} />
      <span aria-hidden className={cn(c, "bottom-2.5 right-2.5 border-b-2 border-r-2 sm:bottom-3 sm:right-3")} />
    </>
  );
}

/** Brillo que cruza la tarjeta del campeón. */
function Shine() {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <span className="absolute -inset-y-4 left-0 w-1/3 -skew-x-[20deg] animate-streak bg-gradient-to-r from-transparent via-white/[0.12] to-transparent motion-reduce:hidden" />
    </span>
  );
}

const playerLabel = (p: { taken: boolean; player: string | null }) => (p.taken ? `ID ${p.player}` : "Puesto libre");

export function TopMonth({ data }: { data: PublicRanking }) {
  const [first, ...rest] = data.podium;
  return (
    <section aria-labelledby="top-del-mes" className="relative overflow-hidden rounded-[22px] bg-ink-900 ring-1 ring-white/[0.07]">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(200,240,79,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(200,240,79,0.045)_1px,transparent_1px)] bg-[size:34px_34px] [mask-image:radial-gradient(80%_80%_at_70%_40%,black,transparent)]" />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(45%_60%_at_72%_32%,rgba(200,240,79,0.13),transparent_70%)]" />
      <HudCorners />

      <div className="relative grid grid-cols-[minmax(0,1fr)] gap-7 px-6 pb-7 pt-8 sm:px-8 sm:py-9 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center lg:gap-10">
        {/* Texto */}
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-subtle">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-volt-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-volt-400" />
            </span>
            Clasificación<span className="max-sm:hidden"> · Temporada</span> {data.month}
          </p>
          <h2 id="top-del-mes" className="mt-3 font-display font-black uppercase italic leading-[0.9] tracking-tight">
            <span className="text-[44px] text-volt-400 drop-shadow-[0_0_24px_rgb(200_240_79/0.35)] sm:text-[60px]">Top 3</span>
            <br />
            <span className="text-[22px] sm:text-[32px]">del mes</span>
          </h2>
          <p className="mt-3 max-w-[380px] text-[13.5px] leading-relaxed text-fg-muted sm:text-[14px]">
            Los 3 que más recarguen en {data.month} se llevan diamantes gratis, directo a su ID.
          </p>

          <p className="mt-6 font-mono text-[10.5px] font-semibold uppercase tracking-[0.2em] text-fg-subtle">La temporada cierra en</p>
          <dl className="mt-2.5 grid max-w-[330px] grid-cols-3 gap-2.5">
            {countdown(data.endsAt).map(([v, l]) => (
              <div key={l} className="flex -skew-x-[10deg] flex-col-reverse rounded-[6px] bg-ink-950/60 px-3 py-2.5 ring-1 ring-white/[0.1]">
                <dt className="mt-1 skew-x-[10deg] text-[10.5px] font-medium uppercase tracking-[0.06em] text-fg-subtle">{l}</dt>
                <dd className="skew-x-[10deg] font-display text-[24px] font-black italic tabular-nums leading-none">{String(v).padStart(2, "0")}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-6 flex items-center gap-5 max-lg:hidden">
            <Link href="/recargas" className="inline-flex h-11 items-center gap-1.5 rounded-full bg-volt-400 pl-5 pr-4 text-[14px] font-semibold text-volt-ink hover:bg-volt-300">
              Recargar y subir <ChevronRight className="size-4" />
            </Link>
            <Link href="/legal/top-del-mes" className="text-[13.5px] font-medium text-fg-muted underline-offset-4 hover:text-fg hover:underline">
              ¿Cómo funciona?
            </Link>
          </div>
        </div>

        {/* Marcador */}
        <div className="min-w-0 space-y-2.5">
          <p className="mb-1 flex items-center gap-2 font-mono text-[10.5px] font-semibold uppercase tracking-[0.2em] text-fg-subtle lg:justify-end">
            Marcador de la temporada <span className="h-px w-8 bg-white/15" />
          </p>

          {/* Campeón */}
          <div
            className={cn(
              "relative overflow-hidden rounded-[16px] p-4 sm:p-5",
              first.taken
                ? "bg-gradient-to-r from-volt-400/[0.16] via-volt-400/[0.06] to-ink-950/40 shadow-[0_0_40px_-12px_rgba(200,240,79,0.55)] ring-1 ring-volt-400/45"
                : "border border-dashed border-volt-400/35 bg-gradient-to-r from-volt-400/[0.08] to-ink-950/40",
            )}
          >
            {first.taken && <Shine />}
            <span aria-hidden className="pointer-events-none absolute -right-2 -top-6 font-display text-[130px] font-black italic leading-none text-transparent [-webkit-text-stroke:1.5px_rgba(200,240,79,0.18)]">
              1
            </span>
            <div className="relative flex flex-wrap items-center gap-x-4 gap-y-3">
              <TopBadge pos={1} className={cn("size-[68px] drop-shadow-[0_6px_16px_rgba(255,200,80,0.35)] sm:size-[84px]", !first.taken && "opacity-60")} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 whitespace-nowrap font-display text-[12px] font-black uppercase italic tracking-wide text-volt-300">
                  <Crown className="size-3.5" /> #1 · {TITLES[0]}
                </p>
                <p className={cn("mt-1 whitespace-nowrap font-mono text-[17px] font-semibold sm:text-[19px]", first.taken ? "text-white" : "text-fg-muted")}>{playerLabel(first)}</p>
                {!first.taken && <p className="mt-0.5 text-[12px] text-fg-subtle">¿Serás tú? El trono está libre.</p>}
              </div>
              <div className="flex shrink-0 items-center gap-2 text-right max-sm:w-full max-sm:justify-center max-sm:border-t max-sm:border-volt-400/20 max-sm:pt-3">
                <CoverArt tier={tierFor(first.prize)} className="size-14 sm:size-20" />
                <div>
                  <p className="font-display text-[24px] font-black italic tabular-nums leading-none sm:text-[30px]">{formatNumber(first.prize)}</p>
                  <p className="mt-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-volt-300">Diamantes</p>
                </div>
              </div>
            </div>
          </div>

          {/* 2 y 3: barras inclinadas como el registro del juego */}
          {rest.map((p) => (
            <div
              key={p.pos}
              className={cn(
                "flex -skew-x-[10deg] items-center gap-3 rounded-[10px] border-l-[3px] bg-gradient-to-r from-black/60 via-black/35 to-transparent px-4 py-2.5 ring-1 ring-white/[0.07]",
                p.taken ? "border-volt-400/70" : "border-white/20",
              )}
            >
              <div className="flex min-w-0 flex-1 skew-x-[10deg] items-center gap-3">
                <span className="w-7 font-display text-[20px] font-black italic text-fg-muted sm:w-8 sm:text-[22px]">#{p.pos}</span>
                <TopBadge pos={p.pos} className={cn("size-10 sm:size-11", !p.taken && "opacity-55")} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[10.5px] font-semibold uppercase tracking-[0.12em] text-fg-subtle sm:text-[11px]">{TITLES[p.pos - 1]}</p>
                  <p className={cn("whitespace-nowrap font-mono text-[13.5px] font-semibold sm:text-[14.5px]", p.taken ? "text-sky-100/90" : "text-fg-subtle")}>{playerLabel(p)}</p>
                </div>
                <CoverArt tier={tierFor(p.prize)} className="size-10 max-sm:hidden" />
                <p className="flex shrink-0 items-center gap-1 font-display text-[17px] font-black italic tabular-nums sm:text-[19px]">
                  <Gem className="size-4 text-volt-300" strokeWidth={2.4} />
                  {formatNumber(p.prize)}
                </p>
              </div>
            </div>
          ))}

          {data.chasers.length > 0 ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1 pt-1.5 text-[12px]">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-fg-subtle">Persiguen el podio</span>
              {data.chasers.map((s) => (
                <span key={s.pos} className="flex items-center gap-1.5 text-fg-muted">
                  <TopBadge pos={s.pos} className="size-6" />
                  <span className="font-mono">{s.player}</span>
                </span>
              ))}
            </div>
          ) : (
            <p className="px-1 pt-1.5 text-[12px] text-fg-muted">
              Suma <b className="text-fg">{formatMoney(data.minCop)}</b> en compras del mes y entra a la pelea por el podio.
            </p>
          )}
        </div>

        <div className="lg:hidden">
          <Link href="/recargas" className="flex h-12 items-center justify-center gap-1.5 rounded-full bg-volt-400 text-[15px] font-semibold text-volt-ink">
            Recargar y subir <ChevronRight className="size-4" />
          </Link>
        </div>
      </div>

      <p className="relative border-t border-white/[0.06] px-6 py-3 text-center text-[11.5px] text-fg-subtle sm:px-8">
        Participan clientes que aceptaron recibir ofertas por correo · Mínimo {formatMoney(data.minCop)} en compras pagadas y entregadas del mes ·{" "}
        <Link href="/legal/top-del-mes" className="font-medium text-volt-300 underline underline-offset-2">
          Bases
        </Link>
      </p>
    </section>
  );
}
