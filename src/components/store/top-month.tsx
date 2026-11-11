import Link from "next/link";
import { ChevronRight, Crown } from "lucide-react";
import { CoverArt, tierFor } from "@/components/brand/covers";
import { formatMoney, formatNumber } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { PublicRanking } from "@/server/ranking";

/**
 * «Top 3 del mes» del inicio, con el mismo lenguaje de los banners y portadas de la tienda: fondo negro verdoso, la V lima,
 * trazos de velocidad, nubes oscuras, letra Arial Black itálica y los cofres de los paquetes como premio.
 * Solo muestra puestos e IDs enmascarados: nunca correos ni montos de nadie.
 */

const BLACK = { fontFamily: '"Arial Black", Arial, Helvetica, sans-serif', fontWeight: 900 } as const;
const LIME = "#b9f43c";

function countdown(endsAt: string, now = new Date()) {
  const ms = Math.max(0, new Date(endsAt).getTime() - now.getTime());
  return [
    [Math.floor(ms / 86_400_000), "días"],
    [Math.floor((ms / 3_600_000) % 24), "horas"],
    [Math.floor((ms / 60_000) % 60), "min"],
  ] as const;
}

/** Fondo igual al de los banners: degradado, la V lima, brillo, trazos de velocidad y nubes oscuras. */
function BannerBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div className="absolute inset-0 bg-[linear-gradient(150deg,#0c180c_0%,#030604_100%)]" />
      <svg viewBox="0 0 400 340" className="absolute left-1/2 top-[40%] h-[36%] -translate-x-1/2 opacity-80 lg:-top-[2%] lg:left-[64%] lg:h-[92%] lg:opacity-100">
        <defs>
          <linearGradient id="top-mes-v" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={LIME} stopOpacity=".4" />
            <stop offset="1" stopColor={LIME} stopOpacity=".03" />
          </linearGradient>
        </defs>
        <path d="M0 -10H92L200 204.6L308 -10H400L216 330H184Z" fill="url(#top-mes-v)" />
      </svg>
      <div className="absolute inset-0 bg-[radial-gradient(55%_60%_at_64%_50%,rgba(185,244,60,0.2),rgba(185,244,60,0.04)_55%,transparent_100%)] max-lg:bg-[radial-gradient(80%_40%_at_50%_58%,rgba(185,244,60,0.18),transparent_100%)]" />
      <svg viewBox="0 0 120 90" className="absolute right-2 top-2 w-24 sm:w-32">
        <path d="M8 48L78 -8L72 8L14 56Z" fill={LIME} opacity=".55" />
        <path d="M64 80L106 46.4L102.4 56L67.6 84.8Z" fill={LIME} opacity=".3" />
      </svg>
      <svg viewBox="0 0 70 60" className="absolute bottom-[18%] left-2 w-12 sm:w-16">
        <path d="M2 50L58 5.2L53.2 18L6.8 56.4Z" fill={LIME} opacity=".4" />
      </svg>
      <span className="absolute -bottom-16 -left-10 size-44 rounded-full bg-[#0d200f]/90" />
      <span className="absolute -bottom-20 left-[14%] size-36 rounded-full bg-[#0d200f]/90 max-sm:hidden" />
      <span className="absolute -bottom-16 right-[12%] size-40 rounded-full bg-[#0d200f]/90 max-sm:hidden" />
      <span className="absolute -bottom-20 -right-10 size-48 rounded-full bg-[#0d200f]/90" />
    </div>
  );
}

