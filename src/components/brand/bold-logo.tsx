/* eslint-disable @next/next/no-img-element */
import { cn } from "@/lib/utils";

/** Logo oficial de Bold (pasarela de pagos). En fondos oscuros va en blanco, como en su propio sitio. */
export function BoldLogo({ tone = "dark", className }: { tone?: "dark" | "light"; className?: string }) {
  return <img src={tone === "dark" ? "/pagos/bold-blanco.svg" : "/pagos/bold.svg"} alt="Bold" width={79} height={28} className={cn("block h-5 w-auto", className)} />;
}
