import { BD, BR, EU, ID, KH, MY, PH, SG, TH, TW, VN } from "country-flag-icons/react/3x2";
import { Globe } from "lucide-react";
import { cn } from "@/lib/utils";

const FLAGS = { BD, BR, EU, ID, KH, MY, PH, SG, TH, TW, VN } as const;

/** Bandera de la región de recarga (licencia MIT); globo para regiones multipaís como LATAM o MENA. */
export function TopupRegionFlag({ flag, className }: { flag: string | null | undefined; className?: string }) {
  const Flag = flag ? FLAGS[flag as keyof typeof FLAGS] : null;
  if (Flag) return <Flag className={cn("h-3.5 w-[21px] shrink-0 rounded-[2px] shadow-[0_0_0_1px_rgba(255,255,255,0.12)]", className)} aria-hidden />;
  return (
    <span className={cn("grid h-3.5 w-[21px] shrink-0 place-items-center rounded-[2px] bg-sky-500/20 text-sky-300 shadow-[0_0_0_1px_rgba(255,255,255,0.12)]", className)} aria-hidden>
      <Globe className="size-2.5" />
    </span>
  );
}
