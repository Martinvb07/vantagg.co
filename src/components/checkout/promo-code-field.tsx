"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Ticket, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { previewPromoAction } from "@/app/actions/store";

export type AppliedPromo = { code: string; discount: number } | null;

/**
 * Campo compacto de código promocional. Se muestra como un enlace y solo se
 * despliega si el cliente lo necesita. El descuento siempre lo calcula el servidor.
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
  const [pending, start] = useTransition();
  const lastItem = useRef(itemId);

  // Si cambia el producto, el descuento se recalcula en el servidor.
  useEffect(() => {
    if (lastItem.current === itemId) return;
    lastItem.current = itemId;
    if (!applied || !itemId) return;
    start(async () => {
      const r = await previewPromoAction({ code: applied.code, kind, itemId, email });
      if (r.ok) onChange({ code: r.code, discount: r.discount });
      else {
        onChange(null);
        setError(r.error);
        setOpen(true);
      }
    });
  }, [itemId, applied, kind, email, onChange]);

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

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 text-[13px] text-fg-muted underline-offset-4 hover:text-fg hover:underline">
        <Ticket className="size-3.5" /> ¿Tienes un código promocional?
      </button>
    );
  }

  return (
    <div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!itemId || code.trim().length < 4) return;
          setError(null);
          start(async () => {
            const r = await previewPromoAction({ code, kind, itemId, email });
            if (r.ok) {
              onChange({ code: r.code, discount: r.discount });
              setCode("");
            } else setError(r.error);
          });
        }}
      >
        <label htmlFor="promo" className="sr-only">
          Código promocional
        </label>
        <input
          id="promo"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 32))}
          placeholder="CÓDIGO"
          autoComplete="off"
          spellCheck={false}
          className="field h-10 flex-1 font-mono uppercase tracking-wider"
          aria-invalid={!!error}
        />
        <Button type="submit" variant="secondary" loading={pending} disabled={!itemId || code.length < 4}>
          Aplicar
        </Button>
      </form>
      {error && <p className="mt-1.5 text-[12.5px] text-bad-400">{error}</p>}
    </div>
  );
}
