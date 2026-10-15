import type { RankId } from "./freefire";

/**
 * Perfil de jugador del cliente: rango por compras confirmadas, logros y portadas.
 * Todo se calcula con datos reales del cliente; el rango no promete beneficios.
 */

export const CUSTOMER_RANKS: Array<{ id: RankId; label: string; min: number; color: string }> = [
  { id: "BRONCE", label: "Bronce", min: 0, color: "#e9a46a" },
  { id: "PLATA", label: "Plata", min: 30_000, color: "#cbd5e1" },
  { id: "ORO", label: "Oro", min: 100_000, color: "#facc15" },
  { id: "PLATINO", label: "Platino", min: 250_000, color: "#7dd3fc" },
  { id: "DIAMANTE", label: "Diamante", min: 600_000, color: "#a78bfa" },
  { id: "HEROICO", label: "Heroico", min: 1_500_000, color: "#fb7185" },
  { id: "GRAN_MAESTRO", label: "Gran Maestro", min: 4_000_000, color: "#fbbf24" },
];

export function customerRank(spent: number) {
  let i = 0;
  while (i + 1 < CUSTOMER_RANKS.length && spent >= CUSTOMER_RANKS[i + 1].min) i++;
  const current = CUSTOMER_RANKS[i];
  const next = CUSTOMER_RANKS[i + 1] ?? null;
  const progress = next ? Math.min(1, (spent - current.min) / (next.min - current.min)) : 1;
  return { current, next, progress, missing: next ? next.min - spent : 0 };
}

export const PROFILE_THEMES = [
  { key: "neon", label: "Neón", bg: "radial-gradient(120% 140% at 0% 0%, rgba(200,240,79,0.35), transparent 55%), radial-gradient(120% 140% at 100% 0%, rgba(56,140,255,0.45), transparent 55%), linear-gradient(135deg,#0b1220,#101a10)" },
  { key: "fuego", label: "Fuego", bg: "radial-gradient(120% 140% at 10% 0%, rgba(251,146,60,0.55), transparent 55%), radial-gradient(100% 120% at 100% 100%, rgba(220,38,38,0.45), transparent 60%), linear-gradient(135deg,#1c0a05,#2a0d0d)" },
  { key: "hielo", label: "Hielo", bg: "radial-gradient(120% 140% at 0% 0%, rgba(125,211,252,0.5), transparent 55%), radial-gradient(100% 120% at 100% 100%, rgba(165,180,252,0.35), transparent 60%), linear-gradient(135deg,#071a2b,#0c1630)" },
  { key: "selva", label: "Selva", bg: "radial-gradient(120% 140% at 0% 0%, rgba(52,211,153,0.45), transparent 55%), radial-gradient(100% 120% at 100% 100%, rgba(132,204,22,0.35), transparent 60%), linear-gradient(135deg,#04170f,#0d1a07)" },
  { key: "galaxia", label: "Galaxia", bg: "radial-gradient(120% 140% at 0% 0%, rgba(168,85,247,0.5), transparent 55%), radial-gradient(100% 120% at 100% 100%, rgba(236,72,153,0.4), transparent 60%), linear-gradient(135deg,#12051f,#1d0a2a)" },
  { key: "oro", label: "Oro", bg: "radial-gradient(120% 140% at 0% 0%, rgba(250,204,21,0.45), transparent 55%), radial-gradient(100% 120% at 100% 100%, rgba(217,119,6,0.4), transparent 60%), linear-gradient(135deg,#1a1203,#201605)" },
] as const;

export type ProfileThemeKey = (typeof PROFILE_THEMES)[number]["key"];
export const isProfileTheme = (v: unknown): v is ProfileThemeKey => PROFILE_THEMES.some((t) => t.key === v);
export const profileTheme = (key: string | null | undefined) => PROFILE_THEMES.find((t) => t.key === key) ?? PROFILE_THEMES[0];

export type AchievementInput = {
  verified: boolean;
  deliveredTopups: number;
  diamonds: number;
  accountsBought: number;
  purchases: number;
  biggestOrder: number;
  profileComplete: boolean;
};

export const ACHIEVEMENTS: Array<{ key: string; label: string; hint: string; icon: "sparkles" | "mail" | "gem" | "gems" | "user" | "heart" | "crown" | "id"; test: (a: AchievementInput) => boolean }> = [
  { key: "bienvenida", label: "Bienvenido", hint: "Creaste tu cuenta", icon: "sparkles", test: () => true },
  { key: "verificado", label: "Correo verificado", hint: "Confirmaste tu correo", icon: "mail", test: (a) => a.verified },
  { key: "primera", label: "Primera recarga", hint: "Recibiste tu primera recarga", icon: "gem", test: (a) => a.deliveredTopups >= 1 },
  { key: "cazador", label: "Cazador de diamantes", hint: "5.000 diamantes recibidos", icon: "gems", test: (a) => a.diamonds >= 5000 },
  { key: "coleccionista", label: "Coleccionista", hint: "Compraste una cuenta", icon: "user", test: (a) => a.accountsBought >= 1 },
  { key: "fiel", label: "Cliente fiel", hint: "5 compras confirmadas", icon: "heart", test: (a) => a.purchases >= 5 },
  { key: "ballena", label: "Gran recarga", hint: "Un pedido de $149.999 o más", icon: "crown", test: (a) => a.biggestOrder >= 149_999 },
  { key: "perfil", label: "Perfil completo", hint: "Avatar, ID de Free Fire y WhatsApp", icon: "id", test: (a) => a.profileComplete },
];
