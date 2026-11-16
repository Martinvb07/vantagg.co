"use server";

import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { addExpense, removeExpense } from "@/server/expenses";
import { saveSettings } from "@/server/settings";
import type { ActionResult } from "./admin";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const pesos = (v: string) => Number(v.replace(/\D/g, ""));
const actorOf = (u: { id: string; name?: string | null; email: string }) => ({ id: u.id, name: u.name && u.name !== "No Name" ? u.name : u.email });

/** Anota un gasto del negocio (publicidad, bancos…): se resta de la ganancia neta del día del gasto. */
export async function addExpenseAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const amountCop = pesos(str(form, "amount"));
  const r = await addExpense({ day: str(form, "day"), category: str(form, "category"), concept: str(form, "concept"), amountCop, actor: actorOf(user) });
  if (!r.ok) return { ok: false, message: r.error };
  await audit({ actorId: user.id, action: "expense.add", entity: "Expense", entityId: r.id, data: { category: str(form, "category") } });
  revalidatePath("/admin/contabilidad");
  return { ok: true, message: `Gasto de ${formatMoney(amountCop)} anotado.` };
}

export async function removeExpenseAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const r = await removeExpense(str(form, "id"));
  if (!r.ok) return { ok: false, message: r.error };
  await audit({ actorId: user.id, action: "expense.remove", entity: "Expense", entityId: r.expense.id, data: { day: r.expense.day, category: r.expense.category } });
  revalidatePath("/admin/contabilidad");
  return { ok: true, message: "Gasto quitado." };
}

/** Capital con el que empezó el negocio y desde qué día: para el cuadre «cuánto debería tener». */
export async function saveCapitalAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const capital = pesos(str(form, "capital"));
  const since = str(form, "since");
  if (!capital || capital > 10_000_000_000) return { ok: false, message: "Escribe el capital en pesos (p. ej. 1.000.000)." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(since)) return { ok: false, message: "Elige desde qué día empezó ese capital." };
  await saveSettings({ capitalCop: String(capital), capitalSince: since });
  await audit({ actorId: user.id, action: "accounting.capital", entity: "Setting", data: { since } });
  revalidatePath("/admin/contabilidad");
  return { ok: true, message: "Capital guardado." };
}
