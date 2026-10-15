-- AlterTable
ALTER TABLE `AccountListing` MODIFY `inventoryVerified` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `Order` ADD COLUMN `chatLastAt` DATETIME(3) NULL,
    ADD COLUMN `chatUnreadCustomer` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `chatUnreadStaff` INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `OrderMessage` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `author` ENUM('CUSTOMER', 'STAFF', 'SYSTEM') NOT NULL,
    `staffId` VARCHAR(191) NULL,
    `body` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `OrderMessage_orderId_createdAt_idx`(`orderId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Order_type_chatLastAt_idx` ON `Order`(`type`, `chatLastAt`);

-- AddForeignKey
ALTER TABLE `OrderMessage` ADD CONSTRAINT `OrderMessage_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


-- Por ahora vende un solo dueño: todas las cuentas publicadas quedan revisadas.
UPDATE `AccountListing` SET `inventoryVerified` = true, `inventoryVerifiedAt` = COALESCE(`inventoryVerifiedAt`, CURRENT_TIMESTAMP(3)) WHERE `inventoryVerified` = false;

-- Pedidos de cuentas ya pagados entran a la bandeja de chats.
UPDATE `Order` SET `chatLastAt` = COALESCE(`paidAt`, `createdAt`) WHERE `type` = 'ACCOUNT' AND `status` NOT IN ('PENDING_PAYMENT', 'CANCELLED');
