/* eslint-disable @next/next/no-img-element */
import { Crosshair, Crown, Flame, Gamepad2, Gem, Rocket, Shield, Skull, Star, Swords, Trophy, Zap, type LucideIcon } from "lucide-react";
import { AVATAR_PRESETS, type AvatarPresetKey } from "@/domain/avatars";
import { cn } from "@/lib/utils";

const ICONS: Record<AvatarPresetKey, LucideIcon> = {
  diamante: Gem,
  fuego: Flame,
  corona: Crown,
  rayo: Zap,
  escudo: Shield,
  calavera: Skull,
  mira: Crosshair,
  cohete: Rocket,
  estrella: Star,
  control: Gamepad2,
  trofeo: Trophy,
  espadas: Swords,
};

export type AvatarUser = { name?: string | null; email: string; avatarUrl?: string | null; avatarPreset?: string | null };

/** Color estable por correo para el avatar de iniciales. */
function hue(email: string) {
  let h = 0;
  for (const ch of email) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

export function initialsOf(u: AvatarUser) {
  const base = (u.name && u.name !== "No Name" ? u.name : u.email.split("@")[0]).trim();
  const parts = base.split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : (parts[0]?.[1] ?? ""))).toUpperCase() || "?";
}

export function PresetGlyph({ preset, className }: { preset: AvatarPresetKey; className?: string }) {
  const p = AVATAR_PRESETS.find((x) => x.key === preset)!;
  const Icon = ICONS[preset];
  return (
    <span className={cn("relative grid size-full place-items-center overflow-hidden", className)} style={{ background: `radial-gradient(120% 120% at 30% 20%, ${p.to}, ${p.from} 70%)` }}>
      <span className="absolute inset-x-0 top-0 h-1/2 bg-white/10" style={{ clipPath: "ellipse(80% 60% at 50% 0%)" }} />
      <Icon className="relative size-[52%] text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)]" strokeWidth={2.1} />
    </span>
  );
}

/** Avatar del cliente: foto subida, avatar de la galería o iniciales. */
export function UserAvatar({ user, size = 40, className, ring = true }: { user: AvatarUser; size?: number; className?: string; ring?: boolean }) {
  const preset = AVATAR_PRESETS.find((p) => p.key === user.avatarPreset)?.key;
  return (
    <span className={cn("relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full", ring && "ring-2 ring-white/15", className)} style={{ width: size, height: size }} aria-hidden>
      {user.avatarUrl ? (
        <img src={user.avatarUrl} alt="" className="size-full object-cover" width={size} height={size} />
      ) : preset ? (
        <PresetGlyph preset={preset} />
      ) : (
        <span
          className="grid size-full place-items-center font-display font-bold text-white"
          style={{ fontSize: size * 0.38, background: `linear-gradient(135deg, hsl(${hue(user.email)} 70% 45%), hsl(${(hue(user.email) + 50) % 360} 75% 30%))` }}
        >
          {initialsOf(user)}
        </span>
      )}
    </span>
  );
}
