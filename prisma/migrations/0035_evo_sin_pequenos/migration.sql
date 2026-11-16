-- Armas Evo que ya no se venden: 10 fragmentos y 1 caja. Solo se ocultan (no se borra nada: pedidos e historial siguen
-- igual) y se pueden volver a activar en Panel → Paquetes. Los precios no se tocan aquí.
UPDATE `DiamondPackage`
SET `active` = false, `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `diamonds` = 0 AND `name` IN ('10 Fragmentos de arma Evo', '1 Caja de fragmentos Evo');
