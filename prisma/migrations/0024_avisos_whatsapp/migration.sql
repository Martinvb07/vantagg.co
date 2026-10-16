-- Contacto solo por WhatsApp: sin correo de soporte público.
-- Los avisos internos (ventas, chats, reclamos, errores) llegan a este correo. Se cambian en Panel → Ajustes.
INSERT INTO `Setting` (`key`, `value`, `updatedAt`) VALUES ('supportEmail', '', NOW(3))
  ON DUPLICATE KEY UPDATE `value` = VALUES(`value`), `updatedAt` = NOW(3);
INSERT INTO `Setting` (`key`, `value`, `updatedAt`) VALUES ('staffAlertEmail', 'jesusartunduaga6@gmail.com', NOW(3))
  ON DUPLICATE KEY UPDATE `value` = VALUES(`value`), `updatedAt` = NOW(3);
