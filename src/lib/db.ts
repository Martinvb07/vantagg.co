import "server-only";
import { PrismaClient } from "@prisma/client";

/** Consultas más lentas que esto quedan en el registro del servidor (sin los valores, solo la forma de la consulta). */
const SLOW_QUERY_MS = 700;

function createClient() {
  const client = new PrismaClient({
    log: [
      { emit: "event", level: "query" },
      { emit: "stdout", level: "error" },
      ...(process.env.NODE_ENV === "development" ? [{ emit: "stdout" as const, level: "warn" as const }] : []),
    ],
  });
  client.$on("query", (e) => {
    if (e.duration >= SLOW_QUERY_MS) console.warn(`[db] consulta lenta (${e.duration} ms): ${e.query.slice(0, 300)}`);
  });
  return client;
}

const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof createClient> };

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
