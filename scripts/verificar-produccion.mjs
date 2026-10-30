// Verifica que el servidor esté listo para vender: variables de entorno y datos clave.
// Nunca muestra valores secretos. Uso: npm run verificar:produccion   (sale con código 1 si hay bloqueantes)
// Revisar un archivo antes de subirlo (sin base de datos): npm run verificar:produccion -- deploy/.env.production
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

// Con un archivo como argumento se revisa SOLO ese archivo (docker compose aporta DATABASE_URL y UPLOADS_DIR).
const fileArg = process.argv.slice(2).find((a) => !a.startsWith("--"));
if (fileArg && !existsSync(fileArg)) {
  console.error(`No existe ${fileArg}`);
  process.exit(1);
}
if (fileArg) {
  for (const k of Object.keys(process.env)) if (/^[A-Z0-9_]+$/.test(k) && k !== "PATH" && !k.startsWith("npm_")) delete process.env[k];
  process.env.DATABASE_URL = "mysql://compose@db:3306/vanta_store";
  process.env.UPLOADS_DIR = "/data/uploads";
}
// .env / .env.production (las variables ya definidas en el sistema tienen prioridad)
for (const file of fileArg ? [fileArg] : [".env", ".env.production"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const v = (k) => (process.env[k] ?? "").trim();
const blockers = [];
const warnings = [];
const oks = [];
const check = (ok, msg, level = "block") => (ok ? oks.push(msg) : (level === "block" ? blockers : warnings).push(msg));

// --- Núcleo
const appUrl = v("APP_URL");
check(/^https:\/\//.test(appUrl) && !/localhost|127\.0\.0\.1/.test(appUrl), "APP_URL con https y tu dominio (no localhost)");
check(v("AUTH_SECRET").length >= 32, "AUTH_SECRET de 32+ caracteres");
check(v("DATA_ENCRYPTION_KEY").length >= 32, "DATA_ENCRYPTION_KEY definida (permite cambiar AUTH_SECRET sin perder datos cifrados)", "warn");
check(!!v("DATABASE_URL"), "DATABASE_URL definida");
check(v("ADMIN_PATH").length >= 12, "ADMIN_PATH secreto de 12+ caracteres");
check(v("CRON_SECRET").length >= 24, "CRON_SECRET de 24+ caracteres (protege la tarea programada)");

// --- Pagos
const pays = v("PAYMENT_PROVIDER").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
check(pays.includes("bold"), "PAYMENT_PROVIDER = bold");
if (pays.includes("bold")) {
  check(!!v("BOLD_API_KEY"), "BOLD_API_KEY (llave de identidad)");
  check(!!v("BOLD_SECRET_KEY") || v("BOLD_TEST_MODE") === "true", "BOLD_SECRET_KEY (llave secreta)");
  check(v("BOLD_TEST_MODE") !== "true", "Bold en modo real (BOLD_TEST_MODE vacío)");
}

// --- Recargas
const topup = v("TOPUP_PROVIDER").toLowerCase();
check(["centralone", "rechargegame"].includes(topup) && !!v("TOPUP_API_KEY"), `Proveedor de recargas (${topup === "centralone" ? "Central One" : topup === "rechargegame" ? "RechargeGame" : "sin configurar"}) con TOPUP_API_KEY`);
if (topup === "centralone") check(v("TOPUP_API_KEY").startsWith("co_live_"), "Llave de Central One de producción (co_live_)");
check(v("TOPUP_TEST_MODE") !== "true", "Recargas reales (TOPUP_TEST_MODE vacío)");
check(!!v("TOPUP_WEBHOOK_SECRET"), "TOPUP_WEBHOOK_SECRET (webhook del proveedor; sin él el estado se consulta cada pocos minutos)", "warn");

// --- Correos
const notify = v("NOTIFY_PROVIDER").toLowerCase();
check(notify === "resend" || notify === "smtp", "NOTIFY_PROVIDER = resend (o smtp)");
if (notify === "resend") check(!!v("RESEND_API_KEY"), "RESEND_API_KEY");
const from = v("NOTIFY_FROM_EMAIL");
check(!!from && !/resend\.dev/i.test(from), "NOTIFY_FROM_EMAIL con tu dominio (ej. pedidos@tudominio.com)");
check(!v("NOTIFY_ONLY_TO"), "NOTIFY_ONLY_TO vacío (si no, los clientes no reciben sus códigos)");

// --- Imágenes
const s3 = ["STORAGE_ENDPOINT", "STORAGE_ACCESS_KEY", "STORAGE_SECRET_KEY", "STORAGE_BUCKET", "STORAGE_PUBLIC_URL"].every((k) => !!v(k));
const uploadsDir = v("UPLOADS_DIR");
check(s3 || (path.isAbsolute(uploadsDir) && !uploadsDir.replace(/\\/g, "/").includes("/public/")), "Imágenes en un bucket S3/R2 o en UPLOADS_DIR (disco persistente)");

// --- Acceso
check(!!v("GOOGLE_CLIENT_ID") && !!v("GOOGLE_CLIENT_SECRET"), "Ingreso con Google configurado", "warn");
check(!v("SEED_ADMIN_PASSWORD"), "SEED_ADMIN_PASSWORD eliminada del servidor (solo se usa la primera vez)", "warn");

// --- Datos (si la base responde)
let dbNote = "";
const db = fileArg ? null : new PrismaClient();
if (db) try {
  const staff = await db.user.findMany({ where: { role: { in: ["ADMIN", "SUPPORT"] }, disabled: false }, select: { email: true, totpEnabledAt: true } });
  check(staff.length > 0, "Hay al menos un administrador");
  check(staff.every((u) => !/\.local$|example\.com$/i.test(u.email)), "Correos reales en el equipo (no .local)");
  check(staff.every((u) => !!u.totpEnabledAt), "Verificación en dos pasos activa en todo el equipo", "warn");
  const settings = Object.fromEntries((await db.setting.findMany()).map((s) => [s.key, s.value]));
  check(!!settings.legalName && !!settings.taxId && !!settings.address, "Datos del vendedor: razón social, NIT y dirección (Ley 1480) en Panel → Ajustes", "warn");
  check(!!settings.supportEmail || !!settings.whatsapp, "Canal de contacto para clientes (WhatsApp o correo) en Panel → Ajustes");
  check(!!settings.staffAlertEmail || !!settings.supportEmail, "Correo para avisos internos en Panel → Ajustes", "warn");
  check(!!settings.whatsapp, "WhatsApp de soporte en Panel → Ajustes", "warn");
  const packs = await db.diamondPackage.count({ where: { active: true, isDemo: false } });
  check(packs > 0, `Paquetes de diamantes activos (${packs})`);
  const unlinked = await db.diamondPackage.count({ where: { active: true, OR: [{ providerSku: null }, { providerSku: "" }] } });
  check(unlinked === 0, `Todos los paquetes activos vinculados al proveedor (${unlinked} sin vincular)`, "warn");
} catch (e) {
  const reason = String(e?.message ?? e).split("\n").map((l) => l.trim()).filter(Boolean).slice(-2).join(" ").slice(0, 160);
  dbNote = `No se pudo leer la base de datos: ${reason}. Revisa DATABASE_URL y que la base esté encendida.`;
  blockers.push("Conexión a la base de datos");
} finally {
  await db.$disconnect().catch(() => {});
}
else dbNote = `Revisado solo el archivo ${fileArg} (los datos de la base se revisan en el servidor).`;

// --- Resultado
const line = (icon, t) => console.log(`  ${icon} ${t}`);
console.log("\nVerificación de producción\n");
oks.forEach((t) => line("✔", t));
warnings.forEach((t) => line("⚠", t));
blockers.forEach((t) => line("✖", t));
if (dbNote) console.log(`\n  ${dbNote}`);
console.log(`\n${blockers.length ? `✖ ${blockers.length} bloqueante(s)` : "✔ Sin bloqueantes"} · ${warnings.length} aviso(s)\n`);
process.exit(blockers.length ? 1 : 0);
