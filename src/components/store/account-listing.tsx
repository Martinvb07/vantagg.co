import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Box, Clock, Images, PackageCheck, Shirt, ShieldCheck } from "lucide-react";
import { AccountPlaceholder } from "@/components/brand/illustrations";
import { RankEmblem } from "@/components/brand/rank-emblem";
import { DemoBadge } from "@/components/ui/primitives";
import { formatMoney, formatNumber } from "@/lib/money";
import { RegionFlag } from "@/components/brand/region-flag";
import { rankLabel, regionInfo } from "@/domain/freefire";
import { cn } from "@/lib/utils";
import type { AccountCardView } from "@/server/catalog";

/** Imagen con lo que más pesa al elegir: rango y nivel encima. */
function Cover({ a, className, sizes, priority = false }: { a: AccountCardView; className?: string; sizes: string; priority?: boolean }) {
  return (
    <Link href={`/cuentas/${a.slug}`} className={cn("relative block overflow-hidden bg-ink-750", className)} tabIndex={-1} aria-hidden>
      {a.image ? (
        // Foto completa con su proporción real: la tarjeta toma el alto del edit (sin franjas ni recortes).
        <Image
          src={a.image.url}
          alt=""
          width={0}
          height={0}
          sizes={sizes}
          quality={90}
          priority={priority}
          unoptimized={a.image.url.endsWith(".svg")}
          style={{ width: "100%", height: "auto" }}
          className="block transition-transform duration-500 group-hover:scale-[1.02]"
        />
      ) : (
        <div className="aspect-video">
          <AccountPlaceholder />
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/75 to-transparent" />

      {a.rank && (
        <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1.5 rounded-full bg-ink-950/75 py-1 pl-1 pr-2.5 text-[12px] font-semibold text-white ring-1 ring-white/10 backdrop-blur">
          <RankEmblem rank={a.rank} className="size-5" />
          {rankLabel(a.rank)}
        </span>
      )}
      {a.isDemo && <DemoBadge className="absolute right-2.5 top-2.5" />}

      <span className="absolute bottom-2.5 left-3 flex items-baseline gap-1 text-white drop-shadow">
        {a.level != null && (
          <>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-white/70">Nivel</span>
            <span className="text-[22px] font-extrabold leading-none">{a.level}</span>
          </>
        )}
      </span>
      {a.imagesCount > 1 && (
        <span className="absolute bottom-2.5 right-2.5 inline-flex items-center gap-1 rounded-md bg-ink-950/75 px-1.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur">
          <Images className="size-3" /> {a.imagesCount}
        </span>
      )}
      {a.reservedTemporarily && (
        <span className="absolute inset-0 grid place-items-center bg-ink-950/55">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-ink-900 px-3 py-1 text-[12px] font-semibold text-warn-400 ring-1 ring-white/10">
            <Clock className="size-3.5" /> Reservada
          </span>
        </span>
      )}
    </Link>
  );
}

/** Datos secundarios en una línea: skins, pechos, servidor y revisión. */
function Facts({ a, long, review = true }: { a: AccountCardView; long?: boolean; review?: boolean }) {
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-fg-muted">
      {a.skinsCount != null && (
        <span className="inline-flex items-center gap-1">
          <Shirt className="size-3.5 text-fg-subtle" /> {formatNumber(a.skinsCount)} skins
        </span>
      )}
      {a.chestsCount != null && (
        <span className="inline-flex items-center gap-1">
          <Box className="size-3.5 text-fg-subtle" /> {formatNumber(a.chestsCount)} pechos
        </span>
      )}
      <span className="inline-flex items-center gap-1.5" title={regionInfo(a.region)?.label ?? a.region}>
        <RegionFlag code={a.region} className="h-3 w-[18px]" /> {long ? (regionInfo(a.region)?.label ?? a.region) : a.region}
      </span>
      {!review ? null : a.inventoryVerified ? (
        <span className="inline-flex items-center gap-1 text-ok-400" title="El equipo revisó la cuenta">
          <ShieldCheck className="size-3.5" /> Revisada
        </span>
      ) : (
        <span className="inline-flex items-center gap-1" title="Te acompañamos en el traspaso">
          <PackageCheck className="size-3.5 text-fg-subtle" /> Entrega asistida
        </span>
      )}
    </p>
  );
}

function Price({ a }: { a: AccountCardView }) {
  return (
    <div className="min-w-0">
      {a.quote.original != null && <p className="text-[12px] tabular-nums text-fg-subtle line-through">{formatMoney(a.quote.original, a.currency)}</p>}
      <p className="whitespace-nowrap text-[20px] font-extrabold leading-tight tabular-nums tracking-tight">{formatMoney(a.quote.price, a.currency)}</p>
    </div>
  );
}

function BuyButton({ a }: { a: AccountCardView }) {
  if (!a.available) return <span className="inline-flex h-10 shrink-0 items-center rounded-full bg-white/[0.06] px-4 text-[13px] font-semibold text-fg-subtle">No disponible</span>;
  return (
    <Link href={`/cuentas/${a.slug}/comprar`} className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-volt-400 px-4 text-[13.5px] font-semibold text-volt-ink transition-colors hover:bg-volt-300">
      Comprar <ArrowRight className="size-4" />
    </Link>
  );
}

/** Tarjeta de cuenta en cuadrícula: imagen protagonista, datos en una línea, precio y compra. */
export function AccountGridCard({ a, priority }: { a: AccountCardView; priority?: boolean }) {
  return (
    <article className={cn("group flex flex-col overflow-hidden rounded-[16px] bg-ink-850 ring-1 ring-white/[0.07] transition duration-300 hover:-translate-y-0.5 hover:ring-white/20", !a.available && "opacity-80")}>
      <Cover a={a} priority={priority} sizes="(min-width:1024px) 420px, (min-width:640px) 50vw, 100vw" />
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center justify-between gap-2">
          <Facts a={a} review={false} />
          {a.inventoryVerified && (
            <span className="inline-flex shrink-0 items-center gap-1 text-[12px] font-medium text-ok-400" title="El equipo revisó la cuenta">
              <ShieldCheck className="size-3.5" /> Revisada
            </span>
          )}
        </div>
        <Link href={`/cuentas/${a.slug}`} className="mt-2 line-clamp-2 min-h-[2.7em] text-[14.5px] font-semibold leading-snug hover:text-volt-300">
          {a.title}
        </Link>
        <div className="mt-auto flex items-end justify-between gap-3 pt-4">
          <Price a={a} />
          <BuyButton a={a} />
        </div>
      </div>
    </article>
  );
}

/** Fila de cuenta en vista de lista. */
export function AccountListRow({ a, priority }: { a: AccountCardView; priority?: boolean }) {
  return (
    <article className={cn("group overflow-hidden rounded-[16px] bg-ink-850 ring-1 ring-white/[0.07] transition hover:ring-white/20", !a.available && "opacity-80")}>
      <div className="flex flex-col sm:flex-row">
        <Cover a={a} priority={priority} className="w-full shrink-0 self-start sm:w-80" sizes="(min-width:640px) 320px, 100vw" />
        <div className="flex min-w-0 flex-1 flex-col gap-4 p-4 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <Link href={`/cuentas/${a.slug}`} className="line-clamp-2 text-[15.5px] font-semibold leading-snug hover:text-volt-300">
              {a.title}
            </Link>
            <div className="mt-2">
              <Facts a={a} long />
            </div>
          </div>
          <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
            <Price a={a} />
            <BuyButton a={a} />
          </div>
        </div>
      </div>
    </article>
  );
}
