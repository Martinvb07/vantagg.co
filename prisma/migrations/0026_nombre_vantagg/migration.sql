-- Cambio de marca: el nombre de la tienda pasa de VANTA a VANTAGG (correos, títulos y avisos).
-- Solo si sigue con el nombre anterior; un nombre personalizado en Ajustes no se toca.
UPDATE `Setting` SET `value` = 'VANTAGG', `updatedAt` = NOW(3) WHERE `key` = 'storeName' AND `value` IN ('VANTA', 'Vanta');
