-- Costo real y tasa del día: lo que de verdad cobró el proveedor en cada entrega y la tasa del dólar de cada día.
-- Solo agrega dos columnas vacías a Delivery y una tabla nueva; no cambia ni borra datos.

-- AlterTable
ALTER TABLE `Delivery` ADD COLUMN `costCents` INTEGER NULL,
    ADD COLUMN `costCheckedAt` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `FxDay` (
    `day` VARCHAR(10) NOT NULL,
    `copPerUsd` DOUBLE NOT NULL,
    `source` VARCHAR(20) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`day`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
