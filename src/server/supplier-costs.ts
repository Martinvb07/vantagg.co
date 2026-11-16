import "server-only";
import { db } from "@/lib/db";
import { getTopUpProvider } from "./integrations/topup";

/**
 * Costo real de entregas anteriores: le pregunta al proveedor (solo lectura, GET del pedido) cuánto cobró por cada
 * recarga ya entregada que aún no tiene ese dato. Pocas por vez (mantenimiento cada 2 min) para no saturar la API, y
 * cada entrega se vuelve a intentar como mucho cada 6 horas. Las entregas nuevas guardan el costo al entregarse.
 */
const RETRY_MS = 6 * 3600_000;

export async function backfillDeliveryCosts(opts: { limit?: number; now?: Date } = {}): Promise<{ checked: number; found: number }> {
  const now = opts.now ?? new Date();
  const rows = await db.delivery.findMany({
    where: {
      status: "SUCCESS",
      simulated: false,
      costCents: null,
      providerRef: { not: null },
      order: { isTest: false },
      OR: [{ costCheckedAt: null }, { costCheckedAt: { lt: new Date(now.getTime() - RETRY_MS) } }],
    },
    select: { id: true, provider: true, providerRef: true },
    orderBy: { updatedAt: "desc" },
    take: opts.limit ?? 20,
  });
  let found = 0;
  for (const d of rows) {
    const provider = getTopUpProvider(d.provider);
    let costCents: number | null = null;
    if (provider?.wholesale && !provider.simulated) {
      try {
        const r = await provider.getTransactionStatus(d.providerRef!);
        if (r.status === "SUCCESS" && r.costCents && r.costCents > 0) costCents = r.costCents;
      } catch {
        /* se reintenta en 6 horas */
      }
    }
    await db.delivery.update({ where: { id: d.id }, data: { costCheckedAt: now, ...(costCents ? { costCents } : {}) } });
    if (costCents) found++;
  }
  return { checked: rows.length, found };
}
