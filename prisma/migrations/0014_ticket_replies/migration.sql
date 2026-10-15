-- CreateTable
CREATE TABLE `TicketReply` (
    `id` VARCHAR(191) NOT NULL,
    `ticketId` VARCHAR(191) NOT NULL,
    `authorEmail` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `delivery` VARCHAR(20) NOT NULL,
    `error` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TicketReply_ticketId_idx`(`ticketId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TicketReply` ADD CONSTRAINT `TicketReply_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `SupportTicket`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

