-- Ganancia mínima del 30 % en todo: lo que queda limpio del precio de venta, ya descontados el costo del proveedor y la
-- comisión de Bold (la tienda la sube sola en la siguiente sincronización y nunca baja precios). Si ya había una
-- ganancia mínima más alta, se respeta. La de los paquetes de 100 diamantes queda en «0 = la general», porque la
-- comisión fija de Bold ya se descuenta en todos.
INSERT INTO `Setting` (`key`, `value`, `updatedAt`) VALUES ('minMarginPct', '30', CURRENT_TIMESTAMP(3))
  ON DUPLICATE KEY UPDATE
    `updatedAt` = IF(CAST(`value` AS DECIMAL(6, 2)) < 30, CURRENT_TIMESTAMP(3), `updatedAt`),
    `value` = IF(CAST(`value` AS DECIMAL(6, 2)) < 30, '30', `value`);

INSERT INTO `Setting` (`key`, `value`, `updatedAt`) VALUES ('minMarginSmallPct', '0', CURRENT_TIMESTAMP(3))
  ON DUPLICATE KEY UPDATE `value` = '0', `updatedAt` = CURRENT_TIMESTAMP(3);

-- Armas Evo que ya no se venden: 10 fragmentos y 1 caja. Solo se ocultan (no se borra nada: pedidos e historial siguen
-- igual) y se pueden volver a activar en Panel → Paquetes.
UPDATE `DiamondPackage`
SET `active` = false, `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `diamonds` = 0 AND `name` IN ('10 Fragmentos de arma Evo', '1 Caja de fragmentos Evo');
