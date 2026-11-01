-- Correos de ofertas con autorización del cliente (Ley 1581). Solo agrega columnas; no cambia datos existentes:
-- nadie queda suscrito sin haberlo aceptado.
ALTER TABLE `User` ADD COLUMN `marketingOptIn` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `marketingConsentAt` DATETIME(3) NULL,
    ADD COLUMN `marketingOptOutAt` DATETIME(3) NULL;
