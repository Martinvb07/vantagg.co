// Importa en este servidor la configuración exportada con `npm run config:exportar`.
// Sin --confirmar solo muestra qué cambiaría. Es idempotente: se puede correr varias veces.
// Uso: npm run config:importar -- exportacion/config-AAAAMMDD-HHMM --confirmar
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith("--"));
const apply = args.includes("--confirmar");
if (!dir || !existsSync(path.join(dir, "config.json"))) {
  console.error("Indica la carpeta exportada. Ej: npm run config:importar -- exportacion/config-20261014-1530 --confirmar");
  process.exit(1);
}
const data = JSON.parse(readFileSync(path.join(dir, "config.json"), "utf8"));
if (data.version !== 1) {
  console.error("Versión de exportación no soportada.");
  process.exit(1);
}
const db = new PrismaClient();
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const pick = (o, keys) => Object.fromEntries(keys.map((k) => [k, o[k] instanceof Date ? o[k].toISOString() : o[k]]));
const count = { settings: 0, packages: 0, banners: 0, promoCodes: 0, images: 0 };

try {
  // Ajustes
  for (const s of data.settings) {
    const cur = await db.setting.findUnique({ where: { key: s.key } });
    if (cur?.value === s.value) continue;
    count.settings++;
    if (apply) await db.setting.upsert({ where: { key: s.key }, create: { key: s.key, value: s.value }, update: { value: s.value } });
  }
  // Paquetes (por slug)
  for (const p of data.packages) {
    const cur = await db.diamondPackage.findUnique({ where: { slug: p.slug } });
    if (cur && same(pick(cur, Object.keys(p)), p)) continue;
    count.packages++;
    if (apply) await db.diamondPackage.upsert({ where: { slug: p.slug }, create: p, update: p });
  }
  // Banners (por id)
  for (const b of data.banners) {
    const cur = await db.promoBanner.findUnique({ where: { id: b.id } });
    if (cur && same(pick(cur, Object.keys(b)), b)) continue;
    count.banners++;
    const { id, ...rest } = b;
    if (apply) await db.promoBanner.upsert({ where: { id }, create: b, update: rest });
  }
  // Códigos promocionales (por código; no se tocan los usos ya registrados en el servidor)
  for (const c of data.promoCodes) {
    const { uses, ...rest } = c;
    const toDates = (o) => ({ ...o, startsAt: o.startsAt ? new Date(o.startsAt) : null, endsAt: o.endsAt ? new Date(o.endsAt) : null });
    const cur = await db.promoCode.findUnique({ where: { code: c.code } });
    if (cur && same(pick(cur, Object.keys(rest)), rest)) continue;
    count.promoCodes++;
    if (apply) await db.promoCode.upsert({ where: { code: c.code }, create: { ...toDates(rest), uses }, update: toDates(rest) });
  }
  // Imágenes subidas
  const src = path.join(dir, "uploads");
  if (existsSync(src)) {
    const s3 = ["STORAGE_ENDPOINT", "STORAGE_ACCESS_KEY", "STORAGE_SECRET_KEY", "STORAGE_BUCKET", "STORAGE_PUBLIC_URL"].every((k) => process.env[k]?.trim());
    const target = process.env.UPLOADS_DIR?.trim() || path.join("public", "uploads");
    const walk = (d) => readdirSync(d).flatMap((f) => (statSync(path.join(d, f)).isDirectory() ? walk(path.join(d, f)) : [path.join(d, f)]));
    for (const file of walk(src)) {
      const rel = path.relative(src, file);
      if (s3) {
        console.warn(`  ⚠ Almacenamiento S3 activo: sube ${rel} al bucket con la misma ruta (las URLs /uploads/… de la configuración apuntan al disco local).`);
        continue;
      }
      const dest = path.join(target, rel);
      if (existsSync(dest)) continue;
      count.images++;
      if (apply) {
        mkdirSync(path.dirname(dest), { recursive: true });
        copyFileSync(file, dest);
      }
    }
  }
  const summary = `${count.settings} ajustes · ${count.packages} paquetes · ${count.banners} banners · ${count.promoCodes} códigos · ${count.images} imagen(es)`;
  console.log(apply ? `✔ Importado: ${summary}` : `Simulación (nada cambió). Se aplicarían: ${summary}\nPara aplicar agrega --confirmar`);
} finally {
  await db.$disconnect();
}
