-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `role` ENUM('CUSTOMER', 'SUPPORT', 'ADMIN') NOT NULL DEFAULT 'CUSTOMER',
    `disabled` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Session` (
    `id` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `ipHash` VARCHAR(191) NULL,
    `userAgent` VARCHAR(255) NULL,

    UNIQUE INDEX `Session_tokenHash_key`(`tokenHash`),
    INDEX `Session_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Setting` (
    `key` VARCHAR(191) NOT NULL,
    `value` TEXT NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DiamondPackage` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `diamonds` INTEGER NOT NULL,
    `bonusDiamonds` INTEGER NOT NULL DEFAULT 0,
    `price` INTEGER NOT NULL,
    `compareAtPrice` INTEGER NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'COP',
    `label` ENUM('NONE', 'BEST_SELLER', 'OFFER', 'BONUS', 'RECOMMENDED') NOT NULL DEFAULT 'NONE',
    `available` BOOLEAN NOT NULL DEFAULT true,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `featured` BOOLEAN NOT NULL DEFAULT false,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `providerSku` VARCHAR(191) NULL,
    `isDemo` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `DiamondPackage_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AccountListing` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `price` INTEGER NOT NULL,
    `compareAtPrice` INTEGER NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'COP',
    `level` INTEGER NULL,
    `skinsCount` INTEGER NULL,
    `inventoryItems` TEXT NOT NULL,
    `rank` VARCHAR(191) NULL,
    `region` VARCHAR(191) NOT NULL DEFAULT 'Colombia / LATAM',
    `deliveryConditions` TEXT NOT NULL,
    `extraInfo` TEXT NULL,
    `label` ENUM('NONE', 'BEST_SELLER', 'OFFER', 'BONUS', 'RECOMMENDED') NOT NULL DEFAULT 'NONE',
    `status` ENUM('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'RESERVED', 'SOLD', 'PAUSED', 'SUSPENDED', 'RETIRED') NOT NULL DEFAULT 'DRAFT',
    `featured` BOOLEAN NOT NULL DEFAULT false,
    `isDemo` BOOLEAN NOT NULL DEFAULT false,
    `inventoryVerified` BOOLEAN NOT NULL DEFAULT false,
    `inventoryVerifiedAt` DATETIME(3) NULL,
    `provenanceSource` VARCHAR(255) NULL,
    `provenanceNotes` TEXT NULL,
    `authorizationConfirmed` BOOLEAN NOT NULL DEFAULT false,
    `provenanceVerifiedAt` DATETIME(3) NULL,
    `provenanceVerifiedById` VARCHAR(191) NULL,
    `reservedUntil` DATETIME(3) NULL,
    `reservedOrderId` VARCHAR(191) NULL,
    `soldAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AccountListing_slug_key`(`slug`),
    INDEX `AccountListing_status_idx`(`status`),
    INDEX `AccountListing_price_idx`(`price`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AccountImage` (
    `id` VARCHAR(191) NOT NULL,
    `accountId` VARCHAR(191) NOT NULL,
    `url` VARCHAR(1024) NOT NULL,
    `alt` VARCHAR(191) NOT NULL DEFAULT '',
    `sortOrder` INTEGER NOT NULL DEFAULT 0,

    INDEX `AccountImage_accountId_idx`(`accountId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AccountTag` (
    `accountId` VARCHAR(191) NOT NULL,
    `tag` VARCHAR(64) NOT NULL,

    INDEX `AccountTag_tag_idx`(`tag`),
    PRIMARY KEY (`accountId`, `tag`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ListingClaim` (
    `id` VARCHAR(191) NOT NULL,
    `accountId` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `reason` TEXT NOT NULL,
    `status` ENUM('OPEN', 'REVIEWING', 'UPHELD', 'DISMISSED') NOT NULL DEFAULT 'OPEN',
    `resolution` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ListingClaim_accountId_idx`(`accountId`),
    INDEX `ListingClaim_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Promotion` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `badge` VARCHAR(40) NULL,
    `discountType` ENUM('PERCENT', 'FIXED') NOT NULL DEFAULT 'PERCENT',
    `value` INTEGER NOT NULL,
    `startsAt` DATETIME(3) NOT NULL,
    `endsAt` DATETIME(3) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `featured` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PromotionItem` (
    `id` VARCHAR(191) NOT NULL,
    `promotionId` VARCHAR(191) NOT NULL,
    `packageId` VARCHAR(191) NULL,
    `accountId` VARCHAR(191) NULL,

    UNIQUE INDEX `PromotionItem_promotionId_packageId_key`(`promotionId`, `packageId`),
    UNIQUE INDEX `PromotionItem_promotionId_accountId_key`(`promotionId`, `accountId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Order` (
    `id` VARCHAR(191) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `type` ENUM('TOPUP', 'ACCOUNT') NOT NULL,
    `status` ENUM('PENDING_PAYMENT', 'PAID', 'PROCESSING', 'DELIVERED', 'DELIVERY_FAILED', 'REFUND_REQUESTED', 'REFUNDED', 'CANCELLED') NOT NULL DEFAULT 'PENDING_PAYMENT',
    `idempotencyKey` VARCHAR(191) NOT NULL,
    `trackingToken` VARCHAR(191) NOT NULL,
    `isTest` BOOLEAN NOT NULL DEFAULT false,
    `userId` VARCHAR(191) NULL,
    `customerEmail` VARCHAR(191) NOT NULL,
    `customerName` VARCHAR(191) NULL,
    `customerPhone` VARCHAR(191) NULL,
    `packageId` VARCHAR(191) NULL,
    `playerId` VARCHAR(191) NULL,
    `playerNickname` VARCHAR(191) NULL,
    `accountId` VARCHAR(191) NULL,
    `itemSnapshot` JSON NOT NULL,
    `subtotal` INTEGER NOT NULL,
    `discount` INTEGER NOT NULL DEFAULT 0,
    `total` INTEGER NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'COP',
    `promotionId` VARCHAR(191) NULL,
    `paymentProvider` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `paidAt` DATETIME(3) NULL,
    `deliveredAt` DATETIME(3) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Order_number_key`(`number`),
    UNIQUE INDEX `Order_idempotencyKey_key`(`idempotencyKey`),
    UNIQUE INDEX `Order_trackingToken_key`(`trackingToken`),
    INDEX `Order_status_idx`(`status`),
    INDEX `Order_customerEmail_idx`(`customerEmail`),
    INDEX `Order_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Payment` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `providerRef` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'DECLINED', 'VOIDED', 'ERROR') NOT NULL DEFAULT 'PENDING',
    `method` VARCHAR(191) NULL,
    `amount` INTEGER NOT NULL,
    `currency` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Payment_orderId_idx`(`orderId`),
    UNIQUE INDEX `Payment_provider_providerRef_key`(`provider`, `providerRef`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Delivery` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `providerRef` VARCHAR(191) NULL,
    `idempotencyKey` VARCHAR(191) NOT NULL,
    `status` ENUM('QUEUED', 'PROCESSING', 'SUCCESS', 'FAILED') NOT NULL DEFAULT 'QUEUED',
    `simulated` BOOLEAN NOT NULL DEFAULT false,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `lastError` TEXT NULL,
    `lockedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Delivery_orderId_key`(`orderId`),
    UNIQUE INDEX `Delivery_idempotencyKey_key`(`idempotencyKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrderEvent` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(64) NOT NULL,
    `message` TEXT NOT NULL,
    `actor` VARCHAR(120) NOT NULL,
    `data` JSON NULL,
    `public` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `OrderEvent_orderId_idx`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AdminNote` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `authorId` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AdminNote_orderId_idx`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WebhookEvent` (
    `id` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `externalId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NULL,
    `signatureValid` BOOLEAN NOT NULL,
    `payload` JSON NOT NULL,
    `processedAt` DATETIME(3) NULL,
    `error` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `WebhookEvent_provider_externalId_key`(`provider`, `externalId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `actorId` VARCHAR(191) NULL,
    `action` VARCHAR(80) NOT NULL,
    `entity` VARCHAR(60) NOT NULL,
    `entityId` VARCHAR(191) NULL,
    `data` JSON NULL,
    `ipHash` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_entity_entityId_idx`(`entity`, `entityId`),
    INDEX `AuditLog_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SupportTicket` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NULL,
    `email` VARCHAR(191) NOT NULL,
    `topic` VARCHAR(60) NOT NULL,
    `message` TEXT NOT NULL,
    `status` ENUM('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED') NOT NULL DEFAULT 'OPEN',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SupportTicket_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Notification` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NULL,
    `channel` VARCHAR(20) NOT NULL,
    `recipient` VARCHAR(191) NOT NULL,
    `template` VARCHAR(60) NOT NULL,
    `status` ENUM('PENDING', 'SENT', 'FAILED', 'SKIPPED') NOT NULL DEFAULT 'PENDING',
    `error` TEXT NULL,
    `sentAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Notification_orderId_template_key`(`orderId`, `template`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `IntegrationState` (
    `key` VARCHAR(191) NOT NULL,
    `lastCheckAt` DATETIME(3) NULL,
    `lastOkAt` DATETIME(3) NULL,
    `lastError` TEXT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Session` ADD CONSTRAINT `Session_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AccountImage` ADD CONSTRAINT `AccountImage_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `AccountListing`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AccountTag` ADD CONSTRAINT `AccountTag_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `AccountListing`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ListingClaim` ADD CONSTRAINT `ListingClaim_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `AccountListing`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PromotionItem` ADD CONSTRAINT `PromotionItem_promotionId_fkey` FOREIGN KEY (`promotionId`) REFERENCES `Promotion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PromotionItem` ADD CONSTRAINT `PromotionItem_packageId_fkey` FOREIGN KEY (`packageId`) REFERENCES `DiamondPackage`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PromotionItem` ADD CONSTRAINT `PromotionItem_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `AccountListing`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_packageId_fkey` FOREIGN KEY (`packageId`) REFERENCES `DiamondPackage`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `AccountListing`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Delivery` ADD CONSTRAINT `Delivery_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderEvent` ADD CONSTRAINT `OrderEvent_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AdminNote` ADD CONSTRAINT `AdminNote_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AdminNote` ADD CONSTRAINT `AdminNote_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupportTicket` ADD CONSTRAINT `SupportTicket_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

