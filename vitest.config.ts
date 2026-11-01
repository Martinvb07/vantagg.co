import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src"), "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts") } },
  // JSX moderno para las pruebas que dibujan componentes (tsconfig lo deja en «preserve» para Next.js).
  esbuild: { jsx: "automatic" },
  // Un archivo a la vez: varias pruebas usan la misma base de pruebas (catálogo, paquetes) y no deben pisarse.
  test: { environment: "node", include: ["tests/**/*.test.ts"], fileParallelism: false },
});
