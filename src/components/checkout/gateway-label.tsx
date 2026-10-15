import { BoldLogo } from "@/components/brand/bold-logo";
import type { PublicPaymentOption } from "@/server/integrations/payments";

/** Logo de la pasarela en la opción de pago (Bold usa su logo oficial sobre fondo blanco). */
export function GatewayMark({ id }: { id: string }) {
  if (id !== "bold") return null;
  return (
    <span className="grid h-9 w-14 shrink-0 place-items-center rounded-[8px] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.25)]" aria-hidden>
      <BoldLogo tone="light" className="h-[14px]" />
    </span>
  );
}

/** Nombre visible de la pasarela y aviso si está en modo pruebas (sin cobros reales). */
export function GatewayTitle({ option }: { option: Pick<PublicPaymentOption, "id" | "name" | "test"> }) {
  const name = option.id === "bold" ? "Pago con Bold" : option.name;
  return (
    <>
      {name}
      {option.test && <span className="rounded-full bg-warn-400/12 px-2 py-0.5 text-[11px] font-semibold text-warn-400 ring-1 ring-warn-400/25">Modo pruebas</span>}
    </>
  );
}
