-- Gastos del negocio (Panel → Contabilidad) para la ganancia neta. Solo agrega una tabla nueva.

-- CreateTable
CREATE TABLE `Expense` (
    `id` VARCHAR(191) NOT NULL,
    `day` VARCHAR(10) NOT NULL,
    `category` VARCHAR(40) NOT NULL,
    `concept` VARCHAR(200) NOT NULL,
    `amountCop` INTEGER NOT NULL,
    `createdById` VARCHAR(191) NULL,
    `createdByName` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Expense_day_idx`(`day`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

