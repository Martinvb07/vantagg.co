"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Check, CircleAlert, Info, Lock, MapPin, ShieldCheck } from "lucide-react";
import { DiamondCover, tierFor } from "@/components/brand/covers";
import { Button } from "@/components/ui/button";
import { Alert, DemoBadge } from "@/components/ui/primitives";
import { PRODUCT_LABELS } from "@/domain/labels";
import { formatMoney, formatNumber } from "@/lib/money";
import { cn } from "@/lib/utils";
import { createTopUpOrderAction, validatePlayerAction, type PlayerCheck } from "@/app/actions/store";
import type { PackageView, TopupRegionView } from "@/server/catalog";
import { TopupRegionFlag } from "@/components/brand/topup-region-flag";
import { BoldLogo } from "@/components/brand/bold-logo";
import { GatewayMark, GatewayTitle } from "@/components/checkout/gateway-label";
import type { PublicPaymentOption } from "@/server/integrations/payments";
import { PromoCodeField, type AppliedPromo } from "./promo-code-field";
import { PaymentBadges } from "@/components/brand/payment-badges";
import { paymentMethodsSentence, type PaymentMethodId } from "@/domain/payment-methods";

/** Último ID de jugador y correo usados en este dispositivo (solo en el navegador del cliente). */
const MEMORY_KEY = "vx_checkout_v1";

type Props = {
  packages: PackageView[];
  regions: TopupRegionView[];
  initialRegion: string;
  payments: PublicPaymentOption[];
  topupEnabled: boolean;
  initialSlug?: string;
  initialPlayerId?: string;
  defaultEmail?: string;
  methods: PaymentMethodId[];
};

/** "Tarjeta, Nequi, PSE y Bancolombia" (corto, para la tarjeta de la pasarela). */
function shortMethods(ids: PaymentMethodId[]) {
  const names = [ids.includes("debito") || ids.includes("credito") ? "Tarjeta" : null, ids.includes("nequi") ? "Nequi" : null, ids.includes("pse") ? "PSE" : null, ids.includes("bancolombia") ? "Bancolombia" : null, ids.includes("breb") ? "Bre-B" : null].filter(Boolean) as string[];
  if (names.length === 0) return "Tarjeta, Nequi y PSE";
  return names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
}

