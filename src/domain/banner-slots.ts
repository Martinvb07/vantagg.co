/** Ubicaciones estratégicas de banners: cada una aparece en el momento justo de la compra. */
export const BANNER_SLOTS = [
  { v: "TOP", page: "Inicio", label: "Carrusel principal", hint: "Arriba del todo, uno a la vez y se desliza solo.", size: "1600×480", wide: true },
  { v: "HOME_TRUST", page: "Inicio", label: "Franja tras los paquetes", hint: "Franja ancha sola: cómo se compra.", size: "1600×400", wide: true },
  { v: "HOME_BOTTOM", page: "Inicio", label: "Franja tras las cuentas", hint: "Franja ancha; si hay varias, rotan.", size: "1600×400", wide: true },
  { v: "TOPUP_SIDE", page: "Recargas", label: "Junto al checkout", hint: "Recordatorio donde el cliente paga.", size: "1200×630", wide: false },
  { v: "ACCOUNT_SIDE", page: "Ficha de cuenta", label: "Bajo el botón de compra", hint: "Confianza en el momento de decidir.", size: "1200×630", wide: false },
] as const;

export type BannerSlot = (typeof BANNER_SLOTS)[number]["v"];

export function toBannerSlot(v: string): BannerSlot {
  return (BANNER_SLOTS.find((s) => s.v === v)?.v ?? "TOP") as BannerSlot;
}
