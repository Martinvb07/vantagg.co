-- AlterTable
ALTER TABLE `Order` ADD COLUMN `chatEmailedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `User` ADD COLUMN `emailVerifiedAt` DATETIME(3) NULL,
    ADD COLUMN `googleSub` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `EmailCode` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `purpose` ENUM('LOGIN', 'VERIFY') NOT NULL,
    `codeHash` VARCHAR(128) NOT NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `expiresAt` DATETIME(3) NOT NULL,
    `consumedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `EmailCode_email_purpose_createdAt_idx`(`email`, `purpose`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmailLog` (
    `id` VARCHAR(191) NOT NULL,
    `to` VARCHAR(191) NOT NULL,
    `template` VARCHAR(40) NOT NULL,
    `subject` VARCHAR(200) NOT NULL,
    `status` VARCHAR(20) NOT NULL,
    `error` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `EmailLog_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `User_googleSub_key` ON `User`(`googleSub`);


-- El equipo existente ya usa su correo para ingresar: queda verificado.
UPDATE `User` SET `emailVerifiedAt` = CURRENT_TIMESTAMP(3) WHERE `role` IN ('ADMIN', 'SUPPORT') AND `emailVerifiedAt` IS NULL;
