/**
 * Deja UN solo usuario en la tienda: el administrador indicado. Borra a todos los demás
 * (equipo y clientes). Los pedidos y tickets se conservan, sin usuario asociado.
 * Además pone ese correo como correo de soporte y de avisos internos (Panel → Ajustes).
 * Se ejecuta en el servidor con acceso a la base de datos; la contraseña llega por la
 * entrada estándar (nunca como argumento, para que no quede en el historial ni en logs):
 *   printf '%s' 'contraseña-larga' | node scripts/admin-unico.mjs correo@ejemplo.com --confirmar
 * Al ingresar por la dirección secreta del panel configurará el 2FA de nuevo.
 */
import prismaPkg from "@prisma/client";
import { randomBytes, scrypt as scryptCb } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb);
// Mismo formato que src/lib/password.ts: scrypt$N$r$p$salt$hash
async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scrypt(password.normalize("NFKC"), salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt$16384$8$1$${salt.toString("base64")}$${hash.toString("base64")}`;
}

const email = (process.argv[2] ?? "").trim().toLowerCase();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !process.argv.includes("--confirmar")) {
  console.error("Uso: printf '%s' 'contraseña' | node scripts/admin-unico.mjs correo@ejemplo.com --confirmar");
  process.exit(1);
}

let password = "";
for await (const chunk of process.stdin) password += chunk;
password = password.replace(/\r?\n$/, "");
if (password.length < 12) {
  console.error("La contraseña debe tener al menos 12 caracteres.");
  process.exit(1);
}

const db = new prismaPkg.PrismaClient();
try {
  const passwordHash = await hashPassword(password);
  const result = await db.$transaction(async (tx) => {
    const admin = await tx.user.upsert({
      where: { email },
      update: {
        role: "ADMIN",
        disabled: false,
        passwordHash,
        hasPassword: true,
        emailVerifiedAt: new Date(),
        totpSecret: null,
        totpPendingSecret: null,
        totpEnabledAt: null,
        totpLastStep: null,
        recoveryCodes: prismaPkg.Prisma.DbNull,
      },
      create: { email, name: "Administrador", role: "ADMIN", passwordHash, hasPassword: true, emailVerifiedAt: new Date() },
    });
    const others = { id: { not: admin.id } };
    // Las notas internas exigen autor: las de otros usuarios pasan al administrador que queda.
    await tx.adminNote.updateMany({ where: { author: others }, data: { authorId: admin.id } });
    const deleted = await tx.user.deleteMany({ where: others });
    await tx.session.deleteMany({ where: { userId: admin.id } });
    for (const key of ["staffAlertEmail", "supportEmail"]) {
      await tx.setting.upsert({ where: { key }, create: { key, value: email }, update: { value: email } });
    }
    await tx.auditLog.create({ data: { actorId: null, action: "auth.single_admin_cli", entity: "User", entityId: admin.id } });
    return deleted.count;
  });
  console.log(`Listo: ${email} es el único administrador y recibe los avisos. Usuarios borrados: ${result}.`);
} finally {
  await db.$disconnect();
}
