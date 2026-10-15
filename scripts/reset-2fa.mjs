/**
 * Emergencia: restablece el 2FA de un usuario del equipo (perdió el celular y los códigos).
 * Se ejecuta solo en el servidor/PC con acceso a la base de datos:
 *   npm run admin:2fa-reset -- correo@ejemplo.com
 * Cierra sus sesiones; al volver a entrar por la dirección secreta configurará el 2FA de nuevo.
 */
import prismaPkg from "@prisma/client";

const email = (process.argv[2] ?? "").trim().toLowerCase();
if (!email) {
  console.error("Uso: npm run admin:2fa-reset -- correo@ejemplo.com");
  process.exit(1);
}
const db = new prismaPkg.PrismaClient();
try {
  const user = await db.user.findUnique({ where: { email }, select: { id: true, role: true } });
  if (!user || user.role === "CUSTOMER") {
    console.error("No existe un usuario del equipo con ese correo.");
    process.exit(1);
  }
  await db.user.update({ where: { id: user.id }, data: { totpSecret: null, totpPendingSecret: null, totpEnabledAt: null, totpLastStep: null, recoveryCodes: prismaPkg.Prisma.DbNull } });
  await db.session.deleteMany({ where: { userId: user.id } });
  await db.auditLog.create({ data: { actorId: null, action: "auth.staff_2fa_reset_cli", entity: "User", entityId: user.id } });
  console.log(`2FA restablecido para ${email}. Al ingresar por la dirección secreta configurará uno nuevo.`);
} finally {
  await db.$disconnect();
}
