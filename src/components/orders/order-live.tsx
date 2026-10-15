"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/primitives";
import { resumePaymentAction } from "@/app/actions/store";

/** Actualiza el estado automáticamente mientras el pedido no esté en un estado final. */
export function AutoRefresh({ active, intervalMs = 5000, maxTicks = 120, label = "Actualizando automáticamente" }: { active: boolean; intervalMs?: number; maxTicks?: number; label?: string }) {
  const router = useRouter();
  const [ticks, setTicks] = useState(0);
  useEffect(() => {
    if (!active || ticks > maxTicks) return;
    const t = setTimeout(() => {
      router.refresh();
      setTicks((n) => n + 1);
    }, intervalMs);
    return () => clearTimeout(t);
  }, [active, ticks, intervalMs, maxTicks, router]);
  if (!active) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-fg-subtle">
      <RefreshCw className="size-3 animate-spin [animation-duration:2.5s]" /> {label}
    </span>
  );
}

export function ResumePayment({ number, token }: { number: string; token: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      <Button
        size="lg"
        className="w-full sm:w-auto"
        loading={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await resumePaymentAction(number, token);
            if (!r.ok) return setError(r.error);
            if (r.redirectUrl.startsWith("/")) router.push(r.redirectUrl);
            else window.location.assign(r.redirectUrl);
          })
        }
      >
        <CreditCard className="size-4" /> Completar pago
      </Button>
      {error && <Alert tone="danger">{error}</Alert>}
    </div>
  );
}
