-- Seguimiento, ayuda, catálogo y el final del inicio pasan a diseño nativo.
-- Los banners de esas ubicaciones se conservan ocultos en "Tras los diamantes" para reutilizarlos.
UPDATE `PromoBanner` SET `placement`='HOME_TRUST', `active`=0, `sortOrder`=`sortOrder`+100
WHERE `placement` IN ('WIDE','HOME_BOTTOM','CATALOG_FEED','TRACK_SIDE','HELP_SIDE');
