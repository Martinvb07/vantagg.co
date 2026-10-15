import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { LEGAL } from "@/content/legal";
import { accountsVisible } from "@/server/catalog";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.appUrl;
  const now = new Date();
  const withAccounts = await accountsVisible();
  const statics: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${base}/recargas`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    ...(withAccounts ? [{ url: `${base}/cuentas`, lastModified: now, changeFrequency: "daily" as const, priority: 0.9 }] : []),
    { url: `${base}/ayuda`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/medios-de-pago`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/pedido`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    ...Object.keys(LEGAL).map((s) => ({ url: `${base}/legal/${s}`, changeFrequency: "yearly" as const, priority: 0.2 })),
  ];
  if (!withAccounts) return statics;
  try {
    const accounts = await db.accountListing.findMany({
      where: { status: { in: ["PUBLISHED", "RESERVED"] }, isDemo: false },
      select: { slug: true, updatedAt: true },
    });
    return [...statics, ...accounts.map((a) => ({ url: `${base}/cuentas/${a.slug}`, lastModified: a.updatedAt, changeFrequency: "weekly" as const, priority: 0.7 }))];
  } catch {
    return statics;
  }
}
