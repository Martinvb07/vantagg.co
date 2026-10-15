/** Galería de avatares originales que el cliente puede elegir (sin arte del juego). */
export const AVATAR_PRESETS = [
  { key: "diamante", label: "Diamante", from: "#0b3d91", to: "#38bdf8" },
  { key: "fuego", label: "Fuego", from: "#7c1d06", to: "#fb923c" },
  { key: "corona", label: "Corona", from: "#713f12", to: "#facc15" },
  { key: "rayo", label: "Rayo", from: "#365314", to: "#c8f04f" },
  { key: "escudo", label: "Escudo", from: "#134e4a", to: "#2dd4bf" },
  { key: "calavera", label: "Calavera", from: "#2e1065", to: "#a78bfa" },
  { key: "mira", label: "Mira", from: "#7f1d1d", to: "#f87171" },
  { key: "cohete", label: "Cohete", from: "#1e1b4b", to: "#818cf8" },
  { key: "estrella", label: "Estrella", from: "#831843", to: "#f472b6" },
  { key: "control", label: "Control", from: "#083344", to: "#22d3ee" },
  { key: "trofeo", label: "Trofeo", from: "#78350f", to: "#fbbf24" },
  { key: "espadas", label: "Espadas", from: "#1f2937", to: "#94a3b8" },
] as const;

export type AvatarPresetKey = (typeof AVATAR_PRESETS)[number]["key"];

export const isAvatarPreset = (v: unknown): v is AvatarPresetKey => AVATAR_PRESETS.some((p) => p.key === v);
