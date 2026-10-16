"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Info, Ticket, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { previewPromoAction } from "@/app/actions/store";

export type AppliedPromo = { code: string; discount: number } | null;

/**
 * Campo compacto de código promocional. Se muestra como un enlace y solo se
 * despliega si el cliente lo necesita. El descuento siempre lo calcula el servidor.
 * No es un <form>: suele ir dentro del formulario de compra y un formulario anidado
 * haría que «Aplicar» enviara la compra.
 */
export function PromoCodeField({
  kind,
  itemId,
  email,
  applied,
  onChange,
}: {
  kind: "TOPUP" | "ACCOUNT";
  itemId: string | null;
  email?: string;
  applied: AppliedPromo;
  onChange: (p: AppliedPromo) => void;
}) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Código escrito antes de elegir el producto: se aplica en cuanto se elija.
  const [waiting, setWaiting] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const lastItem = useRef(itemId);

  const apply = useCallback(
    (raw: string, item: string) => {
      setError(null);
      start(async () => {
        const r = await previewPromoAction({ code: raw, kind, itemId: item, email });
        if (r.ok) {
          onChange({ code: r.code, discount: r.discount });
          setCode("");
          setWaiting(null);
        } else {
          setWaiting(null);
          setCode(raw);
          setOpen(true);
          setError(r.error);
        }
      });
    },
    [kind, email, onChange],
  );

  // Si cambia el producto, el descuento se recalcula en el servidor (o se aplica el código en espera).
  useEffect(() => {
    if (lastItem.current === itemId) return;
    lastItem.current = itemId;
    if (!itemId) return;
    if (waiting) return apply(waiting, itemId);
    if (!applied) return;
    start(async () => {
      const r = await previewPromoAction({ code: applied.code, kind, itemId, email });
      if (r.ok) onChange({ code: r.code, discount: r.discount });
      else {
        onChange(null);
        setCode(applied.code);
        setError(r.error);
        setOpen(true);
      }
    });
  }, [itemId, applied, waiting, apply, kind, email, onChange]);

  const submit = () => {
    const c = code.trim();
    if (c.length < 4) return setError("Escribe el código completo.");
    if (!itemId) {
      setError(null);
      setWaiting(c);
      return;
    }
    apply(c, itemId);
  };

  if (applied) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-volt-400/30 bg-volt-400/[0.06] px-3 py-2 text-[13px]">
        <span className="flex items-center gap-2">
          <Ticket className="size-4 text-volt-300" />
          <span className="font-mono font-semibold tracking-wider">{applied.code}</span>
          <span className="text-volt-300">−{formatMoney(applied.discount)}</span>
        </span>
        <button type="button" onClick={() => onChange(null)} className="grid size-7 place-items-center rounded-md text-fg-muted hover:bg-white/5 hover:text-fg" aria-label="Quitar código">
          <X className="size-4" />
        </button>
      </div>
    );
  }

  if (waiting) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-sky-400/25 bg-sky-400/[0.06] px-3 py-2 text-[13px]">
        <span className="flex min-w-0 items-center gap-2 text-sky-300">
          <Info className="size-4 shrink-0" />
          <span className="min-w-0">
            <span className="font-mono font-semibold tracking-wider">{waiting}</span> se aplicará cuando elijas {kind === "TOPUP" ? "la cantidad de diamantes" : "la cuenta"}.
          </span>
        </span>
        <button type="button" onClick={() => setWaiting(null)} className="grid size-7 shrink-0 place-items-center rounded-md text-fg-muted hover:bg-white/5 hover:text-fg" aria-label="Quitar código">
          <X className="size-4" />
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 text-[13px] text-fg-muted underline-offset-4 hover:text-fg hover:underline">
        <Ticket className="size-3.5" /> ¿Tienes un código promocional?
      </button>
    );
  }

  return (
    <div>
      <div className="flex gap-2">
        <label htmlFor="promo" className="sr-only">
          Código promocional
        </label>
        <input
          id="promo"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 32));
            if (error) setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="CÓDIGO"
          autoComplete="off"
          spellCheck={false}
          autoFocus
          className="field h-10 flex-1 font-mono uppercase tracking-wider"
          aria-invalid={!!error}
          aria-describedby={error ? "promo-error" : undefined}
        />
        <Button type="button" variant="secondary" loading={pending} disabled={!code.trim()} onClick={submit}>
          Aplicar
        </Button>
      </div>
      {error && (
        <p id="promo-error" role="alert" className="mt-1.5 text-[12.5px] text-bad-400">
          {error}
        </p>
      )}
    </div>
  );
}
