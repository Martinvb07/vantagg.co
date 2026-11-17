-- Temporada de Navidad encendida (Panel → Ajustes → Temporada). Solo es un ajuste: «Normal» vuelve al diseño de
-- siempre sin tocar nada más.
INSERT INTO `Setting` (`key`, `value`, `updatedAt`) VALUES ('seasonTheme', 'navidad', CURRENT_TIMESTAMP(3))
  ON DUPLICATE KEY UPDATE `value` = 'navidad', `updatedAt` = CURRENT_TIMESTAMP(3);
