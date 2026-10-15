/**
 * Datos iniciales de la tienda: administrador, ajustes y paquetes de LATAM con sus precios reales.
 * No crea cuentas, pedidos ni códigos de demostración. Los paquetes que ya existen no se modifican.
 */
import { PrismaClient } from "@prisma/client";
import { randomBytes, scrypt as scryptCb } from "node:crypto";
import { promisify } from "node:util";

const db = new PrismaClient();
const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, keylen: number, opts: object) => Promise<Buffer>;

async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await scrypt(password.normalize("NFKC"), salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt$16384$8$1$${salt.toString("base64")}$${hash.toString("base64")}`;
}

const PACKAGES = [
  { diamonds: 100, bonus: 10, price: 3499, label: "NONE" },
  { diamonds: 310, bonus: 31, price: 9999, label: "NONE" },
  { diamonds: 520, bonus: 52, price: 15999, label: "NONE" },
  { diamonds: 1060, bonus: 106, price: 33999, label: "NONE" },
  { diamonds: 2180, bonus: 218, price: 64999, label: "NONE" },
  { diamonds: 5600, bonus: 560, price: 149999, label: "RECOMMENDED" },
] as const;


async function main() {
  // --- Administrador -----------------------------------------------------
  const email = (process.env.SEED_ADMIN_EMAIL ?? "admin@vanta.local").toLowerCase();
  let password = process.env.SEED_ADMIN_PASSWORD;
  let generated = false;
  if (!password) {
    password = randomBytes(12).toString("base64url");
    generated = true;
  }
  const existing = await db.user.findUnique({ where: { email } });
  if (!existing) {
    await db.user.create({ data: { email, name: "Administrador", role: "ADMIN", passwordHash: await hashPassword(password) } });
    console.log(`✔ Administrador creado: ${email}`);
    if (generated) console.log(`  Contraseña generada (cámbiala tras ingresar): ${password}`);
  } else {
    console.log(`• El administrador ${email} ya existe (sin cambios).`);
  }

  // --- Ajustes base ------------------------------------------------------
  const settings: Record<string, string> = {
    storeName: "VANTA",
    storeTagline: "Recargas y cuentas Free Fire",
    orderPrefix: "VX",
    city: "Colombia",
    showGarenaDisclaimer: "true",
  };
  for (const [key, value] of Object.entries(settings)) {
    await db.setting.upsert({ where: { key }, create: { key, value }, update: {} });
  }

  // --- Paquetes (precios reales de la tienda) -----------------------------
  const pkgIds: string[] = [];
  for (const [i, p] of PACKAGES.entries()) {
    const slug = `diamantes-${p.diamonds}`;
    const row = await db.diamondPackage.upsert({
      where: { slug },
      create: {
        slug,
        name: `${p.diamonds} diamantes`,
        diamonds: p.diamonds,
        bonusDiamonds: p.bonus,
        price: p.price,
        compareAtPrice: null,
        label: p.label,
        sortOrder: i,
        featured: i === 1 || i === 3,
        providerSku: `FF-${p.diamonds}`,
        isDemo: false,
      },
      update: {},
    });
    pkgIds.push(row.id);
  }
  console.log(`✔ ${PACKAGES.length} paquetes`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
