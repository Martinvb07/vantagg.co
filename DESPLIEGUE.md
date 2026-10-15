# Publicar la tienda (producción)

Guía paso a paso para poner VANTA en internet con tu dominio. Al final, `npm run verificar:produccion` debe decir **«Sin bloqueantes»**.

> Todo lo que ya tienes configurado en tu PC (precios, paquetes de LATAM/Brasil/Europa, ajustes, banners) se lleva a producción con un comando (paso 2). Clientes, pedidos y sesiones de prueba **no** se copian.

---

## 0. Lo que necesitas antes

| Qué | Para qué | Dónde |
|---|---|---|
| Dominio (ej. `vanta.com.co`) | Dirección de la tienda y correos | Cualquier registrador (.co, .com) |
| Servidor (VPS) con Docker, 2 GB de RAM o más | Donde corre la tienda | Hetzner, DigitalOcean, Contabo, etc. (Ubuntu 24.04) |
| Cuenta de Resend con el dominio verificado | Enviar códigos, avisos y correos de pedidos | resend.com |
| Comercio aprobado en Bold + llaves | Cobrar | Panel de Bold → Integraciones |
| Saldo en RechargeGame | Comprar las recargas | Panel del proveedor (USDT, red BEP20) |

**Por qué un servidor y no «serverless»:** algunas funciones (límites de intentos, «escribiendo…» del chat, avisos agrupados) viven en la memoria de un único proceso. Usa **una sola instancia** de la tienda.

---

## 1. Variables de producción (ya preparadas)

El archivo **`deploy/.env.production`** ya está generado en tu PC y no se sube a git ni entra en la imagen de Docker. Tiene:

- Secretos nuevos: sesión, cifrado, tarea programada, dirección secreta del panel y contraseñas de MySQL.
- Llaves de **Bold de producción** (con `BOLD_TEST_MODE` vacío: cobros reales).
- Llaves de RechargeGame, Resend y Google.
- Administrador inicial: **storevancolombia@gmail.com**, con una contraseña temporal (`SEED_ADMIN_PASSWORD`). La dirección secreta del panel está en `ADMIN_PATH`.

Ya está configurado para **vantagg.co** (`APP_URL=https://vantagg.co`, remitente `VANTA <pedidos@vantagg.co>`). Solo queda, opcional, `TOPUP_WEBHOOK_SECRET` (paso 4).

Revisa el archivo desde tu PC antes de subirlo; hoy da **«Sin bloqueantes»**:

```bash
npm run verificar:produccion -- deploy/.env.production
```

Para usar imágenes en un bucket (Cloudflare R2/S3) en vez del disco del servidor, agrega a `deploy/.env.production`: `STORAGE_ENDPOINT`, `STORAGE_REGION=auto`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, `STORAGE_BUCKET` y `STORAGE_PUBLIC_URL`.

---

## 2. Llevar tu configuración (en tu PC)

```bash
npm run config:exportar
```

Crea `exportacion/config-AAAAMMDD-HHMM/` con ajustes, los paquetes de las tres regiones (con tus precios manuales), los banners y sus imágenes. Copia esa carpeta y `deploy/.env.production` al servidor (por ejemplo con `scp`; no están en git). No los publiques: tienen llaves y correos de la tienda.

---

## 3. Arrancar en el servidor

```bash
cd deploy
docker compose --env-file .env.production up -d --build
```

La tienda aplica sola las migraciones de la base de datos al arrancar. Después:

```bash
# Administrador inicial y ajustes base
docker compose --env-file .env.production exec app npm run db:seed

# Tu configuración (primero simula, luego aplica)
docker compose --env-file .env.production cp ../exportacion/config-AAAAMMDD-HHMM app:/tmp/config
docker compose --env-file .env.production exec app npm run config:importar -- /tmp/config
docker compose --env-file .env.production exec app npm run config:importar -- /tmp/config --confirmar
```

Apunta el dominio al servidor en **GoDaddy** → Mis productos → vantagg.co → **DNS**:

| Tipo | Nombre | Valor |
|---|---|---|
| A | `@` | IP de tu VPS (borra el registro A «Parked» si existe) |
| CNAME | `www` | `vantagg.co` |

Caddy obtiene el certificado HTTPS solo en uno o dos minutos después de que el DNS apunte al servidor.

---

## 4. Servicios externos

**Correos (Resend).** En resend.com → Domains → **Add domain** → `vantagg.co`. Resend te muestra 3 o 4 registros (DKIM, SPF del subdominio `send` y, recomendado, DMARC): créalos tal cual en GoDaddy → DNS (en «Nombre» pon solo la parte antes de `.vantagg.co`). Cuando diga *Verified*, prueba desde Panel → Correos → «Enviar prueba». Borra la llave vieja que usaste en tu PC.

