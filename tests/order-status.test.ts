import { describe, expect, it } from "vitest";
import { canTransitionManually, MANUAL_TRANSITIONS, ORDER_STATUSES, timelineIndex } from "@/domain/order-status";
import { publishBlockers } from "@/domain/labels";

describe("máquina de estados de órdenes", () => {
  it("ninguna transición manual puede llevar a PAID, PROCESSING o DELIVERED", () => {
    for (const from of ORDER_STATUSES) {
      for (const to of ["PAID", "PROCESSING", "DELIVERED"] as const) {
        expect(canTransitionManually(from, to)).toBe(false);
      }
    }
    const targets = Object.values(MANUAL_TRANSITIONS).flat();
    expect(targets).not.toContain("PAID");
  });

  it("permite cancelar solo pedidos pendientes de pago", () => {
    expect(canTransitionManually("PENDING_PAYMENT", "CANCELLED")).toBe(true);
    expect(canTransitionManually("PAID", "CANCELLED")).toBe(false);
    expect(canTransitionManually("DELIVERED", "CANCELLED")).toBe(false);
  });

  it("el reembolso requiere solicitud previa", () => {
    expect(canTransitionManually("DELIVERED", "REFUNDED")).toBe(false);
    expect(canTransitionManually("DELIVERED", "REFUND_REQUESTED")).toBe(true);
    expect(canTransitionManually("REFUND_REQUESTED", "REFUNDED")).toBe(true);
  });

  it("ubica cada estado en la línea de tiempo", () => {
    expect(timelineIndex("PENDING_PAYMENT")).toBe(0);
    expect(timelineIndex("DELIVERED")).toBe(3);
    expect(timelineIndex("DELIVERY_FAILED")).toBe(2);
    expect(timelineIndex("CANCELLED")).toBe(-1);
  });
});

describe("requisitos de publicación de cuentas", () => {
  const ok = { imagesCount: 2, openClaims: 0 };
  it("sin bloqueos con fotos y sin reclamos", () => {
    expect(publishBlockers(ok)).toEqual([]);
  });
  it("bloquea sin imágenes o con reclamos abiertos", () => {
    expect(publishBlockers({ ...ok, imagesCount: 0 })).toHaveLength(1);
    expect(publishBlockers({ ...ok, openClaims: 1 })).toHaveLength(1);
  });
});
