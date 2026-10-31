import { describe, expect, it } from "vitest";
import { MAINTENANCE_DEFAULT_MESSAGE, maintenanceNotice } from "@/domain/maintenance";

describe("modo mantenimiento", () => {
  it("apagado (o sin configurar) no muestra aviso", () => {
    expect(maintenanceNotice({})).toBeNull();
    expect(maintenanceNotice({ maintenanceMode: "false", maintenanceMessage: "Volvemos pronto" })).toBeNull();
    expect(maintenanceNotice({ maintenanceMode: "" })).toBeNull();
  });

  it("encendido usa el mensaje propio o uno genérico", () => {
    expect(maintenanceNotice({ maintenanceMode: "true", maintenanceMessage: "  Volvemos a las 6 pm.  " })).toBe("Volvemos a las 6 pm.");
    expect(maintenanceNotice({ maintenanceMode: "true", maintenanceMessage: "   " })).toBe(MAINTENANCE_DEFAULT_MESSAGE);
    expect(maintenanceNotice({ maintenanceMode: "true" })).toBe(MAINTENANCE_DEFAULT_MESSAGE);
  });
});
