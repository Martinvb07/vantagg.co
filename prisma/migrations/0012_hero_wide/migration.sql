-- Carrusel principal en formato ancho 1600×480, dentro del ancho de la página.
-- Las versiones 1200×630 que salían ahí quedan ocultas junto al checkout (mismo formato).
UPDATE `PromoBanner` SET `placement`='TOPUP_SIDE', `active`=0, `sortOrder`=100 WHERE `placement`='TOP';

INSERT INTO `PromoBanner` (`id`, `title`, `imageUrl`, `href`, `placement`, `sortOrder`, `active`, `createdAt`, `updatedAt`) VALUES
  ('bnr_hero_bonus', '+10% de bonus en todos los paquetes de diamantes', '/promo/hero-bonus.svg', '/recargas', 'TOP', 1, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('bnr_hero_nequi', 'Paga tus diamantes con Nequi', '/promo/hero-nequi.svg', '/recargas', 'TOP', 2, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('bnr_hero_pagos', 'Paga como quieras: Nequi, PSE, débito o crédito', '/promo/hero-pagos.svg', '/recargas', 'TOP', 3, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('bnr_hero_codigos', '¿Tienes un código promocional? Aplícalo al pagar', '/promo/hero-codigos.svg', '/recargas', 'TOP', 4, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3));
