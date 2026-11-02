-- Cliente que dejó pedidos sin pagar: al borrar esos pedidos se guarda solo el cliente (correo, ID de jugador,
-- cuántos dejó sin pagar y cuándo fue su último pedido). Solo agrega columnas; no cambia datos existentes.
ALTER TABLE `EmailContact` ADD COLUMN `unpaidOrders` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `lastOrderAt` DATETIME(3) NULL;