function Block({ id, title, aside, children }: { id: string; title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-white/[0.06] px-4 py-5 first:border-t-0 sm:px-6">
      <div className="mb-3.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function PackageOption({ p, selected, onSelect }: { p: PackageView; selected: boolean; onSelect: () => void }) {
  const tag = PRODUCT_LABELS[p.label];
  return (
    <label
      className={cn(
        "relative flex items-center gap-3 rounded-[10px] border p-2 pr-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-volt-400",
        p.available ? "cursor-pointer" : "cursor-not-allowed opacity-45",
        selected ? "border-volt-400 bg-volt-400/[0.07]" : "border-white/[0.08] bg-ink-800 hover:border-white/20",
      )}
    >
      <input type="radio" name="package" className="sr-only" checked={selected} disabled={!p.available} onChange={onSelect} />
      <div className="w-12 shrink-0 overflow-hidden rounded-md sm:w-14">
        <DiamondCover tier={tierFor(p.diamonds)} diamonds={p.diamonds} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[16px] font-bold tabular-nums leading-tight">
          {formatNumber(p.diamonds)}
          {p.bonusDiamonds > 0 && <span className="text-sky-400"> + {formatNumber(p.bonusDiamonds)} Bonus</span>}
        </p>
        <p className="mt-0.5 truncate text-[11.5px] text-fg-muted">
          {p.available ? `Recibes ${formatNumber(p.diamonds + p.bonusDiamonds)} diamantes` : "Agotado"}
        </p>
        {p.isDemo && <DemoBadge className="mt-1" label="PRECIO DEMO" />}
      </div>
      <div className="text-right">
        {p.quote.original != null && <p className="text-[11px] tabular-nums text-fg-subtle line-through">{formatMoney(p.quote.original, p.currency)}</p>}
        <p className="text-[15px] font-bold tabular-nums">{formatMoney(p.quote.price, p.currency)}</p>
      </div>
      {tag && p.available && (
        <span className="absolute -top-2 left-[68px] rounded-full bg-volt-400 sm:left-[76px] px-2 py-px text-[10px] font-bold uppercase tracking-wide text-volt-ink">{tag}</span>
      )}
      {selected && (
        <span className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-volt-400 text-volt-ink ring-2 ring-ink-850">
          <Check className="size-3" strokeWidth={3} />
        </span>
      )}
    </label>
  );
}

export function TopUpCheckout({ packages: allPackages, regions, initialRegion, payments, topupEnabled, initialSlug, initialPlayerId, defaultEmail, methods }: Props) {
  const router = useRouter();
  const initial = allPackages.find((p) => p.slug === initialSlug && p.available) ?? null;
  const [region, setRegion] = useState(initial?.region ?? initialRegion);
  const [regionNotice, setRegionNotice] = useState<string | null>(null);
  const packages = useMemo(() => allPackages.filter((p) => p.region === region), [allPackages, region]);
  const multiRegion = regions.length > 1;
  const regionInfo = regions.find((r) => r.slug === region);
  const [pkgId, setPkgId] = useState<string | null>(initial?.id ?? null);
  const [playerId, setPlayerId] = useState(initialPlayerId && /^[0-9]{6,12}$/.test(initialPlayerId) ? initialPlayerId : "");
  const [player, setPlayer] = useState<Extract<PlayerCheck, { ok: true }> | null>(null);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [confirmedId, setConfirmedId] = useState(false);
  const [provider, setProvider] = useState<string | null>(payments.length === 1 ? payments[0].id : null);
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [accept, setAccept] = useState(false);
  const [promo, setPromo] = useState<AppliedPromo>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, startCheck] = useTransition();
  const [submitting, startSubmit] = useTransition();
  const idRef = useRef<HTMLInputElement>(null);
  const checkSeq = useRef(0);
  const regionRow = useRef<HTMLDivElement>(null);
  const [fromMemory, setFromMemory] = useState(false);

  // Compra repetida en este dispositivo: se rellenan el último ID y correo, salvo que vengan del enlace o de la cuenta.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(MEMORY_KEY) ?? "null") as { playerId?: string; email?: string } | null;
      if (!saved) return;
      if (!initialPlayerId && saved.playerId && /^\d{6,12}$/.test(saved.playerId)) {
        setPlayerId(saved.playerId);
        setFromMemory(true);
      }
      if (!defaultEmail && typeof saved.email === "string" && saved.email.length <= 160) setEmail(saved.email);
    } catch {
      // Sin almacenamiento disponible: el formulario empieza vacío.
    }
  }, [initialPlayerId, defaultEmail]);

  // En celular las regiones van en una fila deslizable: se centra la elegida (también si cambió sola al verificar el ID).
  useEffect(() => {
    const row = regionRow.current;
    const chip = row?.querySelector<HTMLElement>("[aria-checked=\"true\"]");
    if (!row || !chip || row.scrollWidth <= row.clientWidth) return;
    row.scrollTo({ left: chip.offsetLeft - row.offsetLeft - row.clientWidth / 2 + chip.offsetWidth / 2, behavior: "smooth" });
  }, [region]);

  const pkg = packages.find((p) => p.id === pkgId) ?? null;

  // El ID que ya venía escrito (enlace, cuenta o último usado en este dispositivo) se verifica solo, una vez.
  const autoChecked = useRef(false);
  useEffect(() => {
    if (autoChecked.current || !topupEnabled || !/^\d{6,12}$/.test(playerId)) return;
    autoChecked.current = true;
    verifyPlayer(playerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerId, topupEnabled]);

  // El paquete elegido queda en la dirección: al recargar la página o compartir el enlace se conserva.
  useEffect(() => {
    const slug = allPackages.find((p) => p.id === pkgId)?.slug;
    const url = new URL(window.location.href);
    if (slug) url.searchParams.set("paquete", slug);
    else url.searchParams.delete("paquete");
    if (url.href !== window.location.href) window.history.replaceState(window.history.state, "", url);
  }, [pkgId, allPackages]);
  // La cuenta verificada es de otra región que la elegida.
  const regionMismatch = !!player?.regionSlug && player.regionSlug !== region;
  const validId = /^\d{6,12}$/.test(playerId);
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
  const total = pkg ? pkg.quote.price - (promo?.discount ?? 0) : 0;
  const ready = !!pkg && !!player && !regionMismatch && confirmedId && !!provider && emailOk && accept;
  const onPromo = useCallback((p: AppliedPromo) => setPromo(p), []);

  // Clave de idempotencia nueva cada vez que cambian los datos del pedido.
  const idempotencyKey = useMemo(
    () => crypto.randomUUID(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pkgId, playerId, provider, email, promo?.code],
  );

  function switchRegion(next: string) {
    if (next === region) return;
    const current = allPackages.find((p) => p.id === pkgId);
    const same = current && allPackages.find((p) => p.region === next && p.available && p.diamonds + p.bonusDiamonds === current.diamonds + current.bonusDiamonds);
    setRegion(next);
    setPkgId(same ? same.id : null);
    setPromo(null);
  }

  function verifyPlayer(value = playerId) {
    if (!/^\d{6,12}$/.test(value)) return;
    const id = value;
    const seq = ++checkSeq.current;
    setPlayerError(null);
    setPlayer(null);
    setConfirmedId(false);
    setRegionNotice(null);
    startCheck(async () => {
      const r = await validatePlayerAction(id, region);
      // Respuesta de una verificación anterior (el ID cambió o se verificó de nuevo): se descarta.
      if (seq !== checkSeq.current) return;
      if (!r.ok) return setPlayerError(r.error);
      if (r.playerId !== id) return;
      if (r.regionSlug && r.regionSlug !== region) {
        const target = regions.find((x) => x.slug === r.regionSlug);
        if (!target) {
          return setPlayerError(`Esta cuenta es de ${r.regionLabel ?? r.region}. Por ahora no tenemos recargas para esa región.`);
        }
        switchRegion(target.slug);
        setRegionNotice(`Tu cuenta es de ${target.label}: te mostramos los paquetes de esa región.`);
      } else if (!r.regionSlug && r.regionMatch === "wrong") {
        return setPlayerError(`Esta cuenta es de ${r.region ?? "otra región"}. Por ahora no tenemos recargas para esa región.`);
      }
      setPlayer(r);
    });
  }

  function submit() {
    if (!pkg || !provider) return;
    setError(null);
    startSubmit(async () => {
      const r = await createTopUpOrderAction({
        packageId: pkg.id,
        playerId,
        email: email.trim(),
        paymentProvider: provider,
        idempotencyKey,
        promoCode: promo?.code,
        acceptTerms: accept,
      });
      if (!r.ok) return setError(r.error);
      try {
        localStorage.setItem(MEMORY_KEY, JSON.stringify({ playerId, email: email.trim() }));
      } catch {
        // Sin almacenamiento: la próxima vez simplemente no se rellena.
      }
      if (r.redirectUrl.startsWith("/")) router.push(r.redirectUrl);
      else window.location.assign(r.redirectUrl);
    });
  }

  const payClosed = payments.length === 0;
  const missing = !pkg ? "Elige una cantidad" : !player ? "Verifica tu ID" : regionMismatch ? "Cambia a la región de tu cuenta" : !confirmedId ? "Confirma tu ID" : payClosed ? "Pagos en activación" : !provider ? "Elige cómo pagar" : !emailOk ? "Escribe tu correo" : !accept ? "Acepta los términos" : null;
  // Solo se oculta el formulario si las recargas están apagadas; sin pasarela se ve todo pero no se puede pagar.
  const closed = !topupEnabled;

  return (
    <div className="overflow-hidden rounded-[16px] bg-ink-850 ring-1 ring-white/[0.08]">
      {(closed || payClosed) && (
        <div className="p-4 sm:px-6">
          <Alert tone={!topupEnabled ? "warning" : "info"} title={!topupEnabled ? "Recargas temporalmente no disponibles" : "Estamos activando los pagos"}>
            {!topupEnabled ? "Puedes ver los precios, pero no es posible comprar en este momento." : "Muy pronto podrás comprar aquí. Mientras tanto puedes ver los paquetes y precios."}
          </Alert>
        </div>
      )}

      {multiRegion && (
        <Block id="region" title="1. Región de tu cuenta" aside={<span className="text-[12px] text-fg-subtle">¿No la sabes? Verifica tu ID y la detectamos</span>}>
          <div
            ref={regionRow}
            role="radiogroup"
            aria-label="Región de la cuenta de Free Fire"
            className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden"
          >
            {regions.map((r) => {
              const on = r.slug === region;
              return (
                <button
                  key={r.slug}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  // Con el ID verificado, la región queda fija en la de la cuenta (otra región no le llega).
                  disabled={!!player?.regionSlug && r.slug !== player.regionSlug}
                  title={player?.regionSlug && r.slug !== player.regionSlug ? `Tu cuenta es de ${player.regionLabel ?? player.region}` : undefined}
                  onClick={() => {
                    switchRegion(r.slug);
                    setRegionNotice(null);
                  }}
                  className={cn(
                    "inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3.5 text-[13px] font-medium transition-colors",
                    on ? "border-volt-400 bg-volt-400/[0.1] text-fg" : "border-white/[0.1] bg-ink-800 text-fg-muted hover:border-white/25 hover:text-fg",
                    "disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-white/[0.1] disabled:hover:text-fg-muted",
                  )}
                >
                  <TopupRegionFlag flag={r.flag} />
                  {r.label}
                  {on && <Check className="size-3.5 text-volt-300" strokeWidth={3} />}
                </button>
              );
            })}
          </div>
          {regionNotice && (
            <p className="mt-2.5 flex items-center gap-1.5 text-[12.5px] text-sky-300">
              <MapPin className="size-3.5" /> {regionNotice}
            </p>
          )}
        </Block>
      )}

      <Block
        id="cantidad"
        title={`${multiRegion ? 2 : 1}. Elige la cantidad`}
        aside={<span className="text-[12px] text-fg-subtle">{multiRegion && regionInfo ? `${regionInfo.label} · ` : ""}Precio final, impuestos incluidos</span>}
      >
        <div role="radiogroup" aria-label="Cantidad de diamantes" className="grid grid-cols-[minmax(0,1fr)] gap-2.5 sm:grid-cols-2">
          {packages.map((p) => (
            <PackageOption
              key={p.id}
              p={p}
              selected={p.id === pkgId}
              onSelect={() => {
                setPkgId(p.id);
                if (!player) setTimeout(() => idRef.current?.focus({ preventScroll: true }), 50);
              }}
            />
          ))}
        </div>
      </Block>

      {!closed && (
        <>
          <Block id="id-jugador" title={`${multiRegion ? 3 : 2}. ID de jugador`}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                verifyPlayer();
              }}
              className="flex flex-col gap-2 sm:flex-row"
            >
              <label htmlFor="playerId" className="sr-only">
                ID de jugador de Free Fire
              </label>
              <input
                ref={idRef}
                id="playerId"
                inputMode="numeric"
                autoComplete="off"
                maxLength={12}
                placeholder="Tu ID, ej. 123456789"
                value={playerId}
                aria-invalid={!!playerError || (playerId.length > 0 && !validId)}
                aria-describedby="playerId-hint"
                onChange={(e) => {
                  checkSeq.current++; // invalida una verificación en curso del ID anterior
                  autoChecked.current = true; // el cliente lo está escribiendo: no se verifica solo a mitad
                  setPlayerId(e.target.value.replace(/\D/g, ""));
                  setFromMemory(false);
                  setPlayer(null);
                  setPlayerError(null);
                  setConfirmedId(false);
                }}
                // Pegar el ID (lo más común: se copia del juego) lo verifica sin tener que tocar «Verificar».
                onPaste={() => {
                  // Se verifica lo que quedó en el campo después de pegar (no solo lo pegado).
                  setTimeout(() => verifyPlayer((idRef.current?.value ?? "").replace(/\D/g, "")), 0);
                }}
                onBlur={(e) => {
                  // Si sale del campo para tocar «Verificar», ese botón ya lo hace.
                  if (e.relatedTarget?.getAttribute("type") === "submit") return;
                  if (validId && !player && !checking && !playerError) verifyPlayer();
                }}
                className="field h-11 flex-1 bg-ink-800 font-mono text-[15px] tracking-wider"
              />
              <Button type="submit" size="lg" className="h-11" variant={player ? "secondary" : "primary"} disabled={!validId} loading={checking}>
                {player ? "Verificar de nuevo" : "Verificar"}
              </Button>
            </form>
            <p id="playerId-hint" className={cn("mt-1.5 text-[12px]", playerError ? "text-bad-400" : "text-fg-subtle")}>
              {playerError ?? (fromMemory ? "Es el último ID que usaste en este dispositivo. Verifícalo o escribe otro." : "Lo verificamos con el proveedor antes de que pagues.")}
            </p>

            {player && (
              <div className="mt-3 animate-fade-up rounded-[10px] bg-ink-800 p-3.5 ring-1 ring-white/[0.06]">
                {player.nickname && (
                  <div className="mb-2.5 flex items-center gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-ok-400/12 text-ok-400 ring-1 ring-ok-400/25">
                      <BadgeCheck className="size-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[11.5px] text-fg-subtle">Nombre de la cuenta</span>
                      <span className="block truncate text-[16px] font-bold">{player.nickname}</span>
                    </span>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[13.5px]">
                  {!player.nickname && (
                    <span className="flex items-center gap-1.5 font-semibold">
                      {player.verifiable ? <BadgeCheck className="size-4 text-ok-400" /> : <CircleAlert className="size-4 text-warn-400" />}
                      {player.verifiable ? "ID verificado" : "ID sin verificar"}
                    </span>
                  )}
                  <span className="font-mono text-fg-muted">ID {player.playerId}</span>
                  {(player.regionLabel ?? player.region) && (
                    <span className="inline-flex items-center gap-1.5 text-fg-muted">
                      <MapPin className="size-3.5" /> {player.regionLabel ?? player.region}
                    </span>
                  )}
                </div>
                {regionMismatch && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-2 rounded-lg bg-warn-400/[0.08] px-3 py-2 text-[12.5px] text-warn-400 ring-1 ring-warn-400/20">
                    <CircleAlert className="size-4 shrink-0" />
                    Esta cuenta es de {player.regionLabel ?? player.region}; los diamantes de otra región no le llegan.
                    <button type="button" className="font-semibold underline underline-offset-2" onClick={() => player.regionSlug && switchRegion(player.regionSlug)}>
                      Cambiar a {player.regionLabel ?? player.region}
                    </button>
                  </div>
                )}
                {!player.verifiable && <p className="mt-1.5 text-[12px] text-warn-400">{player.message ?? "No fue posible verificar el ID. Revísalo con cuidado."}</p>}
                {!player.nickname && player.verifiable && (
                  <p className="mt-2.5 flex gap-2 rounded-lg bg-sky-400/[0.06] px-3 py-2 text-[12.5px] leading-relaxed text-fg-muted ring-1 ring-sky-400/20">
                    <Info className="mt-0.5 size-4 shrink-0 text-sky-300" />
                    <span>
                      <strong className="font-semibold text-fg">¿Por qué no aparece tu nombre?</strong> El sistema del juego no nos entrega el apodo actualizado, así que no lo mostramos para no confundirte. Lo importante ya está confirmado: <strong className="font-semibold text-fg">el ID existe y es de {player.regionLabel ?? player.region ?? "una región disponible"}</strong>. Si el ID es el tuyo, los diamantes llegan a tu cuenta.
                    </span>
                  </p>
                )}
                <p className="mt-1.5 text-[11.5px] text-fg-subtle">{player.nickname ? "Revisa que el nombre y el ID sean los de tu cuenta: la recarga llega a ese ID." : "Revisa que el ID sea exactamente el de tu cuenta: la recarga llega a ese ID."}</p>
                <label className="mt-2.5 flex cursor-pointer items-start gap-2.5 text-[13px] text-fg-muted">
                  <input type="checkbox" className="mt-0.5 size-4 accent-[#c8f04f]" checked={confirmedId} onChange={(e) => setConfirmedId(e.target.checked)} />
                  Es mi cuenta. Entiendo que una recarga a un ID equivocado no se puede revertir.
                </label>
              </div>
            )}
          </Block>

          <Block id="pago" title={`${multiRegion ? 4 : 3}. Medio de pago`} aside={<PaymentBadges methods={methods} size="sm" className="hidden sm:flex" />}>
            <PaymentBadges methods={methods} size="sm" className="mb-3 sm:hidden" />
            {payClosed && (
              <div className="flex items-center gap-3.5 rounded-[12px] border border-white/[0.08] bg-ink-800/70 p-3">
                <span className="grid h-12 w-[72px] shrink-0 place-items-center rounded-[10px] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.25)]">
                  <BoldLogo tone="light" className="h-[18px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2 text-[14px] font-semibold">
                    Pago con Bold
                    <span className="rounded-full bg-sky-400/10 px-2 py-0.5 text-[11px] font-semibold text-sky-300 ring-1 ring-sky-400/25">Próximamente</span>
                  </span>
                  <span className="mt-0.5 block text-[12.5px] text-fg-muted">{shortMethods(methods)}. Estamos activando los pagos.</span>
                </span>
              </div>
            )}
            <div role="radiogroup" aria-label="Medio de pago" className="grid grid-cols-[minmax(0,1fr)] gap-2.5 sm:grid-cols-2">
              {payments.map((p) => (
                <label
                  key={p.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-[10px] border bg-ink-800 px-3.5 py-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-volt-400",
                    provider === p.id ? "border-volt-400" : "border-white/[0.08] hover:border-white/20",
                  )}
                >
                  <input type="radio" name="provider" className="sr-only" checked={provider === p.id} onChange={() => setProvider(p.id)} />
                  <span className={cn("grid size-4 shrink-0 place-items-center rounded-full border-2", provider === p.id ? "border-volt-400" : "border-white/25")}>
                    {provider === p.id && <span className="size-1.5 rounded-full bg-volt-400" />}
                  </span>
                  <GatewayMark id={p.id} />
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2 text-[14px] font-semibold">
                      <GatewayTitle option={p} />
                    </span>
                    <span className="block truncate text-[12px] text-fg-muted">{methods.length ? (p.id === "bold" ? shortMethods(methods) : paymentMethodsSentence(methods)) : p.methods}</span>
                  </span>
                </label>
              ))}
            </div>
          </Block>

          <Block id="confirmar" title={`${multiRegion ? 5 : 4}. Tus datos y pago`}>
            <label htmlFor="email" className="sr-only">
              Correo
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className="field h-11 bg-ink-800"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Correo para recibir el pedido"
              aria-invalid={email.length > 3 && !emailOk}
            />

            <div className="mt-3">
              <PromoCodeField kind="TOPUP" itemId={pkgId} email={emailOk ? email.trim() : undefined} applied={promo} onChange={onPromo} />
            </div>

            {pkg && (
              <dl className="mt-4 space-y-1.5 text-[13.5px]">
                <div className="flex justify-between text-fg-muted">
                  <dt>
                    {formatNumber(pkg.diamonds)}{pkg.bonusDiamonds ? ` + ${formatNumber(pkg.bonusDiamonds)} bonus` : ""} diamantes{multiRegion && regionInfo ? ` · ${regionInfo.label}` : ""}{player ? ` → ${playerId}` : ""}
                  </dt>
                  <dd className="tabular-nums">{formatMoney(pkg.quote.price, pkg.currency)}</dd>
                </div>
                {promo && (
                  <div className="flex justify-between text-volt-300">
                    <dt>
                      Código <span className="font-mono">{promo.code}</span>
                    </dt>
                    <dd className="tabular-nums">−{formatMoney(promo.discount, pkg.currency)}</dd>
                  </div>
                )}
                <div className="flex items-baseline justify-between border-t border-white/[0.06] pt-2.5">
                  <dt className="font-semibold">Total</dt>
                  <dd className="text-2xl font-bold tabular-nums">{formatMoney(total, pkg.currency)}</dd>
                </div>
              </dl>
            )}

            <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-[12.5px] text-fg-muted">
              <input type="checkbox" className="mt-0.5 size-4 accent-[#c8f04f]" checked={accept} onChange={(e) => setAccept(e.target.checked)} />
              <span>
                Acepto los{" "}
                <a href="/legal/terminos" target="_blank" className="text-fg underline underline-offset-2">
                  términos
                </a>{" "}
                y la{" "}
                <a href="/legal/reembolsos" target="_blank" className="text-fg underline underline-offset-2">
                  política de reembolsos
                </a>
                , autorizo el tratamiento de mis datos según la{" "}
                <a href="/legal/privacidad" target="_blank" className="text-fg underline underline-offset-2">
                  política de privacidad
                </a>{" "}
                y soy mayor de edad o compro con autorización de mi padre, madre o acudiente.
              </span>
            </label>

            {error && (
              <Alert tone="danger" className="mt-3">
                {error}
              </Alert>
            )}

            <Button type="button" size="lg" className="mt-4 h-12 w-full text-[15px]" onClick={submit} disabled={!ready} loading={submitting}>
              <Lock className="size-4" />
              {ready && pkg ? `Comprar · ${formatMoney(total, pkg.currency)}` : (missing ?? "Comprar")}
            </Button>
            <p className="mt-2.5 flex items-center justify-center gap-1.5 text-[11.5px] text-fg-subtle">
              <ShieldCheck className="size-3.5" /> Pagas en la plataforma de la pasarela. No guardamos datos de tarjetas.
            </p>
          </Block>
        </>
      )}

      {/* Barra móvil */}
      {pkg && !closed && (
        <div data-paybar className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.08] bg-ink-900/95 px-4 pt-3 backdrop-blur lg:hidden" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
          <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[12px] text-fg-muted">{formatNumber(pkg.diamonds + pkg.bonusDiamonds)} diamantes</p>
              <p className="text-lg font-bold tabular-nums">{formatMoney(total, pkg.currency)}</p>
            </div>
            <Button
              type="button"
              onClick={() => (ready ? submit() : document.getElementById(!player || regionMismatch || !confirmedId ? "id-jugador" : !provider ? "pago" : "confirmar")?.scrollIntoView({ behavior: "smooth" }))}
              loading={submitting}
            >
              {ready ? "Comprar" : "Continuar"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
