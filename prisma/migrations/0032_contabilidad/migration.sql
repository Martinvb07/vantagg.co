-- Contabilidad (Panel → Contabilidad): fecha del reembolso en cada pedido e índices para buscar por fecha de pago.
-- Solo agrega una columna e índices. Rellena la fecha de los pedidos ya reembolsados con la del cambio de estado
-- de su historial (o, si no aparece, con su última actualización); no cambia ningún otro dato.

-- AlterTable
ALTER TABLE `Order` ADD COLUMN `refundedAt` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `Order_paidAt_idx` ON `Order`(`paidAt`);

-- CreateIndex
CREATE INDEX `Order_refundedAt_idx` ON `Order`(`refundedAt`);

-- Reembolsos anteriores: fecha del evento «… → Reembolsado» del historial del pedido.
UPDATE `Order` o
SET o.`refundedAt` = (
  SELECT MAX(e.`createdAt`) FROM `OrderEvent` e
  WHERE e.`orderId` = o.`id` AND e.`type` = 'STATUS_CHANGED' AND e.`message` LIKE '%→ Reembolsado%'
)
WHERE o.`status` = 'REFUNDED' AND o.`refundedAt` IS NULL;

UPDATE `Order` SET `refundedAt` = `updatedAt` WHERE `status` = 'REFUNDED' AND `refundedAt` IS NULL;
