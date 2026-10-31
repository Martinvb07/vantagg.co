import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Box, Clock, Images, PackageCheck, Shirt, ShieldCheck } from "lucide-react";
import { AccountPlaceholder } from "@/components/brand/illustrations";
import { CardSlides } from "@/components/store/card-slides";
import { RankEmblem } from "@/components/brand/rank-emblem";
import { DemoBadge } from "@/components/ui/primitives";
import { formatMoney, formatNumber } from "@/lib/money";
import { RegionFlag } from "@/components/brand/region-flag";
import { rankLabel, regionInfo } from "@/domain/freefire";
import { cn } from "@/lib/utils";
import type { AccountCardView } from "@/server/catalog";

/** Imagen con lo que más pesa al elegir: rango y nivel encima. Con varias fotos, se deslizan. */
function Cover({ a, className, sizes, priority = false, fill = false }: { a: AccountCardView; className?: string; sizes: string; priority?: boolean; fill?: boolean }) {
  const href = `/cuentas/${a.slug}`;
  const slides = a.images.length > 1;
  const cls = cn("relative block overflow-hidden bg-ink-750", className);
  // Con varias fotos cada foto es su propio enlace (así se puede deslizar sin abrir la ficha).
  const wrap = (body: ReactNode) =>
    slides ? (
      <div className={cls}>{body}</div>
    ) : (
      <Link href={href} className={cls} tabIndex={-1} aria-hidden>
        {body}
      </Link>
    );
  return wrap(
    <>
      {slides ? (
        <CardSlides href={href} images={a.images} sizes={sizes} priority={priority} fill={fill} />
      ) : a.image && fill ? (
        // Miniatura de alto fijo (vista de lista): recorta desde arriba, donde va el perfil del edit.
        <Image
          src={a.image.url}
          alt=""
          fill
          sizes={sizes}
          quality={85}
          priority={priority}
          unoptimized={a.image.url.endsWith(".svg")}
          className="object-cover object-top transition-transform duration-500 group-hover:scale-[1.04]"
        />
      ) : a.image ? (
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
        <div className={fill ? "absolute inset-0" : "aspect-video"}>
          <AccountPlaceholder />
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/75 to-transparent" />

      {a.rank && (
        <span className="pointer-events-none absolute left-2.5 top-2.5 inline-flex items-center gap-1.5 rounded-full bg-ink-950/75 py-1 pl-1 pr-2.5 text-[12px] font-semibold text-white ring-1 ring-white/10 backdrop-blur">
          <RankEmblem rank={a.rank} className="size-5" />
          {rankLabel(a.rank)}
        </span>
      )}
      {a.isDemo && <DemoBadge className="absolute right-2.5 top-2.5" />}

      <span className="pointer-events-none absolute bottom-2.5 left-3 flex items-baseline gap-1 text-white drop-shadow">
        {a.level != null && (
          <>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-white/70">Nivel</span>
            <span className="text-[22px] font-extrabold leading-none">{a.level}</span>
          </>
        )}
      </span>
      {a.imagesCount > 1 && !slides && (
        <span className="pointer-events-none absolute bottom-2.5 right-2.5 inline-flex items-center gap-1 rounded-md bg-ink-950/75 px-1.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur">
          <Images className="size-3" /> {a.imagesCount}
        </span>
      )}
      {a.reservedTemporarily && (
        <span className="pointer-events-none absolute inset-0 grid place-items-center bg-ink-950/55">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-ink-900 px-3 py-1 text-[12px] font-semibold text-warn-400 ring-1 ring-white/10">
            <Clock className="size-3.5" /> Reservada
          </span>
        </span>
      )}
    </>,
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

/** Dato corto de la fila de lista: etiqueta pequeña y valor. */
function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-[10px] bg-ink-800 px-3 py-2 ring-1 ring-white/[0.05]">
      <dt className="text-[10.5px] font-semibold uppercase tracking-wider text-fg-subtle">{label}</dt>
      <dd className="mt-0.5 flex items-center gap-1.5 truncate text-[13.5px] font-semibold tabular-nums">{children}</dd>
    </div>
  );
}

/** Fila de cuenta en vista de lista: miniatura de alto fijo, datos en recuadros y columna de compra. */
export function AccountListRow({ a, priority }: { a: AccountCardView; priority?: boolean }) {
  const region = regionInfo(a.region)?.label ?? a.region;
  return (
    <article
      className={cn(
        "group flex flex-col overflow-hidden rounded-[16px] bg-ink-850 ring-1 ring-white/[0.07] transition duration-300 hover:-translate-y-0.5 hover:ring-white/20 hover:shadow-[var(--shadow-lift)] sm:flex-row",
        !a.available && "opacity-80",
      )}
    >
      <Cover a={a} fill priority={priority} className="aspect-[16/10] w-full shrink-0 sm:aspect-auto sm:min-h-[184px] sm:w-[300px]" sizes="(min-width:640px) 300px, 100vw" />

      <div className="flex min-w-0 flex-1 flex-col justify-center p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2 text-[12px] font-medium">
          {a.inventoryVerified ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-ok-400/10 px-2 py-0.5 text-ok-400" title="El equipo revisó la cuenta">
              <ShieldCheck className="size-3.5" /> Revisada
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2 py-0.5 text-fg-muted" title="Te acompañamos en el traspaso">
              <PackageCheck className="size-3.5" /> Entrega asistida
            </span>
          )}
        </div>
        <Link href={`/cuentas/${a.slug}`} className="mt-2.5 line-clamp-2 text-[16.5px] font-bold leading-snug tracking-tight transition-colors hover:text-volt-300">
          {a.title}
        </Link>
        <dl className="mt-3.5 grid grid-cols-2 gap-2 lg:grid-cols-4">
          {a.level != null && <Stat label="Nivel">{a.level}</Stat>}
          {a.skinsCount != null && (
            <Stat label="Skins">
              <Shirt className="size-3.5 shrink-0 text-fg-subtle" /> {formatNumber(a.skinsCount)}
            </Stat>
          )}
          {a.chestsCount != null && (
            <Stat label="Pechos">
              <Box className="size-3.5 shrink-0 text-fg-subtle" /> {formatNumber(a.chestsCount)}
            </Stat>
          )}
          <Stat label="Servidor">
            <RegionFlag code={a.region} className="h-3 w-[18px]" />
            <span className="truncate" title={region}>
              {region}
            </span>
          </Stat>
        </dl>
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-white/[0.06] p-4 sm:w-[210px] sm:shrink-0 sm:flex-col sm:items-stretch sm:justify-center sm:border-l sm:border-t-0 sm:p-5">
        <div className="sm:text-right">
          <Price a={a} />
        </div>
        <div className="flex flex-col gap-2 sm:items-stretch [&>*]:justify-center">
          <BuyButton a={a} />
          <Link href={`/cuentas/${a.slug}`} className="hidden h-9 items-center rounded-full text-[13px] font-medium text-fg-muted transition-colors hover:bg-white/[0.05] hover:text-fg sm:inline-flex">
            Ver detalles
          </Link>
        </div>
      </div>
    </article>
  );
}
