"use server";

import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { formatUsd, parseFee, parseUsdCents } from "@/domain/cash";
import { addRecharge, closeCash, removeRecharge, startCash } from "@/server/cash";
import { activeWholesale } from "@/server/integrations/topup";
import { saveSettings } from "@/server/settings";
import type { ActionResult } from "./admin";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const actorOf = (u: { id: string; name?: string | null; email: string }) => ({ id: u.id, name: u.name && u.name !== "No Name" ? u.name : u.email });

/** «2026-11-15T08:30» del formulario (hora de Colombia) → fecha. */
function bogotaInput(v: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return null;
  const d = new Date(`${v}:00-05:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Empieza a usar la caja: las ventas anteriores a la fecha elegida ya se contaron a mano. */
export async function startCashAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const from = bogotaInput(str(form, "from"));
  if (!from) return { ok: false, message: "Elige la fecha y hora desde la que se cuentan las ventas." };
  const r = await startCash({ from, actor: actorOf(user), note: str(form, "note").slice(0, 2000) || null });
  if (!r.ok) return { ok: false, message: r.error };
  await audit({ actorId: user.id, action: "cash.start", entity: "CashClose", entityId: "0", data: { from: from.toISOString(), before: r.summary.orders } });
  revalidatePath("/admin/caja");
  return { ok: true, message: "Listo: la caja empezó. Desde ahora cada venta queda en la caja abierta hasta que la cierres." };
}

export async function closeCashAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const expect = Number(str(form, "number"));
  const r = await closeCash({ actor: actorOf(user), note: str(form, "note").slice(0, 2000) || null, expectNumber: Number.isInteger(expect) && expect > 0 ? expect : undefined });
  if (!r.ok) return { ok: false, message: r.error };
  await audit({ actorId: user.id, action: "cash.close", entity: "CashClose", entityId: String(r.number), data: { orders: r.summary.orders, refunds: r.summary.refunds } });
  revalidatePath("/admin/caja");
  return { ok: true, message: `Caja #${r.number} cerrada: ${r.summary.orders} ${r.summary.orders === 1 ? "venta" : "ventas"} por ${formatMoney(r.summary.salesCop)}. La caja nueva empieza en cero.` };
}

export async function addRechargeAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const cents = parseUsdCents(str(form, "amount"));
  if (cents == null) return { ok: false, message: "Escribe cuánto recargaste (por ejemplo 150 o 150,50)." };
  const rate = Number(str(form, "rate").replace(/\D/g, ""));
  const r = await addRecharge({ amountCents: cents, rateCop: rate, note: str(form, "note"), actor: actorOf(user) });
  if (!r.ok) return { ok: false, message: r.error };
  await audit({ actorId: user.id, action: "cash.recharge", entity: "SupplierRecharge", entityId: r.id });
  revalidatePath("/admin/caja");
  return { ok: true, message: `Recarga de ${formatUsd(cents)} ${activeWholesale()?.wholesale.currency ?? "USD"} anotada.` };
}

export async function removeRechargeAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const id = str(form, "id");
  const r = await removeRecharge(id);
  if (!r.ok) return { ok: false, message: r.error };
  await audit({ actorId: user.id, action: "cash.recharge_removed", entity: "SupplierRecharge", entityId: id });
  revalidatePath("/admin/caja");
  return { ok: true, message: "Recarga quitada." };
}

/** Comisión de la pasarela para estimar la ganancia (no cambia lo que se cobra). */
export async function saveCashFeeAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const rawPct = str(form, "pct");
  const rawFixed = str(form, "fixed");
  const fee = parseFee(rawPct, rawFixed);
  if (rawPct && !fee.pct && Number(rawPct.replace(",", ".")) !== 0) return { ok: false, message: "El porcentaje debe estar entre 0 y 30 (por ejemplo 3,29)." };
  if (rawFixed && !fee.fixed && Number(rawFixed.replace(/\D/g, "")) !== 0) return { ok: false, message: "El valor fijo debe ser en pesos (por ejemplo 900)." };
  const values = { cashFeePct: fee.pct ? String(fee.pct) : "", cashFeeFixed: fee.fixed ? String(fee.fixed) : "" };
  await saveSettings(values);
  await audit({ actorId: user.id, action: "cash.fee", entity: "Setting", data: values });
  revalidatePath("/admin/caja");
  return { ok: true, message: fee.pct || fee.fixed ? "Comisión guardada: la ganancia ya la descuenta." : "Sin comisión: la ganancia no la descuenta." };
}
