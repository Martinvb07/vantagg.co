-- AlterTable
ALTER TABLE `DiamondPackage` ADD COLUMN `costCents` INTEGER NULL,
    ADD COLUMN `region` VARCHAR(60) NOT NULL DEFAULT 'latam',
    ADD COLUMN `supplierOutOfStock` BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX `DiamondPackage_region_active_idx` ON `DiamondPackage`(`region`, `active`);

-- CreateTable
CREATE TABLE `SupplierProduct` (
    `productKey` VARCHAR(191) NOT NULL,
    `game` VARCHAR(60) NOT NULL,
    `regionSlug` VARCHAR(60) NOT NULL,
    `regionName` VARCHAR(100) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `amount` INTEGER NULL,
    `unit` VARCHAR(30) NULL,
    `priceCents` INTEGER NOT NULL,
    `outOfStock` BOOLEAN NOT NULL DEFAULT false,
    `delivery` VARCHAR(20) NOT NULL,
    `syncedAt` DATETIME(3) NOT NULL,

    INDEX `SupplierProduct_game_regionSlug_idx`(`game`, `regionSlug`),
    PRIMARY KEY (`productKey`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
