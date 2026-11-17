/**
 * El mantenimiento apaga la Navidad el 1 de enero (Ajustes → Temporada vuelve a «Normal») y deja constancia.
 *   npx vitest run tests/season-end.test.ts
 */
import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ settings: { seasonTheme: "navidad" } as Record<string, string>, audits: [] as unknown[] }));
vi.mock("@/server/settings", () => ({
  getSettings: vi.fn(async () => ({ ...state.settings })),
  saveSettings: vi.fn(async (v: Record<string, string>) => void Object.assign(state.settings, v)),
}));
vi.mock("@/lib/audit", () => ({ audit: vi.fn(async (a: unknown) => void state.audits.push(a)) }));

import { endChristmasIfOver } from "@/server/maintenance";

describe("fin de la Navidad", () => {
  it("en diciembre no toca nada", async () => {
    expect(await endChristmasIfOver(new Date("2026-12-31T23:00:00Z"))).toBe(false);
    expect(state.settings.seasonTheme).toBe("navidad");
  });

  it("el 1 de enero la deja en «Normal» una sola vez y lo anota en la auditoría", async () => {
    expect(await endChristmasIfOver(new Date("2027-01-01T05:01:00Z"))).toBe(true);
    expect(state.settings.seasonTheme).toBe("");
    expect(state.audits).toEqual([expect.objectContaining({ action: "settings.season_ended" })]);
    expect(await endChristmasIfOver(new Date("2027-01-02T12:00:00Z"))).toBe(false); // ya estaba en «Normal»
    expect(state.audits).toHaveLength(1);
  });
});
