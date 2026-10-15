-- AlterTable
ALTER TABLE `Order` ADD COLUMN `chatCustomerReadAt` DATETIME(3) NULL,
    ADD COLUMN `chatStaffReadAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `OrderMessage` ADD COLUMN `attachmentId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `ChatAttachment` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `mime` VARCHAR(20) NOT NULL,
    `size` INTEGER NOT NULL,
    `width` INTEGER NULL,
    `height` INTEGER NULL,
    `data` MEDIUMBLOB NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ChatAttachment_orderId_idx`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `OrderMessage_attachmentId_key` ON `OrderMessage`(`attachmentId`);

-- AddForeignKey
ALTER TABLE `OrderMessage` ADD CONSTRAINT `OrderMessage_attachmentId_fkey` FOREIGN KEY (`attachmentId`) REFERENCES `ChatAttachment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatAttachment` ADD CONSTRAINT `ChatAttachment_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
