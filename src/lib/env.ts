import "server-only";

/**
 * Acceso centralizado a variables de entorno del SERVIDOR.
 * Nada de este módulo puede importarse desde componentes cliente
 * (lo garantiza "server-only").
 */
function read(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : undefined;
}

export const isProduction = process.env.NODE_ENV === "production";

export const env = {
  appUrl: (read("APP_URL") ?? "http://localhost:3000").replace(/\/$/, ""),
  authSecret: read("AUTH_SECRET"),
  dataKey: read("DATA_ENCRYPTION_KEY"),
  paymentProviders: (read("PAYMENT_PROVIDER") ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
  /** Bold (Colombia): llave de identidad, llave secreta y modo pruebas (en pruebas la firma del webhook usa llave vacía). */
  bold: {
    apiKey: read("BOLD_API_KEY"),
    secretKey: read("BOLD_SECRET_KEY"),
    testMode: read("BOLD_TEST_MODE") === "true",
  },
  topup: {
    provider: (read("TOPUP_PROVIDER") ?? "").toLowerCase(),
    baseUrl: read("TOPUP_API_BASE_URL"),
    apiKey: read("TOPUP_API_KEY"),
    webhookSecret: read("TOPUP_WEBHOOK_SECRET"),
    /** true = todos los pedidos al proveedor se envían como prueba (no se cobran ni se entregan). */
    forceTest: read("TOPUP_TEST_MODE") === "true",
  },
  storage: {
    endpoint: read("STORAGE_ENDPOINT"),
    region: read("STORAGE_REGION") ?? "auto",
    accessKey: read("STORAGE_ACCESS_KEY"),
    secretKey: read("STORAGE_SECRET_KEY"),
    bucket: read("STORAGE_BUCKET"),
    publicUrl: read("STORAGE_PUBLIC_URL"),
  },
  notify: {
    provider: (read("NOTIFY_PROVIDER") ?? "log").toLowerCase(),
    resendApiKey: read("RESEND_API_KEY"),
    /** Modo prueba: si tiene correos, SOLO se envía a esos (Resend sin dominio verificado solo permite tu propio correo). */
    onlyTo: (read("NOTIFY_ONLY_TO") ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
    fromEmail: read("NOTIFY_FROM_EMAIL"),
    smtp: {
      host: read("SMTP_HOST"),
      port: Number(read("SMTP_PORT") ?? 587),
      user: read("SMTP_USER"),
      pass: read("SMTP_PASS"),
    },
  },
  google: {
    clientId: read("GOOGLE_CLIENT_ID"),
    clientSecret: read("GOOGLE_CLIENT_SECRET"),
  },
  cronSecret: read("CRON_SECRET"),
  trustedIpHeader: read("TRUSTED_IP_HEADER")?.toLowerCase(),
  /** Ruta secreta de acceso al panel (sin barras). En producción es obligatoria: sin ella el panel queda inaccesible. */
  adminPath: (read("ADMIN_PATH") ?? (isProduction ? "" : "equipo-dev")).replace(/^\/+|\/+$/g, ""),
};

/** Secreto de sesión. En desarrollo se deriva uno estable con aviso; en producción es obligatorio. */
export function getAuthSecret(): string {
  if (env.authSecret && env.authSecret.length >= 32) return env.authSecret;
  if (isProduction) {
    throw new Error("AUTH_SECRET no está configurado (mínimo 32 caracteres).");
  }
  return "dev-only-insecure-secret-change-me-0000000000";
}

/** Enmascara un secreto para mostrarlo en el panel: "prv_te…9f2a". */
export function mask(value: string | undefined): string | null {
  if (!value) return null;
  if (value.length <= 8) return "••••";
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}
