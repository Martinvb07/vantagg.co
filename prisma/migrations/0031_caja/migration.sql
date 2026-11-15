-- Caja (Panel → Caja): cierres de caja y recargas de saldo al proveedor anotadas.
-- Solo agrega tablas y dos columnas vacías a Order (a qué cierre pertenece cada venta y cada reembolso);
-- no cambia ni borra datos existentes.
-- AlterTable
ALTER TABLE `Order` ADD COLUMN `cashCloseId` VARCHAR(191) NULL,
    ADD COLUMN `refundCloseId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `CashClose` (
    `id` VARCHAR(191) NOT NULL,
    `number` INTEGER NOT NULL,
    `opening` BOOLEAN NOT NULL DEFAULT false,
    `closedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `closedById` VARCHAR(191) NULL,
    `closedByName` VARCHAR(191) NULL,
    `note` TEXT NULL,
    `orders` INTEGER NOT NULL DEFAULT 0,
    `salesCop` INTEGER NOT NULL DEFAULT 0,
    `costCents` INTEGER NOT NULL DEFAULT 0,
    `usdtCop` INTEGER NOT NULL DEFAULT 0,
    `feeCop` INTEGER NOT NULL DEFAULT 0,
    `refunds` INTEGER NOT NULL DEFAULT 0,
    `refundsCop` INTEGER NOT NULL DEFAULT 0,
    `refundsCostCents` INTEGER NOT NULL DEFAULT 0,
    `deliveries` INTEGER NOT NULL DEFAULT 0,
    `deliveriesCostCents` INTEGER NOT NULL DEFAULT 0,
    `prizes` INTEGER NOT NULL DEFAULT 0,
    `prizesCostCents` INTEGER NOT NULL DEFAULT 0,
    `rechargeCents` INTEGER NOT NULL DEFAULT 0,
    `rechargeCop` INTEGER NOT NULL DEFAULT 0,
    `supplierBalanceCents` INTEGER NULL,
    `expectedBalanceCents` INTEGER NULL,
    `supplierCurrency` VARCHAR(8) NULL,
    `breakdown` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CashClose_number_key`(`number`),
    INDEX `CashClose_closedAt_idx`(`closedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SupplierRecharge` (
    `id` VARCHAR(191) NOT NULL,
    `amountCents` INTEGER NOT NULL,
    `rateCop` INTEGER NOT NULL,
    `note` VARCHAR(300) NULL,
    `createdById` VARCHAR(191) NULL,
    `createdByName` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SupplierRecharge_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Order_cashCloseId_idx` ON `Order`(`cashCloseId`);

-- CreateIndex
CREATE INDEX `Order_refundCloseId_idx` ON `Order`(`refundCloseId`);

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_cashCloseId_fkey` FOREIGN KEY (`cashCloseId`) REFERENCES `CashClose`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_refundCloseId_fkey` FOREIGN KEY (`refundCloseId`) REFERENCES `CashClose`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

