import { z } from "zod";

// Mensajes de error por defecto en español (los que no tienen un texto propio).
z.config(z.locales.es());

export const playerIdSchema = z
  .string()
  .trim()
  .regex(/^\d{6,12}$/, "El ID de jugador debe tener entre 6 y 12 dígitos numéricos.");

export const emailSchema = z.string().trim().toLowerCase().email("Ingresa un correo válido.").max(160);

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[\d\s-]{7,20}$/, "Ingresa un teléfono válido.")
  .optional()
  .or(z.literal("").transform(() => undefined));

export const promoCodeInputSchema = z
  .string()
  .trim()
  .max(32, "Código inválido.")
  .optional()
  .transform((v) => (v ? v : undefined));

export const idempotencyKeySchema = z.string().uuid("Solicitud inválida.");

export const topUpOrderSchema = z.object({
  packageId: z.string().min(1).max(40),
  playerId: playerIdSchema,
  email: emailSchema,
  paymentProvider: z.string().min(1).max(30),
  idempotencyKey: idempotencyKeySchema,
  promoCode: promoCodeInputSchema,
  acceptTerms: z.literal(true, { error: "Debes aceptar los términos y condiciones." }),
});

export const accountOrderSchema = z.object({
  accountId: z.string().min(1).max(40),
  email: emailSchema,
  name: z.string().trim().min(2, "Ingresa tu nombre.").max(80),
  phone: phoneSchema,
  paymentProvider: z.string().min(1).max(30),
  idempotencyKey: idempotencyKeySchema,
  promoCode: promoCodeInputSchema,
  acceptTerms: z.literal(true, { error: "Debes aceptar los términos y condiciones." }),
});

export const passwordSchema = z
  .string()
  .min(10, "La contraseña debe tener al menos 10 caracteres.")
  .max(128)
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), "Incluye letras y números.");

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Ingresa tu nombre.").max(80),
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Ingresa tu contraseña.").max(128),
});

export const trackingSchema = z.object({
  number: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,6}-[A-Z0-9]{4}-[A-Z0-9]{4}$/, "Número de pedido inválido."),
  email: emailSchema,
});

export const ticketSchema = z.object({
  email: emailSchema,
  orderNumber: z.string().trim().toUpperCase().max(20).optional().or(z.literal("")),
  topic: z.enum(["pedido", "pago", "entrega", "cuenta", "reembolso", "otro"]),
  message: z.string().trim().min(15, "Cuéntanos un poco más (mínimo 15 caracteres).").max(2000),
});

export const claimSchema = z.object({
  accountId: z.string().min(1).max(40),
  email: emailSchema,
  reason: z.string().trim().min(20, "Describe la reclamación (mínimo 20 caracteres).").max(3000),
});

export function firstError(err: z.ZodError): string {
  return err.issues[0]?.message ?? "Datos inválidos.";
}
