-- CreateTable
CREATE TABLE `PromoBanner` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(120) NOT NULL,
    `imageUrl` VARCHAR(1024) NOT NULL,
    `href` VARCHAR(255) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;


-- Banners iniciales (imágenes originales en /public/promo; reemplazables desde el panel)
INSERT INTO `PromoBanner` (`id`, `title`, `imageUrl`, `href`, `sortOrder`, `active`, `createdAt`, `updatedAt`) VALUES
  ('bnr_bonus', '+10% de bonus en todos los paquetes de diamantes', '/promo/bonus.svg', '/recargas', 1, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('bnr_pasos', 'Recarga en 3 pasos: pon tu ID, paga y recibe', '/promo/pasos.svg', '/recargas', 2, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('bnr_pagos', 'Paga con Nequi, PSE, débito o crédito', '/promo/pagos.svg', '/recargas', 3, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('bnr_cuentas', 'Cuentas Free Fire verificadas', '/promo/cuentas.svg', '/cuentas', 4, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('bnr_garantia', 'Si la entrega falla, te devolvemos tu dinero', '/promo/garantia.svg', '/legal/reembolsos', 5, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3));
