import { BD, BR, EU, ID, IN, PK, TH, TW, VN } from "country-flag-icons/react/3x2";
import { Globe } from "lucide-react";
import { regionInfo } from "@/domain/freefire";
import { cn } from "@/lib/utils";

const FLAGS = { BR, EU, ID, IN, TH, VN, TW, PK, BD } as const;

/** Bandera real (licencia MIT) o insignia regional para servidores multipaís. */
export function RegionFlag({ code, className }: { code: string | null | undefined; className?: string }) {
  const info = regionInfo(code);
  const Flag = info?.flag ? FLAGS[info.flag as keyof typeof FLAGS] : null;
  if (Flag) return <Flag className={cn("h-3.5 w-[21px] shrink-0 rounded-[2px] shadow-[0_0_0_1px_rgba(255,255,255,0.12)]", className)} aria-hidden />;
  return (
    <span className={cn("grid h-3.5 w-[21px] shrink-0 place-items-center rounded-[2px] bg-sky-500/20 text-sky-300 shadow-[0_0_0_1px_rgba(255,255,255,0.12)]", className)} aria-hidden>
      <Globe className="size-2.5" />
    </span>
  );
}
