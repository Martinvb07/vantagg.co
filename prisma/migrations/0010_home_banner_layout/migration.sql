-- Banners del inicio repartidos por momento de compra.
UPDATE `PromoBanner` SET `placement`='TOP',         `sortOrder`=1 WHERE `id`='bnr_bonus';
UPDATE `PromoBanner` SET `placement`='TOP',         `sortOrder`=2 WHERE `id`='bnr_nequi';
UPDATE `PromoBanner` SET `placement`='TOP',         `sortOrder`=3 WHERE `id`='bnr_codigos';
UPDATE `PromoBanner` SET `placement`='HOME_TRUST',  `sortOrder`=1 WHERE `id`='bnr_pasos';
UPDATE `PromoBanner` SET `placement`='HOME_TRUST',  `sortOrder`=2 WHERE `id`='bnr_pagos';
UPDATE `PromoBanner` SET `placement`='HOME_BOTTOM', `sortOrder`=1 WHERE `id`='bnr_sinclaves';
UPDATE `PromoBanner` SET `placement`='HOME_BOTTOM', `sortOrder`=2 WHERE `id`='bnr_garantia';
