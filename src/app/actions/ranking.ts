"use server";

import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { saveSettings } from "@/server/settings";
import { awardPrize } from "@/server/ranking";
import type { ActionResult } from "./admin";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

/** Ajustes del Top 3 del mes: mostrar en el inicio, gasto mínimo y paquete de premio por puesto. */
export async function saveRankingAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const min = Number(str(form, "minCop").replace(/\D/g, ""));
  if (!Number.isInteger(min) || min < 0 || min > 100_000_000) return { ok: false, message: "El gasto mínimo debe ser un valor en pesos." };
  const prizes = [1, 2, 3].map((p) => Number(str(form, `prize${p}`).replace(/\D/g, "")));
  if (prizes.some((n) => !Number.isInteger(n) || n <= 0)) return { ok: false, message: "Elige el paquete de premio de cada puesto." };
  const values = { rankingMode: form.get("enabled") === "on" ? "on" : "off", rankingMinCop: String(min), rankingPrizes: prizes.join(",") };
  await saveSettings(values);
  await audit({ actorId: user.id, action: "ranking.settings", entity: "Setting", data: values });
  revalidatePath("/admin/ranking");
  revalidatePath("/");
  return { ok: true, message: "Guardado." };
}

/** Entrega el premio de un puesto de un mes cerrado (sin cobro, una sola vez por mes y puesto). */
export async function awardPrizeAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const r = await awardPrize({ periodKey: str(form, "period"), pos: Number(str(form, "pos")), actorId: user.id, playerId: str(form, "playerId") || null });
  revalidatePath("/admin/ranking");
  return r.ok ? { ok: true, message: r.message } : { ok: false, message: r.error };
}
