import { defineConfig } from "prisma/config";

// Con este archivo Prisma ya no lee el .env por su cuenta: se carga aquí para que las migraciones del VPS
// (npx prisma migrate deploy) sigan encontrando DATABASE_URL. Sin .env (CI) se usan las variables del entorno.
try {
  process.loadEnvFile();
} catch {
  // No hay .env: nada que cargar.
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
});
