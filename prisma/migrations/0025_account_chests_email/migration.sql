-- Cuentas: cantidad de pechos y estado del correo vinculado (CONFIRMED | PENDING).
ALTER TABLE `AccountListing`
  ADD COLUMN `chestsCount` INT NULL,
  ADD COLUMN `emailStatus` VARCHAR(16) NULL;
