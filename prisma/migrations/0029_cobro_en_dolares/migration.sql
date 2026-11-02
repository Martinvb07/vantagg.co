-- Cobro en dólares para clientes de otros países (ePayco). Solo agrega columnas opcionales: los pedidos existentes
-- quedan igual (sin moneda de cobro = se cobró el total en pesos).
ALTER TABLE `Order` ADD COLUMN `chargeCurrency` VARCHAR(3) NULL,
    ADD COLUMN `chargeAmount` INTEGER NULL;
