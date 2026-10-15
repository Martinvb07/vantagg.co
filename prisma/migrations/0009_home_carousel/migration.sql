-- El hero del inicio usa el arte de Free Fire; sus banners pasan al carrusel entre diamantes y cuentas.
UPDATE `PromoBanner` SET `sortOrder` = `sortOrder` + 20 WHERE `placement` = 'HOME_TRUST' AND `sortOrder` < 100;
UPDATE `PromoBanner` SET `placement` = 'HOME_TRUST' WHERE `placement` = 'TOP';
