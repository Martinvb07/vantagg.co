export const MAINTENANCE_DEFAULT_MESSAGE = "Estamos en mantenimiento. Las compras están pausadas por un momento; vuelve pronto.";

/**
 * Modo mantenimiento (Panel → Ajustes): devuelve el aviso para los clientes, o null si la tienda vende con normalidad.
 * Mientras está activo no se crean pedidos ni se reabren pagos; lo que ya se pagó se sigue procesando y entregando.
 */
export function maintenanceNotice(s: { maintenanceMode?: string; maintenanceMessage?: string }): string | null {
  if (s.maintenanceMode !== "true") return null;
  return s.maintenanceMessage?.trim().slice(0, 240) || MAINTENANCE_DEFAULT_MESSAGE;
}
