import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { clientIpHash } from "./request";

export async function audit(params: {
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  data?: Prisma.InputJsonValue;
}) {
  try {
    await db.auditLog.create({
      data: {
        actorId: params.actorId ?? null,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId ?? null,
        data: params.data,
        ipHash: await clientIpHash().catch(() => null),
      },
    });
  } catch (err) {
    console.error("[audit] no se pudo registrar", params.action, (err as Error).message);
  }
}
