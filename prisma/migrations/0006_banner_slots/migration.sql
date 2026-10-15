-- Ubicaciones estratégicas para banners
-- 1) Amplía el enum conservando MID temporalmente
ALTER TABLE `PromoBanner` MODIFY `placement` ENUM('TOP', 'MID', 'WIDE', 'HOME_TRUST', 'HOME_BOTTOM', 'TOPUP_SIDE', 'CATALOG_FEED', 'ACCOUNT_SIDE', 'TRACK_SIDE') NOT NULL DEFAULT 'TOP';

-- 2) Reubica los banners de la cuadrícula
UPDATE `PromoBanner` SET `placement` = 'HOME_TRUST', `sortOrder` = 1 WHERE `id` = 'bnr_sinclaves';
UPDATE `PromoBanner` SET `placement` = 'HOME_TRUST', `sortOrder` = 2 WHERE `id` = 'bnr_garantia';
UPDATE `PromoBanner` SET `placement` = 'HOME_BOTTOM', `sortOrder` = 1 WHERE `id` = 'bnr_rastreo';
UPDATE `PromoBanner` SET `placement` = 'HOME_BOTTOM', `sortOrder` = 2 WHERE `id` = 'bnr_soporte';
UPDATE `PromoBanner` SET `placement` = 'CATALOG_FEED', `sortOrder` = 1 WHERE `id` = 'bnr_cuentas';
UPDATE `PromoBanner` SET `placement` = 'CATALOG_FEED', `sortOrder` = 2 WHERE `id` = 'bnr_filtros';
UPDATE `PromoBanner` SET `placement` = 'HOME_TRUST' WHERE `placement` = 'MID';

-- 3) Enum definitivo
ALTER TABLE `PromoBanner` MODIFY `placement` ENUM('TOP', 'HOME_TRUST', 'WIDE', 'HOME_BOTTOM', 'TOPUP_SIDE', 'CATALOG_FEED', 'ACCOUNT_SIDE', 'TRACK_SIDE') NOT NULL DEFAULT 'TOP';

-- 4) Banners contextuales en otras páginas
INSERT INTO `PromoBanner` (`id`, `title`, `imageUrl`, `href`, `placement`, `sortOrder`, `active`, `createdAt`, `updatedAt`) VALUES
  ('bnr_side_codigos', '¿Tienes un código promocional? Aplícalo al pagar', '/promo/codigos.svg', NULL, 'TOPUP_SIDE', 1, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('bnr_side_garantia', 'Si la entrega falla, te devolvemos tu dinero', '/promo/garantia.svg', '/legal/reembolsos', 'ACCOUNT_SIDE', 1, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('bnr_side_soporte', 'Soporte de verdad con tu número de pedido', '/promo/soporte.svg', '/ayuda#contacto', 'TRACK_SIDE', 1, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3));
