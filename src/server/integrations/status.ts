import "server-only";
import { db } from "@/lib/db";
import { env, isProduction, mask } from "@/lib/env";
import { PAYMENT_PROVIDERS, getPaymentProvider } from "./payments";
import { TOPUP_PROVIDERS, getTopUpProvider } from "./topup";
import { storageMissingConfig, storageMode } from "../storage";
import { emailReady, notificationsMissingConfig } from "../notifications";
import { googleEnabled, googleMissingConfig, googleRedirectUri } from "../google-oauth";

export type IntegrationCard = {
  key: string;
  group: "Pagos" | "Recargas" | "Almacenamiento" | "Notificaciones" | "Acceso";
  name: string;
  selected: boolean; // elegido en variables de entorno
  active: boolean; // seleccionado y completamente configurado
  mode: string;
  missing: string[];
  values: Array<{ name: string; value: string | null }>; // siempre enmascarados
  webhookUrl?: string;
  redirectUrl?: string; // URI de redirección autorizada (OAuth)
  note?: string;
  lastCheckAt: Date | null;
  lastOkAt: Date | null;
  lastError: string | null;
};

const MODE_LABEL: Record<string, string> = { sandbox: "Pruebas (sin cobros)", production: "Producción" };

export async function getIntegrationOverview(): Promise<IntegrationCard[]> {
  const states = new Map((await db.integrationState.findMany()).map((s) => [s.key, s]));
  const st = (key: string) => ({
    lastCheckAt: states.get(key)?.lastCheckAt ?? null,
    lastOkAt: states.get(key)?.lastOkAt ?? null,
    lastError: states.get(key)?.lastError ?? null,
  });

  const cards: IntegrationCard[] = [];

  for (const p of PAYMENT_PROVIDERS) {
    const values =
      p.id === "bold"
        ? [
            { name: "BOLD_API_KEY", value: mask(env.bold.apiKey) },
            { name: "BOLD_SECRET_KEY", value: mask(env.bold.secretKey) },
            { name: "BOLD_TEST_MODE", value: env.bold.testMode ? "true" : null },
          ]
        : [];
    cards.push({
      key: `payment:${p.id}`,
      group: "Pagos",
      name: p.displayName,
      selected: env.paymentProviders.includes(p.id),
      active: p.isEnabled(),
      mode: MODE_LABEL[p.mode()] ?? p.mode(),
      missing: p.missingConfig(),
      values,
      webhookUrl: `${env.appUrl}/api/webhooks/${p.id}`,
      ...st(`payment:${p.id}`),
    });
  }

  for (const t of TOPUP_PROVIDERS) {
    cards.push({
      key: `topup:${t.id}`,
      group: "Recargas",
      name: t.displayName,
      selected: env.topup.provider === t.id,
      active: t.isEnabled(),
      mode: MODE_LABEL[t.mode()] ?? t.mode(),
      missing: t.missingConfig(),
      values:
        t.id === "rechargegame"
          ? [
              { name: "TOPUP_API_KEY", value: mask(env.topup.apiKey) },
              { name: "TOPUP_WEBHOOK_SECRET", value: mask(env.topup.webhookSecret) },
              { name: "TOPUP_TEST_MODE", value: env.topup.forceTest ? "true" : null },
            ]
          : t.id === "http"
          ? [
              { name: "TOPUP_API_BASE_URL", value: env.topup.baseUrl ?? null },
              { name: "TOPUP_API_KEY", value: mask(env.topup.apiKey) },
              { name: "TOPUP_WEBHOOK_SECRET", value: mask(env.topup.webhookSecret) },
            ]
          : [],
      webhookUrl: t.simulated ? undefined : `${env.appUrl}/api/webhooks/topup`,
      note: t.simulated
        ? "No entrega diamantes reales. Nunca se activa en producción."
        : t.id === "rechargegame"
          ? "Saldo, catálogo, regiones y precios en Panel → Proveedor y saldo. El webhook es opcional: sin él el estado se consulta solo."
          : "Úsalo solo con un proveedor cuyas condiciones autoricen la reventa.",
      ...st(`topup:${t.id}`),
    });
  }

  const sMode = storageMode();
  cards.push({
    key: "storage",
    group: "Almacenamiento",
    name: sMode === "s3" ? "Almacenamiento S3 compatible" : "Disco local",
    selected: true,
    active: sMode === "s3" || !isProduction,
    mode: sMode === "s3" ? "Producción" : "Local",
    missing: sMode === "s3" ? [] : storageMissingConfig(),
    values: [
      { name: "STORAGE_ENDPOINT", value: env.storage.endpoint ?? null },
      { name: "STORAGE_BUCKET", value: env.storage.bucket ?? null },
      { name: "STORAGE_ACCESS_KEY", value: mask(env.storage.accessKey) },
      { name: "STORAGE_SECRET_KEY", value: mask(env.storage.secretKey) },
    ],
    note: sMode === "local" ? process.env.UPLOADS_DIR?.trim() ? "Las imágenes se guardan en UPLOADS_DIR (disco persistente del servidor)." : "Las imágenes se guardan en public/uploads (solo desarrollo). En producción define UPLOADS_DIR en un disco persistente o configura un bucket." : undefined,
    ...st("storage"),
  });

  const provider = env.notify.provider;
  const realEmail = provider === "resend" || provider === "smtp";
  cards.push({
    key: "notifications",
    group: "Notificaciones",
    name: provider === "resend" ? "Correo (Resend)" : provider === "smtp" ? "Correo (SMTP)" : "Correo sin configurar",
    selected: true,
    active: emailReady(),
    mode: realEmail ? "Correo real" : "Solo registro",
    missing: realEmail ? notificationsMissingConfig() : ["NOTIFY_PROVIDER (resend o smtp)", "NOTIFY_FROM_EMAIL"],
    values:
      provider === "smtp"
        ? [
            { name: "SMTP_HOST", value: env.notify.smtp.host ?? null },
            { name: "SMTP_PORT", value: String(env.notify.smtp.port) },
            { name: "SMTP_USER", value: env.notify.smtp.user ?? null },
            { name: "SMTP_PASS", value: mask(env.notify.smtp.pass) },
            { name: "NOTIFY_FROM_EMAIL", value: env.notify.fromEmail ?? null },
          ]
        : [
            { name: "NOTIFY_PROVIDER", value: provider },
            { name: "RESEND_API_KEY", value: mask(env.notify.resendApiKey) },
            { name: "NOTIFY_FROM_EMAIL", value: env.notify.fromEmail ?? null },
          ],
    note: realEmail
      ? "Códigos, recuperación de contraseña, pedidos, soporte y avisos del chat. Prueba el envío en Panel → Correos."
      : "Sin correo no llegan códigos, enlaces de recuperación ni avisos de pedidos. Configura Resend o SMTP (Gmail/Outlook con contraseña de aplicación).",
    ...st("notifications"),
  });

  cards.push({
    key: "google",
    group: "Acceso",
    name: "Iniciar sesión con Google",
    selected: true,
    active: googleEnabled(),
    mode: googleEnabled() ? "Activo" : "Desactivado",
    missing: googleMissingConfig(),
    values: [
      { name: "GOOGLE_CLIENT_ID", value: env.google.clientId ? `${env.google.clientId.slice(0, 12)}…` : null },
      { name: "GOOGLE_CLIENT_SECRET", value: mask(env.google.clientSecret) },
    ],
    redirectUrl: googleRedirectUri(),
    note: "Crea un «ID de cliente de OAuth» tipo Aplicación web en Google Cloud Console y registra esta URI de redirección exacta. El botón aparece solo cuando ambas variables existen.",
    ...st("google"),
  });

  return cards;
}

