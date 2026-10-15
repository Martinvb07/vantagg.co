-- AlterTable
ALTER TABLE `AccountListing` MODIFY `region` VARCHAR(191) NOT NULL DEFAULT 'LATAM';


-- Normaliza datos existentes a los catálogos de src/domain/freefire.ts
UPDATE `AccountListing` SET `rank` = CASE `rank`
  WHEN 'Gran Maestro' THEN 'GRAN_MAESTRO' WHEN 'Maestro' THEN 'HEROICO' WHEN 'Heroico' THEN 'HEROICO'
  WHEN 'Diamante' THEN 'DIAMANTE' WHEN 'Platino' THEN 'PLATINO' WHEN 'Oro' THEN 'ORO'
  WHEN 'Plata' THEN 'PLATA' WHEN 'Bronce' THEN 'BRONCE' ELSE `rank` END;
UPDATE `AccountListing` SET `region` = 'LATAM'
  WHERE `region` NOT IN ('BR','LATAM','SAC','NA','EU','ID','TH','VN','IND','TW','PK','BD','MEA');
