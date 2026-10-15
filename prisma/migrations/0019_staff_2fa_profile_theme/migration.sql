-- AlterTable
ALTER TABLE `User` ADD COLUMN `profileTheme` VARCHAR(20) NULL,
    ADD COLUMN `recoveryCodes` JSON NULL,
    ADD COLUMN `totpEnabledAt` DATETIME(3) NULL,
    ADD COLUMN `totpLastStep` INTEGER NULL,
    ADD COLUMN `totpPendingSecret` TEXT NULL,
    ADD COLUMN `totpSecret` TEXT NULL;


-- El 2FA pasa a ser obligatorio para el equipo: se cierran sus sesiones actuales.
DELETE `Session` FROM `Session` JOIN `User` ON `User`.`id` = `Session`.`userId` WHERE `User`.`role` IN ('ADMIN', 'SUPPORT');