export async function runHealthCheck(key: string): Promise<{ ok: boolean; message: string }> {
  let result: { ok: boolean; message: string };
  if (key.startsWith("payment:")) {
    const p = getPaymentProvider(key.slice(8));
    result = p ? await p.healthCheck() : { ok: false, message: "Integración desconocida" };
  } else if (key.startsWith("topup:")) {
    const t = getTopUpProvider(key.slice(6));
    result = t ? await t.healthCheck() : { ok: false, message: "Integración desconocida" };
  } else if (key === "storage") {
    result = storageMode() === "s3" ? { ok: true, message: "Variables completas (la prueba real ocurre al subir una imagen)." } : { ok: !isProduction, message: "Usando disco local." };
  } else if (key === "notifications") {
    result = emailReady() ? { ok: true, message: "Variables completas. Envía un correo de prueba en Panel → Correos." } : { ok: false, message: "Correo transaccional no configurado." };
  } else if (key === "google") {
    result = googleEnabled() ? { ok: true, message: "Variables completas. Prueba el botón en /ingresar." } : { ok: false, message: `Falta: ${googleMissingConfig().join(", ")}` };
  } else {
    return { ok: false, message: "Integración desconocida" };
  }
  const now = new Date();
  await db.integrationState.upsert({
    where: { key },
    create: { key, lastCheckAt: now, lastOkAt: result.ok ? now : null, lastError: result.ok ? null : result.message },
    update: { lastCheckAt: now, ...(result.ok ? { lastOkAt: now, lastError: null } : { lastError: result.message }) },
  });
  return result;
}
