-- Nueva ubicación: Centro de ayuda
ALTER TABLE `PromoBanner` MODIFY `placement` ENUM('TOP', 'HOME_TRUST', 'WIDE', 'HOME_BOTTOM', 'TOPUP_SIDE', 'CATALOG_FEED', 'ACCOUNT_SIDE', 'TRACK_SIDE', 'HELP_SIDE') NOT NULL DEFAULT 'TOP';

-- Cada banner en su sección
UPDATE `PromoBanner` SET `placement` = 'HELP_SIDE', `sortOrder` = 1, `href` = '/ayuda#contacto' WHERE `id` = 'bnr_soporte';
UPDATE `PromoBanner` SET `placement` = 'TRACK_SIDE', `sortOrder` = 1, `href` = NULL WHERE `id` = 'bnr_rastreo';
DELETE FROM `PromoBanner` WHERE `id` = 'bnr_side_soporte';

-- Paquete recomendado: 5.600 diamantes
UPDATE `DiamondPackage` SET `label` = 'NONE' WHERE `label` = 'RECOMMENDED';
UPDATE `DiamondPackage` SET `label` = 'RECOMMENDED' WHERE `slug` = 'diamantes-5600';