**Bold.** Panel de Bold → Integraciones:
- Llaves de identidad y secreta en `.env.production`.
- Webhook: `https://vantagg.co/api/webhooks/bold` (ventas aprobadas, rechazadas y anulaciones).
- Primero con llaves de prueba y `BOLD_TEST_MODE=true`: el checkout muestra «Modo pruebas» y no cobra. Cuando todo funcione, cambia a las llaves reales y deja `BOLD_TEST_MODE` vacío.
- Si el webhook se demora, la tienda consulta el estado del pago sola (al volver el cliente y cada pocos minutos).

**RechargeGame.**
- Recarga saldo: debe cubrir al menos tu paquete más caro activo, que hoy cuesta unos 149.59 USDT.
- Webhook: Profile → Webhook → `https://vantagg.co/api/webhooks/topup`. Copia el secreto `whsec_…` en `TOPUP_WEBHOOK_SECRET`.

**Google.** Google Cloud Console → Credenciales → tu cliente OAuth:
- URI de redirección autorizada: `https://vantagg.co/api/auth/google/callback`.
- Origen autorizado: `https://vantagg.co`.
- Pantalla de consentimiento → **Publicar app** («En producción»). Si no, solo pueden ingresar los usuarios de prueba.

---

## 5. Tareas programadas y respaldos

En el servidor, `crontab -e` y pega estas 2 líneas (cambia `TU_CRON_SECRET` por el valor de `CRON_SECRET` de `deploy/.env.production` y la ruta por la real):

```cron
*/2 * * * * curl -fsS -m 50 -H "Authorization: Bearer TU_CRON_SECRET" https://vantagg.co/api/cron/maintenance > /dev/null
30 3 * * * sh /ruta/a/la/tienda/deploy/respaldo.sh >> /var/log/respaldo-tienda.log 2>&1
```

- **Cada 2 minutos — mantenimiento.** Confirma pagos pendientes, consulta y reintenta entregas, vence pedidos sin pago y actualiza el catálogo del proveedor. **Sin esto, nada de eso pasa.**
- **Cada día — respaldo.** Copia la base de datos y las imágenes; se guardan 14 días en `~/respaldos-tienda`. Descarga una copia a otro lugar de vez en cuando.

Para restaurar un respaldo de la base:

```bash
gunzip -c db-AAAAMMDD-HHMM.sql.gz | docker compose --env-file .env.production exec -T db sh -c 'mysql -u root -p"$MYSQL_ROOT_PASSWORD" vanta_store'
```

---

## 6. Monitoreo

- **Caídas:** en uptimerobot.com (gratis) crea un monitor HTTPS a `https://vantagg.co/api/health`. Responde 200 si la tienda y la base funcionan, 503 si no.
- **Errores:** si un cliente ve una página de error, te llega un correo «Error en la tienda», como máximo uno cada 30 minutos por tipo de error.

---

## 7. Panel y datos de la tienda

1. Entra por `https://vantagg.co/<ADMIN_PATH>` con **storevancolombia@gmail.com** y la contraseña temporal de `SEED_ADMIN_PASSWORD`.
2. Activa la verificación en dos pasos y guarda los códigos de respaldo.
3. Cambia la contraseña en Panel → Mi seguridad y **borra `SEED_ADMIN_PASSWORD`** de `deploy/.env.production`.
4. **Panel → Ajustes:**
   - Razón social, NIT y dirección: el Estatuto del Consumidor exige mostrarlos.
   - Correo de soporte y de avisos internos: ya vienen con storevancolombia@gmail.com (puedes cambiarlos por uno de tu dominio).
   - «Sección de cuentas»: en *Automático* aparece sola cuando publicas la primera cuenta.
5. Comprueba:

```bash
docker compose --env-file .env.production exec app npm run verificar:produccion
```

Debe terminar en **«Sin bloqueantes»**.

---

## 8. Antes de anunciar

- [ ] Compra real pequeña de punta a punta: 100 diamantes a tu propio ID, con Bold en modo real.
- [ ] Llega el correo de confirmación y el de entrega.
- [ ] Respuesta a una solicitud de soporte de prueba desde Panel → Soporte.
- [ ] Google Search Console: agrega el dominio y envía `https://vantagg.co/sitemap.xml`.

## Legal y negocio (con tu contador o abogado)

- **Facturación electrónica de la DIAN**, si estás obligado.
- **Textos legales:** las páginas de `/legal` son una base. Que un abogado las revise (retracto, reversión del pago, datos personales) y actualiza la fecha de vigencia en `src/content/legal.tsx`.
- **Venta de cuentas de Free Fire:** los términos de Garena no permiten vender cuentas. Decide si las ofreces; la sección se puede apagar en Ajustes.

## Actualizar la tienda más adelante

```bash
git pull
cd deploy
docker compose --env-file .env.production up -d --build
```

Las migraciones nuevas se aplican solas al arrancar.
