-- AlterTable
ALTER TABLE `PromoBanner` ADD COLUMN `placement` ENUM('TOP', 'MID', 'WIDE') NOT NULL DEFAULT 'TOP';


-- Ubicación de los banners iniciales
UPDATE `PromoBanner` SET `placement` = 'MID', `sortOrder` = 4 WHERE `id` = 'bnr_garantia';
UPDATE `PromoBanner` SET `placement` = 'MID', `sortOrder` = 5 WHERE `id` = 'bnr_cuentas';

-- Banners adicionales (imágenes originales en /public/promo)
INSERT INTO `PromoBanner` (`id`, `title`, `imageUrl`, `href`, `placement`, `sortOrder`, `active`, `createdAt`, `updatedAt`) VALUES
  ('bnr_nequi', 'Paga tus diamantes con Nequi', '/promo/nequi.svg', '/recargas', 'TOP', 4, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('bnr_codigos', '¿Tienes un código promocional? Aplícalo al pagar', '/promo/codigos.svg', '/recargas', 'TOP', 5, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('bnr_rastreo', 'Sigue tu pedido en vivo', '/promo/rastreo.svg', '/pedido', 'MID', 1, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('bnr_sinclaves', 'Solo tu ID, cero contraseñas', '/promo/sinclaves.svg', '/recargas', 'MID', 2, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('bnr_soporte', 'Soporte de verdad con tu número de pedido', '/promo/soporte.svg', '/ayuda', 'MID', 3, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('bnr_filtros', 'Encuentra tu cuenta ideal por rango, nivel y precio', '/promo/filtros.svg', '/cuentas', 'MID', 6, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('bnr_wide_cuentas', 'Cuentas Free Fire: rango, nivel y skins a la vista', '/promo/wide-cuentas.svg', '/cuentas', 'WIDE', 1, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3));
