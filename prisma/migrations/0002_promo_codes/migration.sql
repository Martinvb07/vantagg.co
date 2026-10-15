-- DropForeignKey
ALTER TABLE `PromotionItem` DROP FOREIGN KEY `PromotionItem_accountId_fkey`;

-- DropForeignKey
ALTER TABLE `PromotionItem` DROP FOREIGN KEY `PromotionItem_packageId_fkey`;

-- DropForeignKey
ALTER TABLE `PromotionItem` DROP FOREIGN KEY `PromotionItem_promotionId_fkey`;

-- AlterTable
ALTER TABLE `Order` DROP COLUMN `promotionId`,
    ADD COLUMN `promoCode` VARCHAR(32) NULL;

-- DropTable
DROP TABLE `Promotion`;

-- DropTable
DROP TABLE `PromotionItem`;

-- CreateTable
CREATE TABLE `PromoCode` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(32) NOT NULL,
    `description` VARCHAR(255) NULL,
    `discountType` ENUM('PERCENT', 'FIXED') NOT NULL DEFAULT 'PERCENT',
    `value` INTEGER NOT NULL,
    `maxDiscount` INTEGER NULL,
    `minSubtotal` INTEGER NULL,
    `scope` ENUM('ALL', 'TOPUP', 'ACCOUNT') NOT NULL DEFAULT 'ALL',
    `startsAt` DATETIME(3) NULL,
    `endsAt` DATETIME(3) NULL,
    `maxUses` INTEGER NULL,
    `maxUsesPerEmail` INTEGER NOT NULL DEFAULT 1,
    `uses` INTEGER NOT NULL DEFAULT 0,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `isDemo` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PromoCode_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PromoRedemption` (
    `id` VARCHAR(191) NOT NULL,
    `promoCodeId` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `discount` INTEGER NOT NULL,
    `status` ENUM('RESERVED', 'CONFIRMED', 'RELEASED') NOT NULL DEFAULT 'RESERVED',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PromoRedemption_orderId_key`(`orderId`),
    INDEX `PromoRedemption_promoCodeId_email_idx`(`promoCodeId`, `email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PromoRedemption` ADD CONSTRAINT `PromoRedemption_promoCodeId_fkey` FOREIGN KEY (`promoCodeId`) REFERENCES `PromoCode`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PromoRedemption` ADD CONSTRAINT `PromoRedemption_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

