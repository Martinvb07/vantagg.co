/* eslint-disable @next/next/no-img-element */
import type { PaymentMethodId } from "@/domain/payment-methods";
import { cn } from "@/lib/utils";

/**
 * Logos de los medios de pago aceptados (archivos oficiales en /public/pagos, ver CREDITOS.txt).
 * Débito y crédito se muestran con las redes de tarjeta (Visa y Mastercard).
 */
const LOGOS = {
  visa: { src: "/pagos/visa.svg", alt: "Visa", pad: "px-1.5 py-[7px]" },
  mastercard: { src: "/pagos/mastercard.svg", alt: "Mastercard", pad: "px-2 py-1" },
  nequi: { src: "/pagos/nequi.svg", alt: "Nequi", pad: "px-1.5 py-[7px]" },
  pse: { src: "/pagos/pse.jpg", alt: "PSE", pad: "p-[3px]" },
  bancolombia: { src: "/pagos/bancolombia.svg", alt: "Botón Bancolombia", pad: "px-1" },
  breb: { src: "/pagos/bre-b.png", alt: "Bre-B", pad: "px-0.5" },
} as const;
type LogoKey = keyof typeof LOGOS;

function logosFor(methods: PaymentMethodId[]): LogoKey[] {
  const out: LogoKey[] = [];
  if (methods.includes("debito") || methods.includes("credito")) out.push("visa", "mastercard");
  if (methods.includes("nequi")) out.push("nequi");
  if (methods.includes("pse")) out.push("pse");
  if (methods.includes("bancolombia")) out.push("bancolombia");
  if (methods.includes("breb")) out.push("breb");
  return out;
}

export function PaymentBadges({ methods, size = "md", className }: { methods: PaymentMethodId[]; size?: "sm" | "md"; className?: string }) {
  const logos = logosFor(methods);
  if (!logos.length) return null;
  return (
    <ul className={cn("flex flex-wrap items-center gap-1.5", className)} aria-label="Medios de pago aceptados">
      {logos.map((key) => {
        const l = LOGOS[key];
        return (
          <li key={key} title={l.alt}>
            <span
              className={cn(
                // flex (no grid): así la altura fija se pasa a la imagen y object-contain no recorta
                "flex items-center justify-center overflow-hidden rounded-[6px] shadow-[0_1px_2px_rgba(0,0,0,0.25)] ring-1 ring-black/5",
                size === "sm" ? "h-7 w-11" : "h-9 w-[58px]",
                key === "breb" ? "bg-[#2c0259]" : "bg-white",
                l.pad,
              )}
            >
              <img src={l.src} alt={l.alt} loading="lazy" decoding="async" className="h-full w-full min-h-0 min-w-0 object-contain" />
            </span>
          </li>
        );
      })}
    </ul>
  );
}