export function TopMonth({ data }: { data: PublicRanking }) {
  // Orden del podio en pantalla: 2 · 1 · 3
  const podium = [data.podium[1], data.podium[0], data.podium[2]];
  return (
    <section aria-labelledby="top-del-mes" className="relative overflow-hidden rounded-[18px] ring-1 ring-white/[0.08]">
      <BannerBackdrop />

      <div className="relative grid grid-cols-[minmax(0,1fr)] gap-7 px-6 pb-6 pt-7 sm:px-10 sm:pb-7 sm:pt-9 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-center lg:gap-6 lg:px-[5.5%] lg:py-10">
        <div className="min-w-0">
          <span className="inline-block -skew-x-[12deg] bg-[#b9f43c] px-3 py-1 text-[12px] uppercase italic leading-none text-[#030504] sm:text-[13px]" style={BLACK}>
            <span className="inline-block skew-x-[12deg]">Temporada {data.month}</span>
          </span>
          <h2 id="top-del-mes" className="mt-4 uppercase italic leading-[1.02]" style={BLACK}>
            <span className="block text-[34px] text-white sm:text-[54px]">Top 3 del mes</span>
            <span className="block text-[34px] text-[#b9f43c] sm:text-[54px]">gana diamantes</span>
          </h2>
          <p className="mt-3 max-w-[540px] text-[14px] font-bold leading-snug text-[#c9d3cc] sm:text-[17px]" style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
            Los 3 que más recarguen en {data.month} · directo a su ID
          </p>

          <div className="mt-5 flex items-center gap-3">
            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#9aa59e]">Cierra en</span>
            <dl className="flex gap-2">
              {countdown(data.endsAt).map(([v, l]) => (
                <div key={l} className="flex min-w-[58px] flex-col-reverse items-center rounded-[10px] bg-black/45 px-2.5 py-1.5 ring-1 ring-[#b9f43c]/25">
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-[#9aa59e]">{l}</dt>
                  <dd className="text-[20px] italic leading-none text-white tabular-nums sm:text-[22px]" style={BLACK}>
                    {String(v).padStart(2, "0")}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="mt-6 flex items-center gap-5 max-lg:hidden">
            <Link href="/recargas" className="inline-flex h-11 items-center gap-1.5 rounded-full bg-volt-400 pl-5 pr-4 text-[14px] font-semibold text-volt-ink hover:bg-volt-300">
              Recargar y subir <ChevronRight className="size-4" />
            </Link>
            <Link href="/legal/top-del-mes" className="text-[13.5px] font-semibold text-[#c9d3cc] underline-offset-4 hover:text-white hover:underline">
              ¿Cómo funciona?
            </Link>
          </div>
        </div>

        <div className="min-w-0">
          <ol className="mx-auto grid max-w-[560px] grid-cols-3 items-end gap-2.5 sm:gap-4">
            {podium.map((p) => {
              const first = p.pos === 1;
              return (
                <li key={p.pos} className="flex flex-col items-center text-center">
                  {first && <Crown className="mb-0.5 size-5 text-[#b9f43c] drop-shadow-[0_0_10px_rgba(185,244,60,0.6)] sm:size-6" strokeWidth={2.4} aria-hidden />}
                  <div className={cn("relative aspect-square", first ? "w-full" : "w-[82%]", !p.taken && "opacity-60")}>
                    <CoverArt tier={tierFor(p.prize)} className="size-full" />
                  </div>
                  <p className={cn("-mt-2 italic leading-none text-white tabular-nums", first ? "text-[24px] sm:text-[34px]" : "text-[18px] sm:text-[25px]")} style={BLACK}>
                    {formatNumber(p.prize)}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-[9.5px] font-extrabold uppercase tracking-[0.2em] text-[#b9f43c] sm:text-[11px]">
                    <span className="h-[2px] w-3 bg-[#b9f43c]" /> Diamantes
                  </p>
                  <div
                    className={cn(
                      "relative mt-3 flex w-full flex-col items-center rounded-t-[10px] border-x-2 border-t-[3px] border-[#b9f43c] bg-[linear-gradient(180deg,#323a36_0%,#0c100e_100%)]",
                      first ? "h-[104px] shadow-[0_-6px_30px_-6px_rgba(185,244,60,0.55)] sm:h-[120px]" : p.pos === 2 ? "h-[80px] border-[#b9f43c]/70 sm:h-[92px]" : "h-[64px] border-[#b9f43c]/50 sm:h-[74px]",
                    )}
                  >
                    <span
                      className={cn("-mt-[18px] grid place-items-center rounded-full border-2 border-[#030504] bg-[#b9f43c] leading-none text-[#030504]", first ? "size-10 text-[20px] sm:size-12 sm:text-[24px]" : "size-8 text-[16px] sm:size-10 sm:text-[19px]")}
                      style={BLACK}
                    >
                      {p.pos}
                    </span>
                    <span
                      className={cn(
                        "mb-2.5 mt-auto max-w-[94%] truncate rounded-full px-2 py-[3px] text-[10px] font-semibold ring-1 sm:text-[11.5px]",
                        p.taken ? "bg-black/60 font-mono text-[#d9f77f] ring-[#b9f43c]/30" : "bg-[#b9f43c]/10 text-[#c9d3cc] ring-[#b9f43c]/25",
                      )}
                    >
                      {p.taken ? `ID ${p.player}` : "Puesto libre"}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
          <div className="mx-auto flex max-w-[560px] flex-col items-center gap-1.5 border-t-2 border-[#b9f43c]/40 pt-3 sm:flex-row sm:justify-between">
            {data.chasers.length > 0 ? (
              <>
                <span className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#9aa59e]">Persiguen el podio</span>
                <ol className="flex gap-4 text-[12px] sm:text-[12.5px]">
                  {data.chasers.map((s) => (
                    <li key={s.pos} className="flex items-center gap-1.5">
                      <span className="italic text-[#b9f43c]" style={BLACK}>
                        #{s.pos}
                      </span>
                      <span className="font-mono text-[#c9d3cc]">{s.player}</span>
                    </li>
                  ))}
                </ol>
              </>
            ) : (
              <span className="w-full text-center text-[12px] font-semibold text-[#c9d3cc]">
                Suma {formatMoney(data.minCop)} en compras del mes y entra a la pelea por el podio
              </span>
            )}
          </div>
        </div>

        <Link href="/recargas" className="inline-flex h-12 items-center justify-center gap-1.5 rounded-full bg-volt-400 text-[15px] font-semibold text-volt-ink lg:hidden">
          Recargar y subir <ChevronRight className="size-4" />
        </Link>
      </div>

      <p className="relative px-6 pb-4 text-center text-[11.5px] text-[#9aa59e] sm:px-8">
        ✔ Participan clientes que aceptaron recibir ofertas por correo ✔ Mínimo {formatMoney(data.minCop)} en compras pagadas y entregadas del mes ·{" "}
        <Link href="/legal/top-del-mes" className="font-semibold text-[#b9f43c] underline underline-offset-2">
          Bases
        </Link>
      </p>
    </section>
  );
}
