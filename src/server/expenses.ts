import "server-only";
import { db } from "@/lib/db";
import type { Period } from "@/domain/accounting";

/** Gastos del negocio anotados a mano (Panel → Contabilidad): se restan para la ganancia neta. */
export const EXPENSE_CATEGORIES = ["Publicidad", "Comisiones y bancos", "Impuestos", "Herramientas y servicios", "Compra de dólares (diferencia)", "Otros"] as const;

export async function listExpenses(p: Pick<Period, "fromYmd" | "toYmd">) {
  return db.expense.findMany({ where: { day: { gte: p.fromYmd, lte: p.toYmd } }, orderBy: [{ day: "desc" }, { createdAt: "desc" }], take: 2000 });
}

export async function addExpense(opts: { day: string; category: string; concept: string; amountCop: number; actor: { id: string; name: string | null } }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(opts.day)) return { ok: false as const, error: "Elige la fecha del gasto." };
  if (!(EXPENSE_CATEGORIES as readonly string[]).includes(opts.category)) return { ok: false as const, error: "Elige una categoría." };
  const concept = opts.concept.trim().slice(0, 200);
  if (!concept) return { ok: false as const, error: "Escribe en qué se gastó (p. ej. «Anuncios de Meta»)." };
  if (!Number.isInteger(opts.amountCop) || opts.amountCop <= 0 || opts.amountCop > 1_000_000_000) return { ok: false as const, error: "Escribe el valor en pesos." };
  const e = await db.expense.create({ data: { day: opts.day, category: opts.category, concept, amountCop: opts.amountCop, createdById: opts.actor.id, createdByName: opts.actor.name?.slice(0, 191) ?? null } });
  return { ok: true as const, id: e.id };
}

export async function removeExpense(id: string) {
  const e = await db.expense.findUnique({ where: { id } });
  if (!e) return { ok: false as const, error: "Ese gasto ya no existe." };
  await db.expense.delete({ where: { id } });
  return { ok: true as const, expense: e };
}
