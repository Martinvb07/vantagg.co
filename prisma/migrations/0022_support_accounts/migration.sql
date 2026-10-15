-- Soporte desde la cuenta: la solicitud queda ligada al cliente y él puede responder.

-- AlterTable
ALTER TABLE `SupportTicket` ADD COLUMN `userId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `TicketReply` ADD COLUMN `fromCustomer` BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX `SupportTicket_userId_idx` ON `SupportTicket`(`userId`);

-- CreateIndex
CREATE INDEX `SupportTicket_email_idx` ON `SupportTicket`(`email`);

-- AddForeignKey
ALTER TABLE `SupportTicket` ADD CONSTRAINT `SupportTicket_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
