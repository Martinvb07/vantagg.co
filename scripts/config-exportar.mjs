// Exporta la configuración de la tienda para llevarla a producción:
// ajustes, paquetes de diamantes (precios, regiones, vínculos con el proveedor), banners y códigos promocionales.
// No exporta clientes, pedidos, sesiones ni secretos. Uso: npm run config:exportar
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const omit = (o, keys) => Object.fromEntries(Object.entries(o).filter(([k]) => !keys.includes(k)));
const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "").replace(/^(\d{8})(\d{4})$/, "$1-$2");
const dir = path.join("exportacion", `config-${stamp}`);

try {
  const [settings, packages, banners, promoCodes] = await Promise.all([
    db.setting.findMany({ orderBy: { key: "asc" } }),
    db.diamondPackage.findMany({ orderBy: [{ region: "asc" }, { sortOrder: "asc" }] }),
    db.promoBanner.findMany({ orderBy: [{ placement: "asc" }, { sortOrder: "asc" }] }),
    db.promoCode.findMany({ where: { isDemo: false }, orderBy: { code: "asc" } }),
  ]);
  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    // supplierSyncedAt: producción sincroniza el catálogo por su cuenta.
    settings: settings.filter((s) => s.key !== "supplierSyncedAt").map((s) => ({ key: s.key, value: s.value })),
    packages: packages.filter((p) => !p.isDemo).map((p) => omit(p, ["id", "createdAt", "updatedAt"])),
    banners: banners.map((b) => omit(b, ["createdAt", "updatedAt"])),
    promoCodes: promoCodes.map((c) => ({ ...omit(c, ["id", "createdAt", "updatedAt"]), uses: 0 })),
  };

  // Imágenes subidas desde el panel (/uploads/...) que la configuración usa.
  const uploadsDir = process.env.UPLOADS_DIR?.trim() || path.join("public", "uploads");
  const refs = new Set(
    [...data.banners.flatMap((b) => [b.imageUrl, b.imageMobileUrl]), ...data.settings.filter((s) => ["logoUrl", "topupCoverUrl"].includes(s.key)).map((s) => s.value)].filter(
      (u) => typeof u === "string" && u.startsWith("/uploads/"),
    ),
  );
  mkdirSync(dir, { recursive: true });
  let copied = 0;
  for (const ref of refs) {
    const rel = ref.replace(/^\/uploads\//, "");
    const src = path.join(uploadsDir, rel);
    if (!existsSync(src)) {
      console.warn(`  ⚠ No se encontró ${ref} (se omitió)`);
      continue;
    }
    const dest = path.join(dir, "uploads", rel);
    mkdirSync(path.dirname(dest), { recursive: true });
    copyFileSync(src, dest);
    copied++;
  }
  writeFileSync(path.join(dir, "config.json"), JSON.stringify(data, null, 2));
  console.log(`✔ Configuración exportada en ${dir}`);
  console.log(`  ${data.settings.length} ajustes · ${data.packages.length} paquetes · ${data.banners.length} banners · ${data.promoCodes.length} códigos · ${copied} imagen(es)`);
  console.log("  Contiene correos de contacto de la tienda: no la publiques. En el servidor: npm run config:importar -- <carpeta> --confirmar");
} finally {
  await db.$disconnect();
}
