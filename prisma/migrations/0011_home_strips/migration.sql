-- Inicio: carrusel de promos en el hero y una franja ancha (1600×400) sola entre secciones.
UPDATE `PromoBanner` SET `placement`='TOP', `sortOrder`=3 WHERE `id`='bnr_pagos';
UPDATE `PromoBanner` SET `sortOrder`=4 WHERE `id`='bnr_codigos';

-- Las versiones 1200×630 que salen del inicio quedan ocultas con los demás formatos 1200×630.
UPDATE `PromoBanner` SET `placement`='TOP', `active`=0, `sortOrder`=100 WHERE `id` IN ('bnr_pasos','bnr_sinclaves','bnr_garantia');
UPDATE `PromoBanner` SET `placement`='TOP' WHERE `active`=0 AND `placement`='HOME_TRUST' AND `id` <> 'bnr_wide_cuentas';

INSERT INTO `PromoBanner` (`id`, `title`, `imageUrl`, `href`, `placement`, `sortOrder`, `active`, `createdAt`, `updatedAt`) VALUES
  ('bnr_pasos_wide', 'Recarga en 3 pasos: pon tu ID, paga y recibe', '/promo/pasos-wide.svg', '/recargas', 'HOME_TRUST', 1, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('bnr_garantia_wide', 'Si la entrega falla, te devolvemos tu dinero', '/promo/garantia-wide.svg', '/ayuda#error-de-entrega', 'HOME_BOTTOM', 1, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('bnr_sinclaves_wide', 'Solo tu ID, cero claves: nunca pedimos contraseñas', '/promo/sinclaves-wide.svg', '/recargas', 'HOME_BOTTOM', 2, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3));
