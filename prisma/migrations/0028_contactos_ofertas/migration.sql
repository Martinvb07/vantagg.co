-- Compradores sin cuenta que aceptan ofertas al pagar. Tabla nueva; no cambia datos existentes.
CREATE TABLE `EmailContact` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `playerId` VARCHAR(12) NULL,
    `optIn` BOOLEAN NOT NULL DEFAULT true,
    `consentAt` DATETIME(3) NULL,
    `optOutAt` DATETIME(3) NULL,
    `source` VARCHAR(40) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `EmailContact_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
